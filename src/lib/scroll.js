import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

let lenis = null

export function initLenis(reduced) {
  destroyLenis()
  lenis = new Lenis({
    lerp: reduced ? 1 : 0.085,
    smoothWheel: !reduced,
    wheelMultiplier: 0.9,
    anchors: true,
    autoRaf: false,
  })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(raf)
  gsap.ticker.lagSmoothing(0)
  return lenis
}

function raf(time) {
  lenis?.raf(time * 1000)
}

export function destroyLenis() {
  if (lenis) {
    gsap.ticker.remove(raf)
    lenis.destroy()
    lenis = null
  }
}

export const getLenis = () => lenis

export function scrollToId(id, { immediate = false } = {}) {
  const el = document.getElementById(id)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { immediate, duration: immediate ? 0 : 2.2, force: true })
  else el.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' })
}

export { gsap, ScrollTrigger, SplitText }
