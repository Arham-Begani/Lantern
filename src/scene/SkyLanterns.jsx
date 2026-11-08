import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Shader } from './Shader'
import { rig } from '../state/store'
import { mulberry32 } from '../lib/textures'

/*
 * Hundreds of distant lanterns drifting above the cloud sea (and a handful
 * rising over the lake). They are decoration, never presented as other
 * people's real messages.
 */

const bodyVert = /* glsl */ `
  attribute vec4 aData; // x: seed, y: speed, z: sway, w: scale
  uniform float uTime;
  varying float vH;
  varying float vFade;
  varying float vSeed;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float range = 70.0;
    float rise = mod(uTime * aData.y + aData.x * range, range) - range * 0.5;
    vFade = smoothstep(-range * 0.5, -range * 0.38, rise) * smoothstep(range * 0.5, range * 0.36, rise);
    vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vec3 drift = vec3(sin(uTime * 0.21 + aData.x * 40.0) * aData.z, rise, cos(uTime * 0.17 + aData.x * 23.0) * aData.z * 0.6);
    vec3 p = position * aData.w;
    vec4 world = modelMatrix * vec4(ip.xyz + drift + p, 1.0);
    vH = position.y / 1.615;
    vSeed = aData.x;
    vN = normalize(normal);
    vec4 mv = viewMatrix * world;
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const bodyFrag = /* glsl */ `
  uniform float uTime;
  uniform float uDawn;
  varying float vH;
  varying float vFade;
  varying float vSeed;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float flick = 0.88 + 0.12 * sin(uTime * (6.0 + vSeed * 5.0) + vSeed * 60.0);
    float inner = 0.6 + 1.2 * exp(-pow((vH - 0.22) * 2.4, 2.0));
    vec3 hot = vec3(1.0, 0.78, 0.45);
    vec3 warm = vec3(1.0, 0.48, 0.16);
    vec3 col = mix(warm, hot, exp(-pow((vH - 0.18) * 3.0, 2.0)));
    // seed picks a paper: ivory, saffron or rose
    col *= mix(vec3(1.0), vec3(1.0, 0.75, 0.75), step(0.82, vSeed));
    col *= inner * flick * (1.6 + uDawn * 0.8);
    gl_FragColor = vec4(col * vFade, 1.0);
  }
`

const haloVert = /* glsl */ `
  attribute vec4 aData;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uScale;
  varying float vFade;
  void main() {
    float range = 70.0;
    float rise = mod(uTime * aData.y + aData.x * range, range) - range * 0.5;
    vFade = smoothstep(-range * 0.5, -range * 0.38, rise) * smoothstep(range * 0.5, range * 0.36, rise);
    vec3 drift = vec3(sin(uTime * 0.21 + aData.x * 40.0) * aData.z, rise, cos(uTime * 0.17 + aData.x * 23.0) * aData.z * 0.6);
    vec4 mv = modelViewMatrix * vec4(position + drift + vec3(0.0, 0.5 * aData.w, 0.0), 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(220.0, uScale * aData.w * uPixelRatio * 300.0 / -mv.z);
  }
`
const haloFrag = /* glsl */ `
  uniform float uDawn;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = exp(-d * d * 4.0) * 0.5 + exp(-d * 10.0) * 0.4;
    gl_FragColor = vec4(vec3(1.0, 0.6, 0.28) * a * vFade * (1.0 - uDawn * 0.5), 1.0);
  }
`

function useLanternGeo() {
  return useMemo(() => {
    const pts = [
      [0.4, 0],
      [0.5, 0.4],
      [0.565, 0.9],
      [0.55, 1.2],
      [0.42, 1.45],
      [0.2, 1.59],
      [0, 1.615],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    return new THREE.LatheGeometry(pts, 10)
  }, [])
}

function LanternField({ count, box, seed, scale = [0.9, 1.4], halo = 1, mirror = false }) {
  const baseGeo = useLanternGeo()
  const { geo, haloGeo, matrices } = useMemo(() => {
    const rnd = mulberry32(seed)
    const g = baseGeo.clone()
    const data = new Float32Array(count * 4)
    const hp = new Float32Array(count * 3)
    const mats = []
    const m = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      let x, y, z
      do {
        x = THREE.MathUtils.lerp(box[0][0], box[1][0], rnd())
        y = THREE.MathUtils.lerp(box[0][1], box[1][1], rnd())
        z = THREE.MathUtils.lerp(box[0][2], box[1][2], Math.pow(rnd(), 0.7))
        // keep a clear pocket around the cameras' framings
      } while (Math.hypot(x, y - 78, z - 50) < 16 || Math.hypot(x - 2, y - 70, z + 20) < 6)
      m.makeTranslation(x, y, z)
      mats.push(m.clone())
      hp.set([x, y, z], i * 3)
      data.set([rnd(), 0.12 + rnd() * 0.35, 0.4 + rnd() * 1.6, THREE.MathUtils.lerp(scale[0], scale[1], rnd())], i * 4)
    }
    g.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4))
    const h = new THREE.BufferGeometry()
    h.setAttribute('position', new THREE.BufferAttribute(hp, 3))
    h.setAttribute('aData', new THREE.BufferAttribute(data, 4))
    return { geo: g, haloGeo: h, matrices: mats }
  }, [baseGeo, count, box, seed, scale])

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uDawn: { value: 0 }, uPixelRatio: { value: 1 }, uScale: { value: halo } }),
    [halo]
  )

  useFrame((s) => {
    uniforms.uTime.value = s.clock.elapsedTime
    uniforms.uDawn.value = rig.dawn
    uniforms.uPixelRatio.value = s.gl.getPixelRatio()
  })

  return (
    <group scale={mirror ? [1, -1, 1] : 1}>
      <instancedMesh
        args={[geo, undefined, count]}
        frustumCulled={false}
        onUpdate={(self) => {
          matrices.forEach((mm, i) => self.setMatrixAt(i, mm))
          self.instanceMatrix.needsUpdate = true
        }}
      >
        <Shader
          vertexShader={bodyVert}
          fragmentShader={bodyFrag}
          uniforms={uniforms}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
      <points geometry={haloGeo} frustumCulled={false}>
        <Shader
          vertexShader={haloVert}
          fragmentShader={haloFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

const SKY_BOX = [
  [-240, 58, -420],
  [240, 160, 60],
]
const LAKE_BOX = [
  [-90, 6, -230],
  [90, 26, -50],
]

export function SkyLanterns({ count = 300, mirror = true }) {
  const lake = Math.max(6, Math.round(count / 25))
  return (
    <group>
      <LanternField count={count} box={SKY_BOX} seed={2024} scale={[1.0, 1.6]} halo={1} />
      <LanternField count={lake} box={LAKE_BOX} seed={77} scale={[0.8, 1.1]} halo={0.8} />
      {mirror && <LanternField count={lake} box={LAKE_BOX} seed={77} scale={[0.8, 1.1]} halo={0.6} mirror />}
    </group>
  )
}
