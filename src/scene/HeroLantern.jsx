import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import CustomShaderMaterial from 'three-custom-shader-material'
import * as THREE from 'three'
import { Shader } from './Shader'
import { rig, useStore, PAPERS } from '../state/store'
import { paperFiberTexture, drawInk, INK_W, INK_H, mulberry32 } from '../lib/textures'
import { LANTERN_HOME, LANTERN_SCALE, flightLanternPath, recvLanternPath, RECV_REST } from './paths'

/* The silhouette of a sky lantern: open at the bottom, shouldered, domed. */
const PROFILE = [
  [0.4, 0.0],
  [0.43, 0.1],
  [0.47, 0.25],
  [0.51, 0.45],
  [0.545, 0.65],
  [0.565, 0.85],
  [0.57, 1.02],
  [0.56, 1.16],
  [0.525, 1.3],
  [0.46, 1.42],
  [0.36, 1.52],
  [0.22, 1.585],
  [0.08, 1.612],
  [0.0, 1.615],
].map(([r, y]) => new THREE.Vector2(r, y))

export const LANTERN_HEIGHT = 1.615

export function useLanternGeometry(segments = 64) {
  return useMemo(() => {
    // densify the profile so the paper reads as a smooth, taut surface
    const curve = new THREE.SplineCurve(PROFILE)
    const pts = curve.getSpacedPoints(48)
    return new THREE.LatheGeometry(pts, segments)
  }, [segments])
}

const paperVert = /* glsl */ `
  varying vec2 vUv2;
  varying float vH;
  void main() {
    vUv2 = uv;
    vH = position.y / ${LANTERN_HEIGHT.toFixed(3)};
  }
`

const paperFrag = /* glsl */ `
  uniform float uGlow;
  uniform float uTime;
  uniform vec3 uPaper;
  uniform vec3 uGlowColor;
  uniform sampler2D uInk;
  uniform sampler2D uFiber;
  varying vec2 vUv2;
  varying float vH;

  void main() {
    float fiber = texture2D(uFiber, vUv2 * vec2(3.0, 1.7)).r - 0.5;
    float fiber2 = texture2D(uFiber, vUv2 * vec2(7.0, 4.1) + 0.37).r - 0.5;
    float ink = texture2D(uInk, vUv2).r;

    // glued seams between the eight paper panels
    float fu = fract(vUv2.x * 8.0);
    float seam = 1.0 - smoothstep(0.0, 0.014, min(fu, 1.0 - fu));
    // a faint hoop line where a second bamboo ring braces the shoulder
    float hoop = exp(-pow((vH - 0.70) * 90.0, 2.0)) * 0.6;

    vec3 paper = uPaper * (0.92 + fiber * 0.22 + fiber2 * 0.1);
    paper *= 1.0 - ink * 0.6;
    paper *= 1.0 - seam * 0.18 - hoop * 0.2;

    // light from the flame near the open bottom, filtered through the paper
    float flicker = 0.94 + 0.06 * sin(uTime * 13.0) * sin(uTime * 7.3 + 1.7);
    float inner = 0.55 + 1.1 * exp(-pow((vH - 0.22) * 2.1, 2.0)) - 0.25 * smoothstep(0.75, 1.0, vH);
    float trans = (0.7 + fiber * 1.1 + fiber2 * 0.5) * (1.0 - seam * 0.55) * (1.0 - hoop * 0.5);
    float blocked = 1.0 - ink * 0.85;
    vec3 glowCol = mix(uGlowColor, vec3(1.0, 0.86, 0.62), 0.3 * smoothstep(0.4, 0.0, vH));
    // seen from inside (through the open bottom) the paper is brighter still
    float facing = gl_FrontFacing ? 1.0 : 1.6;
    vec3 emissive = glowCol * uPaper * inner * trans * blocked * uGlow * 1.85 * flicker * facing;

    csm_DiffuseColor = vec4(paper, 1.0);
    csm_Emissive = emissive;
    csm_Roughness = 0.88;
  }
`

