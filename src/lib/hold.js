import { rig, useStore } from '../state/store'
import { sound } from './sound'

/*
 * Press-and-hold to light the lantern; let go to release it.
 * Shared by the on-screen button, the lantern itself and the keyboard.
 */
export const HOLD_SECONDS = 1.6

const listeners = new Set()
let holding = false
let raf = 0
let last = 0
let onRelease = () => {}

function emit() {
  listeners.forEach((fn) => fn({ holding, progress: rig.hold, full: rig.hold >= 1 }))
}

function tick(now) {
  // wall-clock based, so slow devices light the lantern in the same time as fast ones
  const dt = Math.min(0.25, (now - last) / 1000)
  last = now
  if (holding) {
    rig.hold = Math.min(1, rig.hold + dt / HOLD_SECONDS)
  } else {
    rig.hold = Math.max(0, rig.hold - dt * 1.4)
  }
  sound.setFlame(rig.hold)
  emit()
  if (holding || rig.hold > 0) raf = requestAnimationFrame(tick)
  else raf = 0
}

function ensureLoop() {
  if (!raf) {
    last = performance.now()
    raf = requestAnimationFrame(tick)
  }
}

export const holdController = {
  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  setReleaseHandler(fn) {
    onRelease = fn
  },
  canStart() {
    const { phase, message } = useStore.getState()
    return phase === 'story' && message.text.trim().length > 0
  },
  start() {
    if (!this.canStart()) {
      listeners.forEach((fn) => fn({ holding: false, progress: rig.hold, full: false, needsText: true }))
      return
    }
    if (holding) return
    holding = true
    ensureLoop()
    emit()
    // also end the hold if the pointer is lifted anywhere on the page
    const up = () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      this.end()
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  },
  end() {
    if (!holding) return
    holding = false
    if (rig.hold >= 1) {
      onRelease()
    } else {
      ensureLoop()
    }
    emit()
  },
  /** Single-action alternative for people who can't (or don't want to) press and hold. */
  lightAndRelease() {
    if (!this.canStart()) return
    holding = false
    const start = performance.now()
    const from = rig.hold
    const step = (now) => {
      const k = Math.min(1, (now - start) / 900)
      rig.hold = from + (1 - from) * k
      sound.setFlame(rig.hold)
      emit()
      if (k < 1) requestAnimationFrame(step)
      else onRelease()
    }
    requestAnimationFrame(step)
  },
  reset() {
    holding = false
    rig.hold = 0
    sound.setFlame(0)
    emit()
  },
}
