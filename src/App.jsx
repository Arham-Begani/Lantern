import { lazy, Suspense, useEffect, useState } from 'react'
import { rig, useStore } from './state/store'
import { hasWebGL } from './lib/quality'
import { readLanternFromLocation } from './lib/codec'
import { initLenis, destroyLenis, ScrollTrigger } from './lib/scroll'
import { Story } from './ui/Story'
import { Topbar, CutOverlay, LiveRegion, Credits } from './ui/Chrome'
import { FlightOverlay, SentPanel, ReceiveIntro, ReceiveDescent, ReceiveLanded, ReceiveError } from './ui/Overlays'
import { Letter } from './ui/Letter'
import { FallbackScene } from './ui/Fallback'
import './lib/director'

const Experience = lazy(() => import('./scene/Experience'))
const Veil = lazy(() => import('./ui/Veil'))

// Decide the mode before the first render, from the link itself.
const boot = readLanternFromLocation()
if (boot.present) {
  if (boot.lantern) useStore.setState({ received: boot.lantern, phase: 'recv-intro' })
  else useStore.setState({ receiveError: true, phase: 'recv-intro' })
}
const WEBGL = hasWebGL()

function Preloader() {
  const ready = useStore((s) => s.sceneReady)
  const [minTime, setMinTime] = useState(false)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMinTime(true), 1400)
    return () => clearTimeout(t)
  }, [])
  const done = (ready || !WEBGL) && minTime
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setGone(true), 1800)
    return () => clearTimeout(t)
  }, [done])
  if (gone) return null
  return (
    <div className={`preloader ${done ? 'done' : ''}`} aria-hidden={done} role="status">
      {WEBGL && (
        <Suspense fallback={null}>
          <div className="preloader-gradient">
            <Veil />
          </div>
        </Suspense>
      )}
      <div className="preloader-inner">
        <p className="preloader-word">LANTERN</p>
        <div className="preloader-bar" />
        <p className="sr-only">Lighting the lake…</p>
      </div>
    </div>
  )
}

function RecvVeil() {
  const phase = useStore((s) => s.phase)
  const [mounted, setMounted] = useState(true)
  const visible = phase === 'recv-intro'
  useEffect(() => {
    if (visible) return
    const t = setTimeout(() => setMounted(false), 2600)
    return () => clearTimeout(t)
  }, [visible])
  if (!mounted || !WEBGL) return null
  return (
    <div className="recv-veil" style={{ opacity: visible ? 0.82 : 0 }} aria-hidden="true">
      <Suspense fallback={null}>
        <Veil />
      </Suspense>
      <div className="recv-veil-shade" />
    </div>
  )
}

export default function App() {
  const phase = useStore((s) => s.phase)
  const reduced = useStore((s) => s.reducedMotion)
  const receiveError = useStore((s) => s.receiveError)
  const isStory = phase === 'story' || phase === 'flight' || phase === 'sent'

  // smooth scrolling only exists while the story is on screen
  useEffect(() => {
    if (!isStory) {
      destroyLenis()
      document.body.classList.add('locked')
      return
    }
    document.body.classList.remove('locked')
    const lenis = initLenis(reduced)
    if (phase !== 'story') lenis.stop()
    requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => destroyLenis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStory, reduced])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduced)
  }, [reduced])

  // follow the OS setting if it changes while the page is open
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fn = (e) => useStore.getState().setReducedMotion(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  // gentle parallax from the pointer (desktop) — the scene itself never takes pointer events
  useEffect(() => {
    const fn = (e) => {
      if (e.pointerType !== 'mouse') return
      rig.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      rig.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', fn, { passive: true })
    return () => window.removeEventListener('pointermove', fn)
  }, [])

  return (
    <>
      {isStory && (
        <a className="skip-link" href="#compose">
          Skip to writing your lantern
        </a>
      )}
      <div className="scene-poster" aria-hidden="true" />
      {WEBGL ? (
        <div className="scene-layer">
          <Suspense fallback={null}>
            <Experience />
          </Suspense>
        </div>
      ) : (
        <FallbackScene />
      )}

      <Topbar />

      {isStory && (
        <div
          style={{
            opacity: phase === 'story' ? 1 : 0,
            pointerEvents: phase === 'story' ? 'auto' : 'none',
            transition: 'opacity 0.9s ease',
          }}
          aria-hidden={phase !== 'story'}
        >
          <Story />
        </div>
      )}

      {phase === 'flight' && <FlightOverlay />}
      {phase === 'sent' && <SentPanel />}

      {phase.startsWith('recv') && <RecvVeil />}
      {phase === 'recv-intro' && (receiveError ? <ReceiveError /> : <ReceiveIntro />)}
      {phase === 'recv-descent' && <ReceiveDescent />}
      {phase === 'recv-landed' && <ReceiveLanded />}
      {phase === 'recv-letter' && <Letter />}

      <CutOverlay />
      <Credits />
      <LiveRegion />
      <Preloader />
    </>
  )
}
