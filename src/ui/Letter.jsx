import { useEffect, useRef } from 'react'
import { gsap, SplitText } from '../lib/scroll'
import { useStore } from '../state/store'
import { lightOneBack } from '../lib/director'

/*
 * The lantern's paper unfolds into a letter: a sheet folded in thirds opens
 * bottom flap first, then top, and the words appear like fresh ink.
 */
export function Letter() {
  const received = useStore((s) => s.received)
  const reduced = useStore((s) => s.reducedMotion)
  const top = useRef(null)
  const bot = useRef(null)
  const sheet = useRef(null)
  const body = useRef(null)
  const actions = useRef(null)
  const heading = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set([top.current, bot.current], { display: 'none' })
        gsap.from([sheet.current, actions.current], { opacity: 0, duration: 0.6, stagger: 0.2 })
        return
      }
      const split = new SplitText(body.current, { type: 'words', wordsClass: 'split-word' })
      const tl = gsap.timeline({ delay: 0.2 })
      tl.from(sheet.current, { scale: 0.32, y: 120, rotateX: 18, opacity: 0, duration: 1.1, ease: 'expo.out' })
        .fromTo(bot.current, { rotateX: -178 }, { rotateX: 0, duration: 1.1, ease: 'power3.inOut' }, '-=0.35')
        .fromTo(top.current, { rotateX: 178 }, { rotateX: 0, duration: 1.1, ease: 'power3.inOut' }, '-=0.55')
        .set([top.current, bot.current], { display: 'none' })
        .from('.letter-for', { opacity: 0, y: 8, duration: 0.6 })
        .from(split.words, { opacity: 0, filter: 'blur(6px)', y: 6, stagger: 0.045, duration: 0.7, ease: 'power2.out' }, '-=0.2')
        .from('.letter-from', { opacity: 0, x: 10, duration: 0.8 }, '-=0.3')
        .from(actions.current, { opacity: 0, y: 16, duration: 0.8, ease: 'expo.out' }, '-=0.3')
      return () => split.revert()
    })
    heading.current?.focus({ preventScroll: true })
    return () => ctx.revert()
  }, [reduced])

  if (!received) return null
  return (
    <div className="letter-wrap" role="dialog" aria-modal="false" aria-labelledby="letter-heading">
      <div>
        <div className="letter-stage">
          <article className="letter" ref={sheet}>
            <div className="letter-panel letter-sheet">
              <h1 id="letter-heading" className="letter-for" ref={heading} tabIndex={-1}>
                {received.to ? `For ${received.to}` : 'For you'}
              </h1>
              <p className="letter-body" ref={body}>
                {received.text}
              </p>
              {received.from && <p className="letter-from">— {received.from}</p>}
              <span className="letter-fold-line" style={{ top: '33.3%' }} aria-hidden="true" />
              <span className="letter-fold-line" style={{ top: '66.6%' }} aria-hidden="true" />
            </div>
            <div className="letter-panel top" ref={top} aria-hidden="true" />
            <div className="letter-panel bot" ref={bot} aria-hidden="true" />
          </article>
        </div>
        <div className="letter-actions" ref={actions}>
          <button type="button" className="btn primary" onClick={lightOneBack}>
            {received.from ? `Light one back for ${received.from}` : 'Light one back'}
          </button>
        </div>
      </div>
    </div>
  )
}
