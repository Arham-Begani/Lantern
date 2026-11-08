import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor, AdaptiveDpr } from '@react-three/drei'
import * as THREE from 'three'
import { rig, useStore } from '../state/store'
import { TIERS } from '../lib/quality'
import { Sky, MOON_DIR, SUN_DIR } from './Sky'
import { CloudDeck } from './CloudDeck'
import { Ridges } from './Ridges'
import { Lake } from './Lake'
import { HeroLantern } from './HeroLantern'
import { SkyLanterns } from './SkyLanterns'
import { CameraRig } from './CameraRig'
import { Cranes } from './Cranes'
import { WaterLanterns } from './WaterLanterns'
import { MoonBeams, ShootingStars, Fireflies } from './Atmospherics'
import { Effects } from './Effects'

const NIGHT = {
  hemiSky: new THREE.Color('#4a5288'),
  hemiGround: new THREE.Color('#0b0c16'),
  dir: new THREE.Color('#a8b4ff'),
  fog: new THREE.Color('#151933'),
}
const HAZE = new THREE.Color('#3b3f70')
const DAWN = {
  hemiSky: new THREE.Color('#ffd7bd'),
  hemiGround: new THREE.Color('#6d5d78'),
  dir: new THREE.Color('#ffc89a'),
  fog: new THREE.Color('#c9a9b8'),
}

function Atmosphere() {
  const hemi = useRef()
  const dir = useRef()
  const fill = useRef()
  const { scene } = useThree()
  const fog = useMemo(() => new THREE.FogExp2(NIGHT.fog.clone(), 0.0032), [])
  const tmpDir = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    scene.fog = fog
    return () => (scene.fog = null)
  }, [scene, fog])
  useFrame((state) => {
    const d = rig.dawn
    if (hemi.current) {
      hemi.current.color.copy(NIGHT.hemiSky).lerp(DAWN.hemiSky, d)
      hemi.current.groundColor.copy(NIGHT.hemiGround).lerp(DAWN.hemiGround, d)
      hemi.current.intensity = THREE.MathUtils.lerp(0.9, 1.6, d)
    }
    if (dir.current) {
      dir.current.color.copy(NIGHT.dir).lerp(DAWN.dir, d)
      dir.current.intensity = THREE.MathUtils.lerp(0.55, 2.2, d)
      tmpDir.copy(MOON_DIR).lerp(SUN_DIR, d).normalize().multiplyScalar(200)
      dir.current.position.copy(tmpDir)
    }
    if (fill.current) {
      fill.current.color.copy(NIGHT.dir).lerp(DAWN.dir, d)
      fill.current.intensity = THREE.MathUtils.lerp(0.65, 0.9, d)
    }
    fog.color.copy(NIGHT.fog).lerp(DAWN.fog, d)
    fog.color.lerp(HAZE, THREE.MathUtils.smoothstep(state.camera.position.y, 14, 40) * (1 - d) * 0.8)
    // high above the lake the ground dissolves into haze beneath the cloud sea
    const alt = THREE.MathUtils.smoothstep(state.camera.position.y, 14, 40)
    fog.density = THREE.MathUtils.lerp(0.0032, 0.0022, d) + alt * 0.0075
  })
  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={dir} />
      {/* a cool fill from over the viewer's shoulder, like light bouncing off the moonlit water */}
      <directionalLight ref={fill} position={[6, 5, 14]} />
    </>
  )
}

function ReadySignal() {
  const frames = useRef(0)
  useFrame(() => {
    frames.current++
    if (frames.current === 4) useStore.getState().setSceneReady()
  })
  return null
}

const DEV_FLAGS = import.meta.env.DEV ? new URLSearchParams(location.search) : new URLSearchParams()

function World() {
  const quality = useStore((s) => s.quality)
  const t = { ...TIERS[quality] }
  if (DEV_FLAGS.has('nopost')) t.post = false
  if (DEV_FLAGS.has('noclouds')) t.clouds = 0
  return (
    <>
      <Atmosphere />
      <Sky starCount={t.stars} mirror={t.mirrorDetail} />
      <Ridges mirror />
      {t.clouds > 0 && <CloudDeck density={t.clouds} segments={t.cloudSegments} />}
      <SkyLanterns count={t.skyLanterns} mirror={t.mirrorDetail} />
      <Lake reeds={t.reeds} />
      <WaterLanterns count={t.waterLanterns} />
      <MoonBeams />
      <Fireflies count={t.fireflies} />
      <Cranes count={t.cranes} />
      <ShootingStars />
      <HeroLantern />
      <CameraRig />
      {t.post && <Effects levels={t.bloomLevels} />}
    </>
  )
}

export default function Experience() {
  const quality = useStore((s) => s.quality)
  const degrade = useStore((s) => s.degrade)
  const t = TIERS[quality]

  return (
    <Canvas
      className="scene-canvas"
      aria-hidden="true"
      dpr={t.dpr}
      gl={{
        antialias: !t.post,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
      }}
      camera={{ fov: 42, near: 0.1, far: 2500, position: [0, 80, 64] }}
      onCreated={({ gl, scene }) => {
        if (import.meta.env.DEV) window.__scene = scene
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.0
        gl.setClearColor('#0A0D18')
      }}
    >
      <PerformanceMonitor onDecline={degrade} flipflops={2} />
      <AdaptiveDpr pixelated={false} />
      <Suspense fallback={null}>
        <World />
        <ReadySignal />
      </Suspense>
    </Canvas>
  )
}
