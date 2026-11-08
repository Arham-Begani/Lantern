import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Shader } from './Shader'
import { rig } from '../state/store'
import { mulberry32 } from '../lib/textures'

export const MOON_DIR = new THREE.Vector3(-0.42, 0.3, -1).normalize()
export const SUN_DIR = new THREE.Vector3(0.22, 0.12, -1).normalize()

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // always at the far plane
  }
`

const skyFrag = /* glsl */ `
  uniform float uDawn;
  uniform float uTime;
  uniform vec3 uMoonDir;
  uniform vec3 uSunDir;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec3 d0 = normalize(vDir);
    // below the horizon the dome shows the sky mirrored, as the lake reflects it
    vec3 d = vec3(d0.x, abs(d0.y), d0.z);
    float h = d.y;

    // night: ink zenith, indigo body, violet horizon with a faint ember of dusk
    vec3 nZen = vec3(0.020, 0.027, 0.062);
    vec3 nMid = vec3(0.060, 0.070, 0.180);
    vec3 nHor = vec3(0.230, 0.175, 0.330);
    vec3 nDusk = vec3(0.420, 0.250, 0.330);
    // dawn: pale blue zenith, lilac body, peach horizon
    vec3 dZen = vec3(0.240, 0.250, 0.470);
    vec3 dMid = vec3(0.700, 0.540, 0.640);
    vec3 dHor = vec3(1.000, 0.640, 0.460);
    vec3 dSun = vec3(1.000, 0.880, 0.680);

    float hp = max(h, 0.0);
    vec3 night = mix(nHor, nMid, smoothstep(0.0, 0.22, hp));
    night = mix(night, nZen, smoothstep(0.18, 0.75, hp));
    // dusk remnant hugging the horizon, stronger away from the moon
    float duskBand = exp(-hp * 18.0) * (0.55 + 0.45 * (1.0 - max(dot(normalize(d.xz), normalize(uMoonDir.xz)), 0.0)));
    night += nDusk * duskBand * 0.55;

    vec3 dawn = mix(dHor, dMid, smoothstep(0.0, 0.25, hp));
    dawn = mix(dawn, dZen, smoothstep(0.2, 0.85, hp));
    float sunAmt = max(dot(d, uSunDir), 0.0);
    dawn += dSun * (pow(sunAmt, 60.0) * 1.6 + pow(sunAmt, 6.0) * 0.45);

    vec3 col = mix(night, dawn, smoothstep(0.0, 1.0, uDawn));


    // moon: crisp disc, soft halo, fades out at dawn
    float m = dot(d, uMoonDir);
    float moonA = (1.0 - uDawn * 0.92);
    float disc = smoothstep(0.99955, 0.99975, m);
    float halo = pow(max(m, 0.0), 260.0) * 0.32 + pow(max(m, 0.0), 22.0) * 0.1;
    // a hint of surface detail on the disc
    vec2 mUv = (d.xy - uMoonDir.xy) * 900.0;
    float maria = 0.86 + 0.14 * sin(mUv.x * 0.9 + 1.3) * sin(mUv.y * 1.1 - 0.4);
    col += vec3(0.93, 0.95, 1.0) * disc * maria * 1.05 * moonA;
    col += vec3(0.62, 0.68, 0.95) * halo * moonA;
    if (d0.y < 0.0) col *= 0.7;

    // blue-noise-ish dithering kills banding in the long gradients
    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0 * 2.0;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const starVert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w * 0.99999; // sit just in front of the sky dome
    float tw = 0.72 + 0.28 * sin(uTime * (0.35 + aPhase * 0.6) + aPhase * 40.0);
    float horizon = smoothstep(0.0, 0.18, normalize(position).y);
    vAlpha = tw * horizon;
    gl_PointSize = aSize * uPixelRatio;
  }
`
const starFrag = /* glsl */ `
  uniform float uDawn;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a;
    gl_FragColor = vec4(vec3(0.92, 0.94, 1.0), a * vAlpha * (1.0 - uDawn));
  }
`

export function Sky({ starCount = 2400, mirror = true }) {
  const skyMat = useRef()
  const starMat = useRef()

  const skyUniforms = useMemo(
    () => ({
      uDawn: { value: 0 },
      uTime: { value: 0 },
      uMoonDir: { value: MOON_DIR },
      uSunDir: { value: SUN_DIR },
    }),
    []
  )
  const starUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uDawn: { value: 0 }, uPixelRatio: { value: 1 } }),
    []
  )

  const starGeo = useMemo(() => {
    const rnd = mulberry32(1234)
    const pos = new Float32Array(starCount * 3)
    const size = new Float32Array(starCount)
    const phase = new Float32Array(starCount)
    for (let i = 0; i < starCount; i++) {
      // uniform on the upper hemisphere, denser toward the zenith
      const u = rnd()
      const y = Math.pow(u, 0.7) * 0.98 + 0.02
      const r = Math.sqrt(1 - y * y)
      const a = rnd() * Math.PI * 2
      const R = 800
      pos.set([Math.cos(a) * r * R, y * R, Math.sin(a) * r * R], i * 3)
      const big = rnd()
      size[i] = big > 0.985 ? 3.4 + rnd() * 1.6 : 1.1 + Math.pow(rnd(), 3) * 2.2
      phase[i] = rnd()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [starCount])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    skyUniforms.uTime.value = t
    skyUniforms.uDawn.value = rig.dawn
    starUniforms.uTime.value = t
    starUniforms.uDawn.value = rig.dawn
    starUniforms.uPixelRatio.value = state.gl.getPixelRatio()
  })

  return (
    <group>
      <mesh frustumCulled={false} renderOrder={-10}>
        <sphereGeometry args={[900, 48, 32]} />
        <Shader
          ref={skyMat}
          vertexShader={skyVert}
          fragmentShader={skyFrag}
          uniforms={skyUniforms}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped
        />
      </mesh>
      <points geometry={starGeo} frustumCulled={false} renderOrder={-9}>
        <Shader
          ref={starMat}
          vertexShader={starVert}
          fragmentShader={starFrag}
          uniforms={starUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {mirror && (
        <points geometry={starGeo} frustumCulled={false} renderOrder={-9} scale={[1, -1, 1]}>
          <Shader
            vertexShader={starVert}
            fragmentShader={starFrag}
            uniforms={starUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </group>
  )
}
