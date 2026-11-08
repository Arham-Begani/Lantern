import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger, SplitText, scrollToId } from '../lib/scroll'
import { rig, useStore } from '../state/store'
import { Hero } from './Hero'
import { Compose } from './Compose'

const CHAPTERS = [
  { id: 'hero', label: 'Arrive' },
  { id: 'descent', label: 'Descend' },
  { id: 'lake', label: 'The lake' },
  { id: 'compose', label: 'Write' },
]

const DESCENT_LINES = [
  <>Some people <em>stayed.</em></>,
  <>Some people <em>helped.</em></>,
  <>Some people never heard <em>“thank you.”</em></>,
]

export function Story() {
  const root = useRef(null)
  const reduced = useStore((s) => s.reducedMotion)
  const sceneReady = useStore((s) => s.sceneReady)
  const [current, setCurrent] = useState('hero')

  // overall progress drives the camera
  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: root.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => (rig.scroll = self.progress),
    })
    rig.scroll = st.progress
    const chapterTriggers = CHAPTERS.map((c) =>
      ScrollTrigger.create({
        trigger: `#${c.id}`,
        start: 'top 55%',
        end: 'bottom 55%',
        onToggle: (self) => self.isActive && setCurrent(c.id),
      })
    )
    return () => {
      st.kill()
      chapterTriggers.forEach((t) => t.kill())
    }
  }, [])

  // chapter typography choreography
  useEffect(() => {
    if (!sceneReady) return
    const ctx = gsap.context(() => {
      const lines = gsap.utils.toArray('.descent-line')
      const tl = gsap.timeline({
        scrollTrigger: { trigger: '#descent', start: 'top top', end: 'bottom bottom', scrub: reduced ? false : 0.8 },
      })
      lines.forEach((el, i) => {
        if (reduced) {
          tl.to(el, { opacity: 1, duration: 0.4 }, i * 1.2).to(el, { opacity: 0, duration: 0.4 }, i * 1.2 + 1)
          return
        }
        const split = new SplitText(el, { type: 'words', wordsClass: 'split-word' })
        tl.set(el, { opacity: 1 }, i * 1.2)
          .fromTo(
            split.words,
            { opacity: 0, y: 40, filter: 'blur(12px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', stagger: 0.08, duration: 0.5, ease: 'power3.out' },
            i * 1.2
          )
          .to(split.words, { opacity: 0, y: -30, filter: 'blur(10px)', stagger: 0.05, duration: 0.4, ease: 'power2.in' }, i * 1.2 + 0.85)
      })
      tl.to({}, { duration: 0.3 })

      const lakeTl = gsap.timeline({
        scrollTrigger: { trigger: '#lake', start: 'top 70%', end: 'bottom bottom', scrub: reduced ? false : 0.8 },
      })
      if (reduced) {
        lakeTl.from('.lake-copy > *', { opacity: 0, duration: 0.5, stagger: 0.2 })
      } else {
        const split = new SplitText('.lake-copy h2', { type: 'lines,words', linesClass: 'split-line', wordsClass: 'split-word' })
        lakeTl
          .from(split.words, { yPercent: 120, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' })
          .from('.lake-copy .lede', { opacity: 0, y: 20, duration: 0.5 }, '-=0.2')
          .to({}, { duration: 0.6 })
          .to('.lake-copy', { opacity: 0, y: -40, duration: 0.5, ease: 'power2.in' })
      }
    }, root)
    return () => ctx.revert()
  }, [sceneReady, reduced])

  return (
    <>
      <nav className="chapter-nav" aria-label="Chapters">
        {CHAPTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-current={current === c.id ? 'true' : undefined}
            onClick={() => scrollToId(c.id)}
          >
            <span>{c.label}</span>
            <i aria-hidden="true" />
          </button>
        ))}
      </nav>
      <main ref={root} className="story" id="story">
        <Hero />
        <section id="descent" className="chapter descent" aria-label="Descent">
          <div className="sticky-frame">
            {DESCENT_LINES.map((l, i) => (
              <p key={i} className="descent-line display text-glow">
                {l}
              </p>
            ))}
          </div>
        </section>
        <section id="lake" className="chapter lake" aria-labelledby="lake-title">
          <div className="sticky-frame center">
            <div className="lake-copy">
              <h2 id="lake-title" className="display text-glow">
                Write it. Light it. <em>Let it go.</em>
              </h2>
              <p className="lede text-glow">
                Your words live only inside the link you send. No account. Nothing kept on a server.
              </p>
            </div>
          </div>
        </section>
        <Compose />
      </main>
    </>
  )
}
