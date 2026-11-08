import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { rig, useStore } from '../state/store'
import { makeStoryPath, flightCamPath, recvCamPath } from './paths'
import { cut } from '../lib/director'

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const ANCHORS = [0, 0.44, 0.72, 1]

export function CameraRig() {
  const { camera, size } = useThree()
  const portrait = size.width / size.height < 0.85
  const narrow = !portrait && size.width < 1000
  const storyPath = useMemo(() => makeStoryPath(portrait ? 0.5 : 1.6, narrow), [portrait, narrow])

  const tPos = useRef(new THREE.Vector3())
  const tLook = useRef(new THREE.Vector3())
  const cLook = useRef(new THREE.Vector3())
  const anchor = useRef(0)
  const cutting = useRef(false)

  useFrame((state, dt) => {
    const { phase, reducedMotion } = useStore.getState()
    const pos = tPos.current
    const look = tLook.current

    const fov = portrait ? 58 : 42
    if (camera.fov !== fov) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    let lambda = 3.4
    let parallax = 0

    if (phase === 'story') {
      let p = THREE.MathUtils.clamp(rig.scroll, 0, 1)
      if (reducedMotion) {
        // no continuous camera travel: hold a framing per chapter, with a soft cut between them
        const want = ANCHORS.reduce((best, a) => (Math.abs(a - p) < Math.abs(best - p) ? a : best), 0)
        if (want !== anchor.current && !cutting.current) {
          cutting.current = true
          cut(() => {
            anchor.current = want
            rig.snap = true
          }).then(() => (cutting.current = false))
        }
        p = anchor.current
      }
      storyPath.sample(p, pos, look)
      parallax = THREE.MathUtils.lerp(1.4, 0.12, THREE.MathUtils.smoothstep(p, 0.6, 1))
    } else if (phase === 'flight' || phase === 'sent') {
      flightCamPath.sample(easeInOut(Math.min(1, rig.flight)), pos, look)
      look.lerp(rig.lanternWorld, 0.55 * THREE.MathUtils.smoothstep(rig.flight, 0.05, 0.25))
      const after = phase === 'sent' ? rig.afterFlight : 0
      pos.y += after * 0.55
      pos.z -= after * 0.45
      lambda = 5
      parallax = phase === 'sent' ? 1.2 : 0.2
    } else if (phase === 'recv-intro') {
      recvCamPath.sample(0, pos, look)
      look.lerp(rig.lanternWorld, 0.6)
      parallax = 1.2
    } else if (phase === 'recv-descent') {
      recvCamPath.sample(easeInOut(Math.min(1, rig.recv)), pos, look)
      const track = 1 - THREE.MathUtils.smoothstep(rig.recv, 0.85, 1)
      look.lerp(rig.lanternWorld, 0.8 * track)
      // ride down level with the lantern so the ridges stay in profile
      pos.y = THREE.MathUtils.lerp(pos.y, rig.lanternWorld.y + 1.2, 0.85 * track)
      lambda = 5
      parallax = 0.2
    } else {
      recvCamPath.sample(1, pos, look)
      parallax = 0.15
    }

    if (!reducedMotion) {
      pos.x += rig.pointer.x * parallax
      pos.y += rig.pointer.y * parallax * 0.5
    }

    if (rig.snap) {
      camera.position.copy(pos)
      cLook.current.copy(look)
      rig.snap = false
    } else {
      const k = 1 - Math.exp(-lambda * Math.min(dt, 0.05))
      camera.position.lerp(pos, k)
      cLook.current.lerp(look, k)
    }
    camera.lookAt(cLook.current)
  })

  return null
}
