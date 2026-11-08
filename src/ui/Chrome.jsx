import { useEffect, useRef } from 'react'
import { rig, useStore } from '../state/store'
import { sound } from '../lib/sound'
import { scrollToId } from '../lib/scroll'
import { useGlassRef } from '../lib/glassRegistry'
import { SoundOn, SoundOff, MotionIcon, StillIcon, InfoIcon } from './Icons'

export function Topbar() {
  const soundOn = useStore((s) => s.sound)
  const setSound = useStore((s) => s.setSound)
  const reduced = useStore((s) => s.reducedMotion)
  const setReduced = useStore((s) => s.setReducedMotion)
  const quality = useStore((s) => s.quality)
  const qualityMode = useStore((s) => s.qualityMode)
  const setQualityMode = useStore((s) => s.setQualityMode)
  const setCredits = useStore((s) => s.setCreditsOpen)
  const phase = useStore((s) => s.phase)
  const glass = useGlassRef()

  const toggleSound = async () => {
    const next = !soundOn
    setSound(next)
    await sound.setEnabled(next)
    if (next && (phase === 'sent' || phase.startsWith('recv'))) sound.pad(true)
  }
  const nextQuality = { auto: 'high', high: 'low', low: 'auto' }
  const qLabel = qualityMode === 'auto' ? `Auto` : qualityMode === 'high' ? 'High' : 'Low'

  return (
    <header className="topbar">
      <button
        type="button"
        className="brand"
        onClick={() => (phase === 'story' ? scrollToId('hero') : null)}
        aria-label="Lantern, back to the top"
      >
        <span className="brand-dot" aria-hidden="true" />
        Lantern
      </button>
      <div ref={glass} className="dock glass" role="toolbar" aria-label="Experience settings" data-glass-radius="999" data-glass-blur="6">
        <button type="button" className="dock-btn" aria-pressed={soundOn} aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'} onClick={toggleSound}>
          {soundOn ? <SoundOn /> : <SoundOff />}
        </button>
        <button
          type="button"
          className="dock-btn"
          aria-pressed={reduced}
          aria-label={reduced ? 'Turn full motion back on' : 'Reduce motion'}
          title={reduced ? 'Motion reduced' : 'Reduce motion'}
          onClick={() => setReduced(!reduced)}
        >
          {reduced ? <StillIcon /> : <MotionIcon />}
        </button>
        <button
          type="button"
          className="dock-btn"
          aria-label={`Graphics quality: ${qLabel}${qualityMode === 'auto' ? ` (currently ${quality})` : ''}. Change.`}
          title="Graphics quality"
          onClick={() => setQualityMode(nextQuality[qualityMode])}
        >
          {qLabel === 'Auto' ? 'AUTO' : qLabel === 'High' ? 'HD' : 'LITE'}
        </button>
        <button type="button" className="dock-btn" aria-label="About and credits" onClick={() => setCredits(true)}>
          <InfoIcon />
        </button>
      </div>
    </header>
  )
}

export function CutOverlay() {
  const ref = useRef(null)
  useEffect(() => {
    let raf
    const loop = () => {
      if (ref.current) ref.current.style.opacity = rig.cut.toFixed(3)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div ref={ref} className="cut-overlay" aria-hidden="true" />
}

export function LiveRegion() {
  const msg = useStore((s) => s.announce)
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {msg}
    </div>
  )
}

export function Credits() {
  const open = useStore((s) => s.creditsOpen)
  const setOpen = useStore((s) => s.setCreditsOpen)
  const closeRef = useRef(null)
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal glass" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="credits-title" className="display">
          About <em>Lantern</em>
        </h2>
        <p>
          A small place to thank someone. Your message is encoded into the link you send, after the “#”, which browsers never send to
          a server. Nothing is stored anywhere. The lanterns drifting in the sky are decoration, not other people’s messages.
        </p>
        <p>Built with AI and deployed on Embarko. The sound is synthesised live in your browser.</p>
        <h3 className="eyebrow" style={{ marginTop: 20 }}>
          Made with
        </h3>
        <ul>
          <li>
            <a href="https://github.com/pmndrs/react-three-fiber" target="_blank" rel="noopener">React Three Fiber</a>,{' '}
            <a href="https://github.com/pmndrs/drei" target="_blank" rel="noopener">drei</a>,{' '}
            <a href="https://github.com/pmndrs/react-postprocessing" target="_blank" rel="noopener">react-postprocessing</a> and three.js (MIT)
          </li>
          <li>
            Live glass refraction adapted from{' '}
            <a href="https://github.com/dashersw/liquid-glass-js" target="_blank" rel="noopener">liquid-glass-js</a> (MIT © 2025 Armagan Amcalar)
          </li>
          <li>
            Liquid-metal wordmark: <a href="https://github.com/paper-design/shaders" target="_blank" rel="noopener">Paper Shaders</a>{' '}
            (Apache-2.0), inspired by{' '}
            <a href="https://github.com/paper-design/liquid-logo" target="_blank" rel="noopener">Liquid Logo</a>
          </li>
          <li>
            Dusk veil: <a href="https://github.com/ruucm/shadergradient" target="_blank" rel="noopener">ShaderGradient</a> (MIT)
          </li>
          <li>
            <a href="https://github.com/FarazzShaikh/THREE-CustomShaderMaterial" target="_blank" rel="noopener">three-custom-shader-material</a> (MIT),{' '}
            <a href="https://github.com/darkroomengineering/lenis" target="_blank" rel="noopener">Lenis</a> (MIT),{' '}
            <a href="https://gsap.com" target="_blank" rel="noopener">GSAP</a> (GreenSock standard no-charge license)
          </li>
          <li>Fraunces and Inter typefaces (SIL Open Font License)</li>
        </ul>
        <button ref={closeRef} type="button" className="btn" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  )
}
