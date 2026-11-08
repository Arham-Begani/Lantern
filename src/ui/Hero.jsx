import { useEffect, useRef } from 'react'
import { gsap, SplitText, scrollToId } from '../lib/scroll'
import { useStore } from '../state/store'
import { LiquidWordmark } from './LiquidWordmark'

export function Hero() {
  const h1 = useRef(null)
  const lede = useRef(null)
  const foot = useRef(null)
  const sceneReady = useStore((s) => s.sceneReady)
  const reduced = useStore((s) => s.reducedMotion)

  useEffect(() => {
    if (!sceneReady || !h1.current) return
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.fromTo([h1.current, lede.current, foot.current], { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: 0.15 })
        return
      }
      const split = new SplitText(h1.current, { type: 'lines,chars', linesClass: 'split-line', charsClass: 'split-char' })
      // each letter rises out of the dark like a spark
      gsap.from(split.chars, {
        yPercent: 110,
        opacity: 0,
        filter: 'blur(10px)',
        rotateX: -60,
        duration: 1.6,
        ease: 'expo.out',
        stagger: { each: 0.028, from: 'start' },
        delay: 0.5,
      })
      gsap.from([lede.current, foot.current], { opacity: 0, y: 24, duration: 1.4, ease: 'expo.out', stagger: 0.18, delay: 1.3 })
      // scrolling away lifts the title into the sky
      gsap.to('.hero-inner', {
        yPercent: -35,
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
      })
      return () => split.revert()
    })
    return () => ctx.revert()
  }, [sceneReady, reduced])

  return (
    <section id="hero" className="chapter hero" aria-labelledby="hero-title">
      <LiquidWordmark className="hero-mark" />
      <div className="hero-inner">
        <h1 id="hero-title" ref={h1} className="display text-glow">
          Who do you owe <em>a light?</em>
        </h1>
        <p ref={lede} className="lede text-glow">
          Write a few words to someone you never properly thanked. Light a paper lantern. Send it to them.
        </p>
      </div>
      <div className="hero-foot" ref={foot}>
        <div className="scroll-cue" aria-hidden="true">
          <span>Scroll to descend</span>
          <span className="ember" />
        </div>
        <button type="button" className="text-link" onClick={() => scrollToId('compose')}>
          Skip to writing
        </button>
      </div>
    </section>
  )
}