const flameFrag = /* glsl */ `
  uniform float uTime;
  uniform float uGlow;
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
  void main() {
    vec2 p = vUv - vec2(0.5, 0.2);
    float wob = (n(vec2(vUv.y * 4.0 - uTime * 5.0, uTime * 2.0)) - 0.5) * 0.18 * vUv.y;
    p.x += wob;
    // teardrop: round base, tapering tip
    float w = mix(0.22, 0.015, smoothstep(0.0, 0.75, p.y)) ;
    float shape = smoothstep(w, w * 0.15, abs(p.x)) * smoothstep(-0.16, 0.0, p.y) * smoothstep(0.78, 0.25, p.y);
    float core = smoothstep(w * 0.6, 0.0, abs(p.x)) * smoothstep(0.4, 0.0, p.y) * smoothstep(-0.1, 0.02, p.y);
    vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.78, 0.38), shape);
    col = mix(col, vec3(1.0, 0.97, 0.88), core);
    float a = shape * uGlow;
    gl_FragColor = vec4(col * (1.6 + core * 2.0), a);
  }
`

const haloFrag = /* glsl */ `
  uniform float uGlow;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = exp(-d * d * 5.0) * 0.55 + exp(-d * 9.0) * 0.25;
    gl_FragColor = vec4(uColor * a * uGlow, 1.0);
  }
`

const simpleVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const emberVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uGlow;
  uniform float uSpin;
  uniform float uPixelRatio;
  varying float vA;
  void main() {
    float life = fract(uTime * (0.18 + aSeed * 0.12) + aSeed * 7.0);
    float ang = aSeed * 6.2831 + uTime * (0.4 + uSpin * 1.6) * (0.6 + aSeed);
    float rad = 0.5 + 0.35 * sin(aSeed * 31.0) + life * 0.35;
    vec3 p = vec3(cos(ang) * rad, -0.05 + life * 2.6, sin(ang) * rad);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = smoothstep(0.0, 0.12, life) * (1.0 - smoothstep(0.55, 1.0, life)) * uGlow;
    gl_PointSize = (2.0 + aSeed * 3.5) * uPixelRatio * (6.0 / -mv.z);
  }
`
const emberFrag = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.38) * 2.0, a * a * vA);
  }
`

