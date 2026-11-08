import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import CustomShaderMaterial from 'three-custom-shader-material'
import * as THREE from 'three'
import { Shader } from './Shader'
import { rig } from '../state/store'
import { mulberry32 } from '../lib/textures'
import { MOON_DIR, SUN_DIR } from './Sky'

/*
 * Water without a second render pass: everything that should reflect is
 * mirrored below y = 0 (ridges, sky, stars, lanterns), and this translucent
 * surface darkens it, more at steep angles and less at grazing ones. Moon
 * and lantern glitter are computed analytically from rippled normals.
 */
const waterVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const waterFrag = /* glsl */ `
  uniform float uTime;
  uniform float uDawn;
  uniform vec3 uMoonDir;
  uniform vec3 uSunDir;
  uniform vec3 uLantern;
  uniform float uGlow;
  uniform vec3 uGlowColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;

  // sum of a few directional waves; returns slope (d/dx, d/dz)
  vec2 waves(vec2 p, float t) {
    vec2 g = vec2(0.0);
    vec4 W[5];
    W[0] = vec4(0.9, 0.35, 0.55, 0.020);
    W[1] = vec4(-0.4, 1.0, 1.10, 0.012);
    W[2] = vec4(0.7, -0.6, 2.30, 0.006);
    W[3] = vec4(-0.95, -0.2, 4.70, 0.003);
    W[4] = vec4(0.2, 0.98, 9.10, 0.0016);
    for (int i = 0; i < 5; i++) {
      vec2 d = normalize(W[i].xy);
      float k = W[i].z;
      float ph = dot(d, p) * k + t * sqrt(9.8 * k) * 0.35;
      g += d * k * W[i].w * cos(ph) * 3.2;
    }
    return g;
  }

  float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hsh(i),hsh(i+vec2(1,0)),u.x), mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),u.x), u.y); }

  void main() {
    vec3 toCam = cameraPosition - vWorld;
    float dist = length(toCam);
    vec3 V = toCam / dist;
    // ripples fade with distance so far water stays calm and alias-free
    float fade = exp(-dist * 0.018);
    // domain-warp the wave field with noise so it never reads as a grid
    vec2 wp = vWorld.xz + vec2(vn(vWorld.xz * 0.15 + uTime * 0.05), vn(vWorld.zx * 0.15 - uTime * 0.04)) * 6.0;
    vec2 g = waves(wp, uTime) * (0.12 + 0.88 * fade);
    g += (vec2(vn(vWorld.xz * 1.7 + uTime * 0.3), vn(vWorld.xz * 1.7 - uTime * 0.27)) - 0.5) * 0.035 * fade;
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));

    float fres = pow(1.0 - clamp(dot(V, N), 0.0, 1.0), 4.0);
    // alpha = how much of the mirrored world we hide
    float alpha = mix(0.86, 0.22, fres);

    vec3 deep = mix(vec3(0.012, 0.022, 0.045), vec3(0.16, 0.14, 0.2), uDawn);
    vec3 col = deep;

    vec3 R = reflect(-V, N);
    vec3 lightDir = normalize(mix(uMoonDir, uSunDir, uDawn));
    float sp = max(dot(R, lightDir), 0.0);
    vec3 moonCol = mix(vec3(0.75, 0.8, 1.0), vec3(1.0, 0.82, 0.6), uDawn);
    vec3 glitter = moonCol * (pow(sp, 900.0) * 2.2 + pow(sp, 120.0) * 0.32 + pow(sp, 18.0) * 0.03);

    // the lantern's warm sparkle and the pool of light beneath it
    vec3 toL = uLantern - vWorld;
    float dl = length(toL);
    float sl = max(dot(R, toL / dl), 0.0);
    float near = 1.0 / (1.0 + dl * 0.08);
    glitter += uGlowColor * uGlow * (pow(sl, 260.0) * 3.5 + pow(sl, 30.0) * 0.45) * near;
    float pool = exp(-pow(length(toL.xz) * 0.55, 2.0)) * smoothstep(6.0, 0.0, uLantern.y);
    col += uGlowColor * pool * uGlow * 0.35;

    col += glitter;
    float lum = dot(glitter, vec3(0.33));
    alpha = clamp(max(alpha, lum), 0.0, 1.0);

    // fog, matching the scene's exponential fog
    float f = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
    col = mix(col, uFogColor, f);
    alpha = mix(alpha, 1.0, f);

    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function Water() {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDawn: { value: 0 },
      uMoonDir: { value: MOON_DIR },
      uSunDir: { value: SUN_DIR },
      uLantern: { value: new THREE.Vector3() },
      uGlow: { value: 0 },
      uGlowColor: { value: new THREE.Color('#ffb060') },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0.003 },
    }),
    []
  )
  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime
    uniforms.uDawn.value = rig.dawn
    uniforms.uLantern.value.copy(rig.lanternWorld)
    uniforms.uGlow.value = rig.glow + rig.burst * 0.5
    uniforms.uGlowColor.value.copy(rig.glowColor)
    if (state.scene.fog) {
      uniforms.uFogColor.value.copy(state.scene.fog.color)
      uniforms.uFogDensity.value = state.scene.fog.density
    }
  })
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, -380]} renderOrder={1}>
      <planeGeometry args={[1800, 760]} />
      <Shader vertexShader={waterVert} fragmentShader={waterFrag} uniforms={uniforms} transparent depthWrite />
    </mesh>
  )
}

function Shore() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 40]}>
      <planeGeometry args={[200, 81, 1, 1]} />
      <CustomShaderMaterial
        baseMaterial={THREE.MeshStandardMaterial}
        color="#16141c"
        roughness={0.75}
        metalness={0}
        transparent
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vW;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xz;
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec2 vW;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n2(vec2 p){
            vec2 i = floor(p), f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y);
          }
          void main() {
            // ragged waterline: the shore starts a little behind the stone
            float edge = vW.y + 0.55 + (n2(vW * vec2(0.9, 0.9)) - 0.5) * 0.9 + (n2(vW * 4.0) - 0.5) * 0.2;
            float a = smoothstep(0.0, 0.35, edge);
            // wet dark band at the waterline, pebbly variation further back
            float wet = 1.0 - smoothstep(0.0, 1.4, edge);
            float pebble = n2(vW * 9.0) * 0.5 + n2(vW * 2.3) * 0.5;
            vec3 base = mix(vec3(0.075, 0.07, 0.09), vec3(0.12, 0.105, 0.11), pebble);
            base = mix(base, vec3(0.05, 0.06, 0.08), wet * 0.7);
            a *= 1.0 - smoothstep(16.0, 44.0, length(vW - vec2(0.0, 10.0)));
            csm_DiffuseColor = vec4(base, a);
            csm_Roughness = mix(0.85, 0.25, wet);
          }
        `}
      />
    </mesh>
  )
}

