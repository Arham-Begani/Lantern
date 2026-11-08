import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Shader } from './Shader'
import { rig, useStore } from '../state/store'
import { MOON_DIR } from './Sky'
import { mulberry32 } from '../lib/textures'

/*
 * A flock of folded-paper cranes. They glide across the view twice on the way
 * down: once through the cloud sea, once over the lake. Same paper as the
 * lanterns, so the motif carries through the whole story.
 */

function craneGeometry() {
  // local space: flying toward +X, up is +Y, wings along ±Z
  const v = []
  const flap = []
  const tri = (a, b, c, fa = 0, fb = 0, fc = 0) => {
    v.push(...a, ...b, ...c)
    flap.push(fa, fb, fc)
  }
  // keel and body
  tri([0.32, 0.02, 0], [-0.3, 0.02, 0], [0, -0.2, 0])
  // neck rising forward, with a small folded head
  tri([0.16, 0.0, 0.05], [0.16, 0.0, -0.05], [0.92, 0.42, 0])
  tri([0.92, 0.42, 0], [1.06, 0.33, 0.015], [1.06, 0.33, -0.015])
  // tail rising back
  tri([-0.16, 0.0, 0.05], [-0.16, 0.0, -0.05], [-0.9, 0.36, 0])
  // wings: inner panel and outer, folded tip
  for (const s of [1, -1]) {
    tri([0.16, 0.03, 0.04 * s], [-0.2, 0.03, 0.04 * s], [-0.02, 0.06, 0.62 * s], 0, 0, 0.56 * s)
    tri([-0.02, 0.06, 0.62 * s], [-0.2, 0.03, 0.04 * s], [-0.34, 0.05, 1.12 * s], 0.56 * s, 0, 1 * s)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.setAttribute('aFlap', new THREE.Float32BufferAttribute(flap, 1))
  g.computeVertexNormals()
  return g
}

const vert = /* glsl */ `
  attribute float aFlap;
  attribute float aSeed;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vSeed;
  void main() {
    vec3 p = position;
    // flap in bursts, then glide
    float burst = 0.55 + 0.45 * sin(uTime * 0.6 + aSeed * 12.0);
    float a = sin(uTime * 6.5 + aSeed * 30.0) * 0.85 * burst;
    float k = abs(aFlap);
    p.y += k * sin(a) * 0.9;
    p.z *= 1.0 - k * (1.0 - cos(a)) * 0.35;
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vSeed = aSeed;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const frag = /* glsl */ `
  uniform vec3 uMoonDir;
  uniform float uAlpha;
  uniform float uDawn;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vSeed;
  void main() {
    vec3 n = normalize(vN);
    float moon = abs(dot(n, uMoonDir));
    vec3 paper = mix(vec3(0.93, 0.89, 0.8), vec3(0.95, 0.78, 0.72), step(0.8, vSeed));
    vec3 col = paper * (0.16 + 0.55 * moon);
    // a warm underside, as if lit by the lanterns below
    col += vec3(1.0, 0.6, 0.3) * max(-n.y, 0.0) * 0.18;
    col = mix(col, paper * 0.95, uDawn * 0.6);
    float d = length(cameraPosition - vWorld) * uFogDensity;
    col = mix(col, uFogColor, 1.0 - exp(-d * d));
    gl_FragColor = vec4(col, uAlpha);
    #include <colorspace_fragment>
  }
`

const win = (p, a, b, f = 0.05) => THREE.MathUtils.smoothstep(p, a, a + f) * (1 - THREE.MathUtils.smoothstep(p, b - f, b))

const _pos = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _qb = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _basis = new THREE.Matrix4()
const _z = new THREE.Vector3()

export function Cranes({ count = 12 }) {
  const mesh = useRef()
  const geo = useMemo(() => {
    const g = craneGeometry()
    const rnd = mulberry32(31)
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: count }, rnd), 1))
    return g
  }, [count])
  const formation = useMemo(() => {
    const rnd = mulberry32(8)
    return Array.from({ length: count }, (_, i) => {
      const row = Math.ceil(i / 2)
      const side = i % 2 ? 1 : -1
      return {
        x: -row * 1.9 + (rnd() - 0.5) * 0.8,
        y: -row * 0.25 + (rnd() - 0.5) * 1.2,
        z: side * row * 1.6 + (rnd() - 0.5) * 0.6,
        bob: rnd() * 10,
        scale: 0.85 + rnd() * 0.4,
      }
    })
  }, [count])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMoonDir: { value: MOON_DIR },
      uAlpha: { value: 0 },
      uDawn: { value: 0 },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0 },
    }),
    []
  )

  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const t = state.clock.elapsedTime
    const cam = state.camera
    const { phase } = useStore.getState()
    const p = rig.scroll

    // two passes: through the clouds, then over the lake
    const passA = win(p, 0.12, 0.52)
    const passB = win(p, 0.6, 0.93)
    const vis = phase === 'story' ? Math.max(passA, passB) : 0
    uniforms.uAlpha.value = vis
    uniforms.uTime.value = t
    uniforms.uDawn.value = rig.dawn
    if (state.scene.fog) {
      uniforms.uFogColor.value.copy(state.scene.fog.color)
      uniforms.uFogDensity.value = Math.min(state.scene.fog.density, 0.006)
    }
    m.visible = vis > 0.01
    if (!m.visible) return

    const lake = passB > passA
    const dist = lake ? 34 : 26
    const lift = lake ? 7 : 1.5
    // glide across the frame, left to right, looping every ~16 s
    const span = 70
    const sweep = ((t * 3.6) % span) - span / 2

    cam.getWorldDirection(_fwd)
    _fwd.y = 0
    _fwd.normalize()
    _right.crossVectors(_fwd, _up).normalize()
    // orient local +X (flight) along camera-right, +Z toward the viewer
    _z.copy(_fwd).negate()
    _basis.makeBasis(_right, _up, _z)
    _q.setFromRotationMatrix(_basis)

    formation.forEach((f, i) => {
      _pos
        .copy(cam.position)
        .addScaledVector(_fwd, dist + f.z * 2.2)
        .addScaledVector(_right, sweep + f.x)
      _pos.y = cam.position.y + lift + f.y + Math.sin(t * 0.9 + f.bob) * 0.35
      const bank = Math.sin(t * 0.5 + f.bob) * 0.12
      _qb.setFromAxisAngle(_right, bank).multiply(_q)
      _s.setScalar(f.scale * 1.35)
      _m.compose(_pos, _qb, _s)
      m.setMatrixAt(i, _m)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, count]} frustumCulled={false} renderOrder={3}>
      <Shader vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent side={THREE.DoubleSide} depthWrite />
    </instancedMesh>
  )
}