function Embers({ count = 70 }) {
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uGlow: { value: 0 }, uSpin: { value: 0 }, uPixelRatio: { value: 1 } }),
    []
  )
  const geo = useMemo(() => {
    const rnd = mulberry32(11)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from({ length: count }, rnd), 1))
    return g
  }, [count])
  useFrame((s) => {
    uniforms.uTime.value = s.clock.elapsedTime
    uniforms.uGlow.value = Math.min(1, rig.glow * 1.3)
    uniforms.uSpin.value = rig.hold
    uniforms.uPixelRatio.value = s.gl.getPixelRatio()
  })
  return (
    <points geometry={geo} frustumCulled={false}>
      <Shader
        vertexShader={emberVert}
        fragmentShader={emberFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpC = new THREE.Vector3()
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function HeroLantern() {
  const group = useRef()
  const mirror = useRef()
  const light = useRef()
  const geo = useLanternGeometry(72)

  const inkCanvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = INK_W
    c.height = INK_H
    return c
  }, [])
  const inkTex = useMemo(() => {
    const t = new THREE.CanvasTexture(inkCanvas)
    t.colorSpace = THREE.NoColorSpace
    t.anisotropy = 8
    return t
  }, [inkCanvas])

  const paperUniforms = useMemo(
    () => ({
      uGlow: { value: 0 },
      uTime: { value: 0 },
      uPaper: { value: new THREE.Color(PAPERS.ivory.paper) },
      uGlowColor: { value: new THREE.Color(PAPERS.ivory.glow) },
      uInk: { value: inkTex },
      uFiber: { value: paperFiberTexture() },
    }),
    [inkTex]
  )
  const flameUniforms = useMemo(() => ({ uTime: { value: 0 }, uGlow: { value: 0 } }), [])
  const haloUniforms = useMemo(
    () => ({ uGlow: { value: 0 }, uColor: { value: new THREE.Color('#ffb060') } }),
    []
  )

  // Repaint the ink whenever the words (or the received lantern) change.
  useEffect(() => {
    const paint = () => {
      const { phase, message, received } = useStore.getState()
      const m = phase.startsWith('recv') && received ? received : message
      drawInk(inkCanvas, m)
      inkTex.needsUpdate = true
      const p = PAPERS[m.paper] || PAPERS.ivory
      paperUniforms.uPaper.value.set(p.paper)
      paperUniforms.uGlowColor.value.set(p.glow)
      haloUniforms.uColor.value.set(p.glow)
    }
    // fonts must be ready before we rasterise text into the texture
    const fontsReady = Promise.all([
      document.fonts.load('italic 420 30px "Fraunces Variable"'),
      document.fonts.load('500 22px "Inter Variable"'),
    ]).catch(() => {})
    fontsReady.then(paint)
    const unsub = useStore.subscribe((s, prev) => {
      if (s.message !== prev.message || s.received !== prev.received || s.phase !== prev.phase) paint()
    })
    return unsub
  }, [inkCanvas, inkTex, paperUniforms, haloUniforms])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    // publish where the lantern is on screen so a DOM hotspot can sit over it
    if (group.current) {
      tmpB.copy(group.current.position)
      tmpB.y += 0.75 * LANTERN_SCALE
      tmpB.project(state.camera)
      tmpC.copy(group.current.position).y += 1.6 * LANTERN_SCALE
      tmpC.project(state.camera)
      rig.lanternScreen.x = (tmpB.x * 0.5 + 0.5) * state.size.width
      rig.lanternScreen.y = (-tmpB.y * 0.5 + 0.5) * state.size.height
      rig.lanternScreen.h = Math.abs(tmpC.y - tmpB.y) * state.size.height
      rig.lanternScreen.visible = tmpB.z < 1
    }
    const { phase } = useStore.getState()
    const g = group.current
    if (!g) return

    // --- glow target per phase ---
    let target = 0
    if (phase === 'story') target = 0.12 + rig.hold * 0.88
    else if (phase === 'flight' || phase === 'sent') target = 1
    else if (phase === 'recv-intro') target = 0.85
    else if (phase === 'recv-descent') target = 0.95
    else if (phase === 'recv-landed') target = 0.8
    else if (phase === 'recv-letter') target = 0.6
    rig.glow = THREE.MathUtils.damp(rig.glow, target, phase === 'story' ? 6 : 2.5, dt)
    const glow = rig.glow + rig.burst * 0.35

    // --- position per phase ---
    if (phase === 'flight' || phase === 'sent') {
      const f = easeInOut(Math.min(1, rig.flight))
      flightLanternPath.getPoint(f, tmpA)
      // keep drifting gently upward once the flight has finished
      const after = phase === 'sent' ? (rig.afterFlight || 0) : 0
      tmpA.y += after * 0.6
      tmpA.z -= after * 0.5
      g.position.copy(tmpA)
      g.position.x += Math.sin(t * 0.7) * 0.08 * f
      g.rotation.z = Math.sin(t * 0.9) * 0.05 * f
      g.rotation.x = Math.sin(t * 0.6 + 1) * 0.04 * f
    } else if (phase.startsWith('recv')) {
      if (phase === 'recv-intro' || phase === 'recv-descent') {
        recvLanternPath.getPoint(easeInOut(Math.min(1, rig.recv)), tmpA)
        g.position.copy(tmpA)
        g.rotation.z = Math.sin(t * 0.8) * 0.06 * (1 - rig.recv)
      } else {
        g.position.copy(RECV_REST)
        g.position.y += Math.sin(t * 1.1) * 0.02
        g.rotation.z = Math.sin(t * 0.9) * 0.025
        g.rotation.x = Math.sin(t * 0.7 + 1) * 0.02
      }
    } else {
      g.position.copy(LANTERN_HOME)
      // the paper breathes and lifts a hair as it fills with hot air
      g.position.y += rig.glow * 0.04 + Math.sin(t * 2.2) * 0.006 * rig.glow
      g.rotation.set(0, 0, Math.sin(t * 1.7) * 0.01 * rig.glow)
    }

    // reflection mirrors the lantern about the water plane
    if (mirror.current) {
      const m = mirror.current
      m.position.set(g.position.x, -g.position.y, g.position.z)
      m.rotation.set(-g.rotation.x, g.rotation.y, -g.rotation.z)
      m.scale.set(LANTERN_SCALE, -LANTERN_SCALE, LANTERN_SCALE)
      m.visible = g.position.y < 40
    }
    rig.lanternWorld.copy(g.position).y += 0.5 * LANTERN_SCALE
    rig.glowColor.copy(haloUniforms.uColor.value)

    paperUniforms.uGlow.value = glow
    paperUniforms.uTime.value = t
    flameUniforms.uTime.value = t
    flameUniforms.uGlow.value = Math.min(1, glow * 1.4)
    haloUniforms.uGlow.value = glow

    if (light.current) {
      const flick = 0.92 + 0.08 * Math.sin(t * 12.7) * Math.sin(t * 5.1)
      // brighter in the sky so the clouds catch fire as the lantern passes through
      const skyBoost = phase === 'flight' || phase === 'recv-descent' ? 1 + 6 * Math.sin(Math.PI * Math.min(1, phase === 'flight' ? rig.flight : rig.recv)) : 1
      light.current.intensity = glow * 5.5 * flick * skyBoost
    }
  })

  const body = (
    <>
      {/* paper envelope, seam turned to the back so the words face us */}
      <mesh geometry={geo} rotation-y={Math.PI}>
        <CustomShaderMaterial
          baseMaterial={THREE.MeshStandardMaterial}
          vertexShader={paperVert}
          fragmentShader={paperFrag}
          uniforms={paperUniforms}
          side={THREE.DoubleSide}
          color="#ffffff"
          roughness={0.9}
          metalness={0}
        />
      </mesh>
      {/* bamboo hoop and cross wires at the opening */}
      <mesh rotation-x={Math.PI / 2} position-y={0.005}>
        <torusGeometry args={[0.4, 0.013, 8, 64]} />
        <meshStandardMaterial color="#5a3d22" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-z={Math.PI / 2} position-y={0.02}>
        <cylinderGeometry args={[0.004, 0.004, 0.8, 4]} />
        <meshStandardMaterial color="#3a2a1a" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={0.02}>
        <cylinderGeometry args={[0.004, 0.004, 0.8, 4]} />
        <meshStandardMaterial color="#3a2a1a" side={THREE.DoubleSide} />
      </mesh>
      <mesh position-y={0.02}>
        <cylinderGeometry args={[0.055, 0.045, 0.04, 16]} />
        <meshStandardMaterial color="#2a1f18" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {/* flame */}
      <Billboard position={[0, 0.03, 0]}>
        <mesh position-y={0.11} renderOrder={5}>
          <planeGeometry args={[0.16, 0.3]} />
          <Shader
            vertexShader={simpleVert}
            fragmentShader={flameFrag}
            uniforms={flameUniforms}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
      {/* soft halo so the glow reads even without post-processing */}
      <Billboard position={[0, 0.75, 0]}>
        <mesh renderOrder={4}>
          <planeGeometry args={[4.2, 4.2]} />
          <Shader
            vertexShader={simpleVert}
            fragmentShader={haloFrag}
            uniforms={haloUniforms}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
    </>
  )

  return (
    <>
      <group ref={group} position={LANTERN_HOME.toArray()} scale={LANTERN_SCALE}>
        {body}
        <pointLight ref={light} position={[0, 0.5, 0]} color="#ffa24f" intensity={0} distance={0} decay={2} />
        <Embers />
      </group>
      {/* its reflection, seen through the translucent water */}
      <group ref={mirror}>{body}</group>
    </>
  )
}
