import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Shader } from './Shader'
import { rig, useStore } from '../state/store'
import { mulberry32 } from '../lib/textures'

const win = (p, a, b, f = 0.06) => THREE.MathUtils.smoothstep(p, a, a + f) * (1 - THREE.MathUtils.smoothstep(p, b - f, b))

/* ------------------------------------------------------------------ */
/* Moonbeams: soft shafts of light falling through gaps in the clouds */
/* ------------------------------------------------------------------ */

const beamVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const beamFrag = /* glsl */ `
  uniform float uTime;
  uniform float uI;
  uniform float uSeed;
  varying vec2 vUv;
  void main() {
    float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
    // strongest just under the clouds, fading toward the water
    float fall = smoothstep(0.0, 0.55, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
    float shimmer = 0.75 + 0.25 * sin(uTime * 0.35 + uSeed * 10.0 + vUv.y * 3.0);
    float streaks = 0.92 + 0.08 * sin(vUv.x * 9.0 + uSeed * 7.0);
    float a = edge * fall * shimmer * streaks * uI * 0.09;
    gl_FragColor = vec4(vec3(0.62, 0.7, 1.0) * a, 1.0);
  }
`

function Beam({ position, rotation, size, seed, uniformsRef }) {
  const u = useMemo(() => ({ uTime: { value: 0 }, uI: { value: 0 }, uSeed: { value: seed } }), [seed])
  uniformsRef.current.push(u)
  return (
    <mesh position={position} rotation={rotation} renderOrder={2}>
      <planeGeometry args={size} />
      <Shader vertexShader={beamVert} fragmentShader={beamFrag} uniforms={u} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function MoonBeams() {
  const list = useRef([])
  list.current = []
  const beams = useMemo(() => {
    const rnd = mulberry32(12)
    return Array.from({ length: 6 }, (_, i) => ({
      position: [-60 + i * 22 + (rnd() - 0.5) * 10, 16, -70 - rnd() * 80],
      rotation: [0, 0, -0.32 - rnd() * 0.12],
      size: [7 + rnd() * 9, 40],
      seed: rnd(),
    }))
  }, [])
  useFrame((state) => {
    const { phase } = useStore.getState()
    const below = 1 - THREE.MathUtils.smoothstep(state.camera.position.y, 20, 32)
    let I = 0
    if (phase === 'story') I = win(rig.scroll, 0.5, 1.02, 0.1)
    else if (phase.startsWith('recv')) I = 0.7
    else if (phase === 'flight') I = 1 - rig.flight
    I *= below * (1 - rig.dawn)
    for (const u of list.current) {
      u.uTime.value = state.clock.elapsedTime
      u.uI.value = I
    }
  })
  return (
    <group>
      {beams.map((b, i) => (
        <Beam key={i} {...b} uniformsRef={list} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Shooting stars across the open sky                                 */
/* ------------------------------------------------------------------ */

const starVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const starFrag = /* glsl */ `
  uniform float uLife;
  varying vec2 vUv;
  void main() {
    // bright head at uv.x = 1, tapering tail
    float tail = pow(vUv.x, 2.2);
    float core = 1.0 - abs(vUv.y - 0.5) * 2.0;
    core = pow(max(core, 0.0), 3.0);
    float fade = sin(3.14159 * clamp(uLife, 0.0, 1.0));
    gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * tail * core * fade * 2.2, 1.0);
  }
`

const _d = new THREE.Vector3()
const _c = new THREE.Vector3()
const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _z = new THREE.Vector3()
const _m = new THREE.Matrix4()

export function ShootingStars() {
  const mesh = useRef()
  const u = useMemo(() => ({ uLife: { value: 0 } }), [])
  const s = useRef({ next: 2.5, t0: -10, dur: 1.1, start: new THREE.Vector3(), dir: new THREE.Vector3(), len: 0 })
  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    const st = s.current
    const cam = state.camera
    const { phase, reducedMotion } = useStore.getState()
    const skyView = cam.position.y > 28 || phase === 'sent' || phase === 'recv-intro'
    if (t > st.next && skyView && !reducedMotion) {
      // spawn somewhere high in front of the camera
      cam.getWorldDirection(_d)
      st.start.copy(cam.position).addScaledVector(_d, 260)
      st.start.x += (Math.random() - 0.5) * 300
      st.start.y += 60 + Math.random() * 90
      st.dir.set(Math.random() > 0.5 ? 1 : -1, -0.35 - Math.random() * 0.25, (Math.random() - 0.5) * 0.4).normalize()
      st.len = 30 + Math.random() * 25
      st.t0 = t
      st.dur = 0.8 + Math.random() * 0.6
      st.next = t + 5 + Math.random() * 7
    }
    const life = (t - st.t0) / st.dur
    m.visible = life >= 0 && life <= 1
    if (!m.visible) return
    u.uLife.value = life
    // head position travels along the direction
    _c.copy(st.start).addScaledVector(st.dir, life * 140)
    // orient a quad along the motion, facing the camera
    _x.copy(st.dir)
    _z.copy(cam.position).sub(_c).normalize()
    _z.addScaledVector(_x, -_z.dot(_x)).normalize()
    _y.crossVectors(_z, _x)
    _m.makeBasis(_x, _y, _z)
    m.position.copy(_c).addScaledVector(st.dir, -st.len / 2)
    m.quaternion.setFromRotationMatrix(_m)
    m.scale.set(st.len, 0.5, 1)
  })
  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-8} visible={false}>
      <planeGeometry args={[1, 1]} />
      <Shader vertexShader={starVert} fragmentShader={starFrag} uniforms={u} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Fireflies drifting over the reeds by the shore                     */
/* ------------------------------------------------------------------ */

const flyVert = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uA;
  varying float vA;
  void main() {
    float s = aSeed.x * 100.0;
    vec3 p = position + vec3(
      sin(uTime * 0.3 + s) * 0.9 + sin(uTime * 0.71 + s * 1.3) * 0.4,
      sin(uTime * 0.4 + s * 0.7) * 0.35,
      cos(uTime * 0.27 + s * 0.9) * 0.8
    );
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float blink = smoothstep(0.2, 1.0, sin(uTime * (0.8 + aSeed.y) + s));
    vA = blink * uA;
    gl_PointSize = (2.5 + aSeed.z * 3.0) * uPixelRatio * (8.0 / -mv.z);
  }
`
const flyFrag = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.4) * 2.2 * a * a * vA, 1.0);
  }
`

export function Fireflies({ count = 60 }) {
  const geo = useMemo(() => {
    const rnd = mulberry32(55)
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const side = rnd() > 0.5 ? 1 : -1
      pos.set([side * (1.2 + rnd() * 8), 0.3 + rnd() * 2.2, -4 + rnd() * 8], i * 3)
      seed.set([rnd(), rnd(), rnd(), rnd()], i * 4)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
    return g
  }, [count])
  const u = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 }, uA: { value: 0 } }), [])
  useFrame((state) => {
    const { phase } = useStore.getState()
    let a = 0
    if (phase === 'story') a = THREE.MathUtils.smoothstep(rig.scroll, 0.7, 0.86)
    else if (phase === 'recv-landed' || phase === 'recv-letter') a = 1
    else if (phase === 'flight') a = 1 - THREE.MathUtils.smoothstep(rig.flight, 0, 0.3)
    u.uTime.value = state.clock.elapsedTime
    u.uPixelRatio.value = state.gl.getPixelRatio()
    u.uA.value = a * (1 - rig.dawn)
  })
  return (
    <points geometry={geo} frustumCulled={false} renderOrder={4}>
      <Shader vertexShader={flyVert} fragmentShader={flyFrag} uniforms={u} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}
