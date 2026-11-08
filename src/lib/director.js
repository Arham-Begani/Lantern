import { gsap } from './scroll'
import { getLenis, scrollToId } from './scroll'
import { rig, useStore } from '../state/store'
import { lanternUrl } from './codec'
import { holdController } from './hold'
import { sound } from './sound'

/*
 * The director runs the cinematic, time-based moments (release flight,
 * recipient descent, dawn) by tweening values on `rig`. The 3D scene just
 * reads those values each frame.
 */

let flightTl = null
let recvTl = null
let afterTl = null

const S = () => useStore.getState()

/** A quick fade to ink and back; used instead of big camera moves when motion is reduced. */
export function cut(during, { hold = 0.15 } = {}) {
  return gsap
    .timeline()
    .to(rig, { cut: 1, duration: 0.35, ease: 'power2.in' })
    .add(() => during?.())
    .to(rig, { cut: 0, duration: 0.6, ease: 'power2.out' }, `+=${hold}`)
}

function startAfterglow() {
  afterTl?.kill()
  rig.afterFlight = 0
  afterTl = gsap.timeline()
  afterTl.to(rig, { afterFlight: 30, duration: 120, ease: 'none' }, 0)
  afterTl.to(rig, { dawn: 1, duration: S().reducedMotion ? 4 : 16, ease: 'sine.inOut' }, 3.5)
}

function finishFlight() {
  const { message, setPhase, setShareUrl, say } = S()
  rig.flight = 1
  setShareUrl(lanternUrl(message))
  setPhase('sent')
  say(`Lantern released. It's on its way${message.to ? ` to ${message.to}` : ''}. Your link is ready to share.`)
  startAfterglow()
}

export function release() {
  const { reducedMotion, setPhase, say } = S()
  getLenis()?.stop()
  flightTl?.kill()
  sound.whoosh()
  sound.pad(true)
  setPhase('flight')
  say('Lantern released.')
  rig.flight = 0

  if (reducedMotion) {
    flightTl = cut(() => finishFlight(), { hold: 0.3 })
    return
  }

  rig.rippleX = 0
  rig.rippleZ = 0
  flightTl = gsap.timeline({ onComplete: finishFlight })
  flightTl
    .to(rig, { burst: 1, duration: 0.25, ease: 'power2.out' }, 0)
    .to(rig, { burst: 0, duration: 1.6, ease: 'power2.inOut' }, 0.25)
    .fromTo(rig, { ripple: 0, rippleAmp: 1 }, { ripple: 1, duration: 3.2, ease: 'power1.out' }, 0.1)
    .to(rig, { flight: 1, duration: 11.5, ease: 'none' }, 0)
    // a second flare as the lantern breaks out above the clouds
    .to(rig, { burst: 0.7, duration: 0.6, ease: 'power2.out' }, 7.6)
    .to(rig, { burst: 0, duration: 2.2, ease: 'power2.inOut' }, 8.2)
}

export function skipFlight() {
  if (!flightTl) return
  flightTl.kill()
  flightTl = null
  rig.burst = 0
  cut(() => finishFlight())
}

export function lightAnother() {
  afterTl?.kill()
  flightTl?.kill()
  sound.pad(false)
  cut(() => {
    const { message, setMessage, setPhase, setShareUrl } = S()
    rig.flight = 0
    rig.dawn = 0
    rig.afterFlight = 0
    holdController.reset()
    setMessage({ ...message, text: '', to: '' })
    setShareUrl('')
    setPhase('story')
    getLenis()?.start()
    scrollToId('compose', { immediate: true })
    rig.scroll = 1
    rig.snap = true
    setTimeout(() => document.getElementById('to-input')?.focus({ preventScroll: true }), 400)
  })
}

export function receive() {
  const { reducedMotion, setPhase, say } = S()
  recvTl?.kill()
  setPhase('recv-descent')
  say('A lantern is drifting down to you.')
  sound.pad(true)
  const land = () => {
    rig.recv = 1
    setPhase('recv-landed')
    say('The lantern has landed on the water. Open it to read the message.')
  }
  if (reducedMotion) {
    recvTl = cut(land)
    return
  }
  rig.rippleX = 0.6
  rig.rippleZ = -3.2
  recvTl = gsap.timeline({ onComplete: land })
  recvTl
    .fromTo(rig, { recv: 0 }, { recv: 1, duration: 12, ease: 'none' })
    .fromTo(rig, { ripple: 0, rippleAmp: 1 }, { ripple: 1, duration: 3.5, ease: 'power1.out' }, 10.6)
}

export function skipDescent() {
  if (!recvTl) return
  recvTl.kill()
  cut(() => {
    rig.recv = 1
    S().setPhase('recv-landed')
  })
}

export function openLetter() {
  const { setPhase, say } = S()
  gsap
    .timeline()
    .to(rig, { burst: 1, duration: 0.35, ease: 'power2.out' })
    .to(rig, { burst: 0, duration: 1.4, ease: 'power2.inOut' })
  setPhase('recv-letter')
  say('The lantern unfolds into a letter.')
}

/** From a received lantern, start writing one back to the sender. */
export function lightOneBack() {
  const { received, setMessage, setPhase } = S()
  cut(() => {
    history.replaceState(null, '', location.pathname)
    setMessage({ to: received?.from || '', from: received?.to || '', text: '', paper: received?.paper || 'ivory' })
    useStore.setState({ received: null })
    rig.recv = 0
    rig.glow = 0
    rig.dawn = 0
    setPhase('story')
    // wait for the story to mount, then jump to the compose chapter
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        getLenis()?.start()
        scrollToId('compose', { immediate: true })
        rig.scroll = 1
        rig.snap = true
        document.getElementById('message-input')?.focus({ preventScroll: true })
      })
    )
  })
}

holdController.setReleaseHandler(release)

/** Development-only access to the running timelines (used by automated visual checks). */
export const debugTimelines = {
  get flight() {
    return flightTl
  },
  get recv() {
    return recvTl
  },
}
