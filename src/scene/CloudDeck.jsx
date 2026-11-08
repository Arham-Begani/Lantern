import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Clouds, Cloud } from '@react-three/drei'
import { rig } from '../state/store'
import * as THREE from 'three'
import { Shader } from './Shader'
import { cloudTextureUrl, mulberry32 } from '../lib/textures'

/*
 * Lambert lighting, but translucent: light passing *through* a puff counts,
 * so the hero lantern lights clouds from behind and inside as it rises.
 * drei's <Clouds> subclasses this and assigns its own onBeforeCompile; the
 * accessor below chains ours after theirs.
 */
const translucentLambert = THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
  'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
  'float dotNL = 0.28 + 0.72 * abs( dot( geometryNormal, directLight.direction ) );'
)

class GlowCloudMaterial extends THREE.MeshLambertMaterial {
  constructor() {
    super()
    this.emissive = new THREE.Color('#191c38')
    // clouds carry their own atmosphere; scene fog is for the ground beneath them
    this.fog = false
  }
  set onBeforeCompile(fn) {
    this._chained = fn
  }
  get onBeforeCompile() {
    const prev = this._chained
    return function (shader, renderer) {
      prev?.call(this, shader, renderer)
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_lambert_pars_fragment>', translucentLambert)
    }
  }
}


/*
 * The top of the cloud sea, seen from above: a single surface with billowing
 * fbm "tops", lit by the moon. It faces up only, so from the lake you still
 * look straight through it to the sky. The puffs above it add volume.
 */
const floorVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const floorFrag = /* glsl */ `
  uniform float uTime;
  uniform float uDawn;
  uniform vec3 uMoonDir;
  varying vec3 vWorld;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return s; }
  void main() {
    vec2 p = vWorld.xz * 0.018 + vec2(uTime * 0.004, uTime * 0.002);
    float c = fbm(p);
    float c2 = fbm(p * 2.7 + 3.0);
    // billow tops are bright, the valleys between them deep indigo
    float tops = smoothstep(0.3, 0.85, c * 0.75 + c2 * 0.3);
    // light comes from the moon's side
    float side = fbm(p + normalize(uMoonDir.xz) * 0.05) - c;
    vec3 valley = mix(vec3(0.10, 0.11, 0.24), vec3(0.42, 0.33, 0.42), uDawn);
    vec3 top = mix(vec3(0.50, 0.52, 0.74), vec3(1.0, 0.82, 0.74), uDawn);
    vec3 col = mix(valley, top, tops);
    col += vec3(0.16, 0.18, 0.3) * smoothstep(0.0, 0.25, -side) * tops * (1.0 - uDawn * 0.5);
    float dist = length(cameraPosition.xz - vWorld.xz);
    // fade into the horizon, and dissolve as the camera sinks into the deck
    float above = cameraPosition.y - vWorld.y;
    float a = (1.0 - smoothstep(500.0, 1100.0, dist)) * smoothstep(1.5, 12.0, above);
    vec3 horizon = mix(vec3(0.23, 0.18, 0.33), vec3(1.0, 0.76, 0.62), uDawn);
    col = mix(col, horizon * 0.85, smoothstep(150.0, 900.0, dist));
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function CloudFloor() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uDawn: { value: 0 }, uMoonDir: { value: new THREE.Vector3(-0.42, 0.3, -1).normalize() } }), [])
  useFrame((s) => {
    uniforms.uTime.value = s.clock.elapsedTime
    uniforms.uDawn.value = rig.dawn
  })
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 33, -200]} renderOrder={-2}>
      <planeGeometry args={[2400, 2400]} />
      <Shader vertexShader={floorVert} fragmentShader={floorFrag} uniforms={uniforms} transparent depthWrite side={THREE.FrontSide} />
    </mesh>
  )
}

/**
 * The cloud sea the camera descends through, plus low mist over the lake.
 * Clouds use a Lambert material, so the hero lantern's point light makes
 * them glow from the inside as it passes.
 */
export function CloudDeck({ density = 1, segments = 30 }) {
  const texture = useMemo(() => cloudTextureUrl(), [])

  const deck = useMemo(() => {
    const rnd = mulberry32(99)
    const items = []
    // A loose grid of clusters across the sea, kept thick around the camera's path.
    const cols = Math.round(7 * Math.sqrt(density)) + 2
    const rows = Math.round(6 * Math.sqrt(density)) + 2
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = THREE.MathUtils.lerp(-170, 170, i / (cols - 1)) + (rnd() - 0.5) * 30
        const z = THREE.MathUtils.lerp(-260, 70, j / (rows - 1)) + (rnd() - 0.5) * 30
        const y = 36 + (rnd() - 0.5) * 8
        const far = Math.min(1, Math.hypot(x, z - 20) / 220)
        items.push({
          seed: Math.floor(rnd() * 1e6),
          position: [x, y, z],
          bounds: [26 + far * 20, 4 + rnd() * 3, 26 + far * 20],
          volume: 22 + far * 18,
          segments: Math.max(6, Math.round(segments * (0.75 + rnd() * 0.5))),
          opacity: 0.85,
          speed: 0.06 + rnd() * 0.05,
        })
      }
    }
    // Extra puffs right on the camera's descent and the lantern's flight line.
    const path = [
      [-2, 46, 48],
      [0, 40, 40],
      [-3, 34, 34],
      [2, 38, 26],
      [1, 40, -6],
      [3, 36, -14],
      [-2, 44, -20],
    ]
    path.forEach(([x, y, z], k) =>
      items.push({
        seed: 500 + k,
        position: [x, y, z],
        bounds: [12, 4, 12],
        volume: 16,
        segments: Math.max(6, Math.round(segments * 0.8)),
        opacity: 0.9,
        speed: 0.08,
      })
    )
    return items
  }, [density, segments])

  const mist = useMemo(() => {
    const rnd = mulberry32(5)
    return Array.from({ length: Math.max(3, Math.round(8 * density)) }, (_, k) => ({
      seed: 900 + k,
      position: [(rnd() - 0.5) * 220, 3 + rnd() * 4, -40 - rnd() * 160],
      bounds: [40, 1.5, 12],
      volume: 18,
      segments: Math.max(4, Math.round(segments * 0.35)),
    }))
  }, [density, segments])

  const limit = deck.reduce((s, c) => s + c.segments, 0) + mist.reduce((s, c) => s + c.segments, 0) + 10

  return (
    <>
    <CloudFloor />
    <Clouds texture={texture} limit={limit} material={GlowCloudMaterial} frustumCulled={false}>
      {deck.map((c, i) => (
        <Cloud
          key={`d${i}`}
          seed={c.seed}
          position={c.position}
          bounds={c.bounds}
          volume={c.volume}
          smallestVolume={0.35}
          segments={c.segments}
          concentrate="inside"
          growth={3}
          speed={c.speed}
          opacity={c.opacity}
          fade={26}
          color="#b3b6d9"
        />
      ))}
      {mist.map((c, i) => (
        <Cloud
          key={`m${i}`}
          seed={c.seed}
          position={c.position}
          bounds={c.bounds}
          volume={c.volume}
          segments={c.segments}
          concentrate="outside"
          growth={2}
          speed={0.05}
          opacity={0.22}
          fade={30}
          color="#8f97c4"
        />
      ))}
    </Clouds>
    </>
  )
}
