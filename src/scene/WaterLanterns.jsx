import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Shader } from './Shader'
import { rig, useStore } from '../state/store'
import { mulberry32 } from '../lib/textures'

/*
 * Small paper lanterns floating on the lake. As you scroll down to the water
 * they light one by one, and stay lit. Each has a reflection.
 */

const bodyVert = /* glsl */ `
  attribute vec4 aData; // x, z, seed, ignite threshold
  uniform float uTime;
  uniform float uMirror;
  varying float vH;
  varying float vSeed;
  varying float vThresh;
  varying vec3 vWorld;
  void main() {
    vec3 p = position;
    float seed = aData.z;
    vec3 base = vec3(aData.x + sin(uTime * 0.05 + seed * 20.0) * 0.8, 0.0, aData.y + cos(uTime * 0.04 + seed * 9.0) * 0.4);
    float bob = sin(uTime * 1.1 + seed * 30.0) * 0.025;
    float tilt = sin(uTime * 0.8 + seed * 11.0) * 0.06;
    p.y += p.x * tilt;
    vec3 w = base + p + vec3(0.0, bob, 0.0);
    if (uMirror > 0.5) w.y = -w.y;
    vH = position.y;
    vSeed = seed;
    vThresh = aData.w;
    vWorld = w;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`
const bodyFrag = /* glsl */ `
  uniform float uTime;
  uniform float uLit;
  uniform float uMirror;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying float vH;
  varying float vSeed;
  varying float vThresh;
  varying vec3 vWorld;
  void main() {
    // ignite in sequence as the visitor scrolls toward the water
    float on = smoothstep(vThresh, vThresh + 0.035, uLit);
    float flick = 0.9 + 0.1 * sin(uTime * (7.0 + vSeed * 4.0) + vSeed * 50.0);
    vec3 paper = mix(vec3(1.0, 0.62, 0.28), vec3(1.0, 0.82, 0.55), smoothstep(0.5, 0.07, vH));
    paper *= mix(vec3(1.0), vec3(1.0, 0.7, 0.7), step(0.85, vSeed));
    vec3 unlit = vec3(0.08, 0.07, 0.08);
    vec3 col = mix(unlit, paper * (1.3 + 0.7 * smoothstep(0.52, 0.06, vH)) * flick, on);
    // the wooden base stays dark
    col = mix(col, vec3(0.05, 0.035, 0.03), step(vH, 0.06));
    if (uMirror > 0.5) col *= 0.45;
    float d = length(cameraPosition - vWorld) * uFogDensity;
    col = mix(col, uFogColor, 1.0 - exp(-d * d));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const haloVert = /* glsl */ `
  attribute vec4 aData;
  uniform float uTime;
  uniform float uLit;
  uniform float uMirror;
  uniform float uPixelRatio;
  varying float vA;
  void main() {
    float seed = aData.z;
    vec3 w = vec3(aData.x + sin(uTime * 0.05 + seed * 20.0) * 0.8, 0.32, aData.y + cos(uTime * 0.04 + seed * 9.0) * 0.4);
    if (uMirror > 0.5) w.y = -w.y;
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = smoothstep(aData.w, aData.w + 0.035, uLit) * (uMirror > 0.5 ? 0.45 : 1.0);
    gl_PointSize = min(220.0, uPixelRatio * 380.0 / -mv.z);
  }
`
const haloFrag = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = exp(-d * d * 4.5) * 0.55 + exp(-d * 12.0) * 0.4;
    gl_FragColor = vec4(vec3(1.0, 0.6, 0.28) * a * vA, 1.0);
  }
`

function useField(count) {
  return useMemo(() => {
    const rnd = mulberry32(404)
    const data = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      let x, z
      do {
        z = -7 - Math.pow(rnd(), 0.8) * 120
        x = (rnd() - 0.5) * (14 + -z * 0.9)
      } while (Math.abs(x) < 2.2 && z > -14)
      // nearer lanterns light last, so the glow spreads toward you
      const thresh = 0.58 + (1 - Math.min(1, -z / 127)) * 0.26 + rnd() * 0.05
      data.set([x, z, rnd(), thresh], i * 4)
    }
    return data
  }, [count])
}

function makeUniforms(mirror) {
  return {
    uTime: { value: 0 },
    uLit: { value: 0 },
    uMirror: { value: mirror ? 1 : 0 },
    uPixelRatio: { value: 1 },
    uFogColor: { value: new THREE.Color() },
    uFogDensity: { value: 0.003 },
  }
}

export function WaterLanterns({ count = 30 }) {
  const data = useField(count)
  const geo = useMemo(() => {
    const body = new THREE.BoxGeometry(0.46, 0.46, 0.46, 1, 2, 1)
    body.translate(0, 0.29, 0)
    const base = new THREE.BoxGeometry(0.62, 0.06, 0.62)
    base.translate(0, 0.03, 0)
    const merged = new THREE.BufferGeometry()
    const pos = [...base.attributes.position.array, ...body.attributes.position.array]
    const idx = [...base.index.array, ...Array.from(body.index.array, (i) => i + base.attributes.position.count)]
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    merged.setIndex(idx)
    merged.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4))
    return merged
  }, [data])
  const haloGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aData', new THREE.BufferAttribute(data, 4))
    return g
  }, [data, count])

  const u = useMemo(() => makeUniforms(false), [])
  const um = useMemo(() => makeUniforms(true), [])

  useFrame((state) => {
    const { phase } = useStore.getState()
    const lit = phase === 'story' ? rig.scrollMax : 1.2
    for (const x of [u, um]) {
      x.uTime.value = state.clock.elapsedTime
      x.uLit.value = lit
      x.uPixelRatio.value = state.gl.getPixelRatio()
      if (state.scene.fog) {
        x.uFogColor.value.copy(state.scene.fog.color)
        x.uFogDensity.value = state.scene.fog.density
      }
    }
  })

  return (
    <group>
      <instancedMesh args={[geo, undefined, count]} frustumCulled={false}>
        <Shader vertexShader={bodyVert} fragmentShader={bodyFrag} uniforms={u} />
      </instancedMesh>
      <instancedMesh args={[geo, undefined, count]} frustumCulled={false}>
        <Shader vertexShader={bodyVert} fragmentShader={bodyFrag} uniforms={um} side={THREE.DoubleSide} />
      </instancedMesh>
      <points geometry={haloGeo} frustumCulled={false} renderOrder={4}>
        <Shader vertexShader={haloVert} fragmentShader={haloFrag} uniforms={u} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={haloGeo} frustumCulled={false} renderOrder={0}>
        <Shader vertexShader={haloVert} fragmentShader={haloFrag} uniforms={um} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  )
}