function Stone() {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 2)
    const p = g.attributes.position
    const rnd = mulberry32(3)
    for (let i = 0; i < p.count; i++) {
      const k = 0.88 + rnd() * 0.18
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <group position={[0, 0, 0]}>
      <mesh geometry={geo} scale={[0.72, 0.17, 0.58]} position={[0, 0.0, 0.05]}>
        <meshStandardMaterial color="#2a2830" roughness={0.9} flatShading />
      </mesh>
      <mesh geometry={geo} scale={[0.35, 0.1, 0.3]} position={[-0.95, -0.02, 0.4]} rotation-y={1}>
        <meshStandardMaterial color="#1e1d24" roughness={0.9} flatShading />
      </mesh>
      <mesh geometry={geo} scale={[0.28, 0.08, 0.22]} position={[0.85, -0.02, 0.55]} rotation-y={2}>
        <meshStandardMaterial color="#1e1d24" roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

function Reeds({ count = 160 }) {
  const ref = useRef()
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.011, 1, 4, 6, true)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  const matrices = useMemo(() => {
    const rnd = mulberry32(77)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const out = []
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const cluster = rnd()
      const x = side * (1.25 + Math.pow(rnd(), 1.4) * (cluster > 0.7 ? 7 : 3.2))
      const z = -0.9 + rnd() * 2.6
      const h = 0.45 + rnd() * 1.1 * (1 - Math.min(1, Math.abs(x) / 9) * 0.4)
      e.set((rnd() - 0.5) * 0.25, rnd() * 6.28, (rnd() - 0.5) * 0.3)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(x, -0.05, z), q, new THREE.Vector3(1 + rnd(), h, 1 + rnd()))
      out.push(m.clone())
    }
    return out
  }, [count])
  useFrame((s) => {
    uniforms.uTime.value = s.clock.elapsedTime
    if (ref.current && !ref.current.userData.done) {
      matrices.forEach((m, i) => ref.current.setMatrixAt(i, m))
      ref.current.instanceMatrix.needsUpdate = true
      ref.current.userData.done = true
    }
  })
  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} frustumCulled={false}>
      <CustomShaderMaterial
        baseMaterial={THREE.MeshStandardMaterial}
        color="#1f2a1f"
        roughness={0.8}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          uniform float uTime;
          void main() {
            vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float bend = position.y * position.y;
            csm_Position = position + vec3(sin(uTime * 0.7 + ip.x * 1.3 + ip.z) * 0.06, 0.0, cos(uTime * 0.5 + ip.x) * 0.03) * bend;
          }
        `}
      />
    </instancedMesh>
  )
}

/** Expanding rings on the water: used when a lantern lifts off or lands. */
function Ripples() {
  const uniforms = useMemo(
    () => ({ uT: { value: 0 }, uAmp: { value: 0 }, uCenter: { value: new THREE.Vector2() } }),
    []
  )
  useFrame(() => {
    uniforms.uT.value = rig.ripple
    uniforms.uAmp.value = rig.rippleAmp
    uniforms.uCenter.value.set(rig.rippleX, rig.rippleZ)
  })
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} renderOrder={2}>
      <planeGeometry args={[30, 30]} />
      <Shader
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vW;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vW = w.xz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform float uT; uniform float uAmp; uniform vec2 uCenter;
          varying vec2 vW;
          void main() {
            float d = length((vW - uCenter) * vec2(1.0, 1.0));
            float a = 0.0;
            for (int i = 0; i < 3; i++) {
              float r = uT * 6.0 - float(i) * 0.9;
              a += exp(-pow((d - r) * 7.0, 2.0)) * smoothstep(0.0, 0.4, r) * (1.0 - float(i) * 0.25);
            }
            a *= uAmp * (1.0 - smoothstep(0.4, 1.0, uT)) * smoothstep(9.0, 0.0, d);
            gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a * 0.55, 1.0);
          }
        `}
      />
    </mesh>
  )
}

export function Lake({ reeds = 160 }) {
  return (
    <group>
      <Water />
      <Shore />
      <Stone />
      <Reeds count={reeds} />
      <Ripples />
    </group>
  )
}
