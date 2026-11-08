import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Shader } from './Shader'
import { rig } from '../state/store'

const vert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHaze;
  uniform vec3 uDawnColor;
  uniform float uHeight;
  uniform float uSeed;
  uniform float uFreq;
  uniform float uTrees;
  uniform float uDawn;
  uniform float uMirror;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise(float x) {
    float i = floor(x); float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), u) * 2.0 - 1.0;
  }
  float ridged(float x) {
    float a = 0.5, s = 0.0, f = 1.0;
    for (int i = 0; i < 5; i++) {
      float n = 1.0 - abs(noise(x * f));
      s += n * n * a;
      f *= 2.03; a *= 0.5;
    }
    return s;
  }

  void main() {
    float x = vWorld.x;
    float y = uMirror > 0.5 ? -vWorld.y : vWorld.y;

    float prof = uHeight * (0.18 + 0.82 * ridged(x * uFreq + uSeed));
    // soften toward the far edges so cards never show a hard end
    prof *= smoothstep(0.0, 0.25, 1.0 - abs(x) / 900.0);

    // pine tree line along the nearer ridges
    if (uTrees > 0.0) {
      float cell = x * 1.6;
      float id = floor(cell);
      float t = fract(cell);
      float h = hash(id + uSeed) ;
      float cluster = smoothstep(-0.2, 0.6, noise(x * 0.05 + uSeed * 3.0));
      float tri = max(0.0, 1.0 - abs(t - 0.5) * (2.6 + h * 1.6));
      prof += tri * uTrees * (0.5 + h) * cluster;
    }

    float d = prof - y;
    float aa = fwidth(d) * 1.2 + 0.0001;
    float alpha = smoothstep(0.0, aa, d);
    if (alpha < 0.01) discard;

    // valley mist rises from the base; moonlit rim along the crest
    // mist hangs a little above the shoreline, which itself stays dark
    float mist = smoothstep(uHeight * 0.6, uHeight * 0.12, y) * smoothstep(-0.2, uHeight * 0.1, y) * 0.5;
    vec3 col = mix(uColor, uHaze, mist);
    float rim = exp(-d * 4.0 / max(uHeight, 1.0) * 6.0) * 0.18;
    col += vec3(0.55, 0.62, 0.95) * rim * (1.0 - uDawn);
    col = mix(col, uDawnColor * (0.65 + mist * 0.6), uDawn * 0.85);

    if (uMirror > 0.5) col *= 0.55;
    float fd = length(cameraPosition - vWorld) * min(uFogDensity, 0.0034);
    col = mix(col, uFogColor, (1.0 - exp(-fd * fd)) * 0.7);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`

const LAYERS = [
  { z: -38, w: 300, h: 7, color: '#090b17', haze: '#1a1d3a', dawn: '#4a3d5c', trees: 1.6, freq: 0.045, seed: 3.1 },
  { z: -72, w: 420, h: 15, color: '#0f1230', haze: '#23284e', dawn: '#6a5878', trees: 1.0, freq: 0.03, seed: 11.7 },
  { z: -125, w: 600, h: 28, color: '#181c42', haze: '#2f3460', dawn: '#8c7894', trees: 0, freq: 0.02, seed: 23.9 },
  { z: -190, w: 820, h: 34, color: '#252a55', haze: '#3a3f6c', dawn: '#ab95ab', trees: 0, freq: 0.014, seed: 41.2 },
  { z: -280, w: 1200, h: 74, color: '#363a68', haze: '#484c7a', dawn: '#c7aebb', trees: 0, freq: 0.0095, seed: 57.4 },
]

function RidgeLayer({ layer, index, mirror }) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(layer.color) },
      uHaze: { value: new THREE.Color(layer.haze) },
      uDawnColor: { value: new THREE.Color(layer.dawn) },
      uHeight: { value: layer.h },
      uSeed: { value: layer.seed },
      uFreq: { value: layer.freq },
      uTrees: { value: layer.trees },
      uDawn: { value: 0 },
      uMirror: { value: mirror ? 1 : 0 },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0 },
    }),
    [layer, mirror]
  )
  const mesh = useRef()
  useFrame((state) => {
    uniforms.uDawn.value = rig.dawn
    if (state.scene.fog) {
      uniforms.uFogColor.value.copy(state.scene.fog.color)
      uniforms.uFogDensity.value = state.scene.fog.density
    }
    // reflections only matter near the water; from above they read as ghost slabs
    if (mirror && mesh.current) mesh.current.visible = state.camera.position.y < 22
  })
  const height = layer.h * 1.9 + 4
  return (
    <mesh
      ref={mesh}
      position={[0, mirror ? -height / 2 + 0.01 : height / 2 - 0.5, layer.z]}
      renderOrder={-5 + (LAYERS.length - index) * -0.1}
    >
      <planeGeometry args={[layer.w, height, 1, 1]} />
      <Shader
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite
      />
    </mesh>
  )
}

export function Ridges({ mirror = false }) {
  return (
    <group>
      {LAYERS.map((l, i) => (
        <RidgeLayer key={i} layer={l} index={i} />
      ))}
      {mirror && LAYERS.map((l, i) => <RidgeLayer key={`m${i}`} layer={l} index={i} mirror />)}
    </group>
  )
}
