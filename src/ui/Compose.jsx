import { useEffect, useRef, useState } from 'react'
import { useStore, PAPERS, MAX_MESSAGE, MAX_NAME, rig } from '../state/store'
import { holdController } from '../lib/hold'
import { useGlassRef } from '../lib/glassRegistry'
import { FlameIcon } from './Icons'

function HoldButton() {
  const ref = useRef(null)
  const text = useStore((s) => s.message.text)
  const [state, setState] = useState({ holding: false, full: false, needsText: false })
  const empty = text.trim().length === 0

  useEffect(
    () =>
      holdController.subscribe((s) => {
        if (ref.current) ref.current.style.setProperty('--p', s.progress.toFixed(3))
        setState((prev) =>
          prev.holding === s.holding && prev.full === s.full && prev.needsText === !!s.needsText
            ? prev
            : { holding: s.holding, full: s.full, needsText: !!s.needsText }
        )
      }),
    []
  )

  const label = empty
    ? 'Write a few words first'
    : state.full
      ? 'Let go to release'
      : state.holding
        ? 'Keep holding…'
        : 'Hold to light'

  const onKeyDown = (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault()
      holdController.start()
    }
  }
  const onKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      holdController.end()
    }
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        className="hold-btn"
        data-empty={empty}
        aria-describedby="hold-help"
        onPointerDown={(e) => {
          e.preventDefault()
          holdController.start()
        }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span>
          {!empty && <FlameIcon />}
          {label}
        </span>
      </button>
      <p id="hold-help" className="hold-hint" aria-live="polite">
        {state.needsText && empty
          ? 'Your lantern needs a message before it can fly.'
          : state.holding && !state.full
            ? 'The paper is filling with warm air…'
            : 'Press and hold (or hold Space) until it glows, then let go.'}
      </p>
    </>
  )
}

/** An invisible button that sits over the 3D lantern, so you can hold the lantern itself. */
function LanternHotspot() {
  const ref = useRef(null)
  const phase = useStore((s) => s.phase)
  useEffect(() => {
    let raf
    const loop = () => {
      const el = ref.current
      if (el) {
        const s = rig.lanternScreen
        const show = s.visible && rig.scroll > 0.93
        el.style.display = show ? 'block' : 'none'
        if (show) {
          el.style.left = `${s.x}px`
          el.style.top = `${s.y}px`
          el.style.height = `${Math.max(80, s.h * 2.1)}px`
          el.style.width = `${Math.max(70, s.h * 1.5)}px`
        }
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  if (phase !== 'story') return null
  return (
    <button
      ref={ref}
      type="button"
      className="lantern-hotspot"
      aria-hidden="true"
      tabIndex={-1}
      onPointerDown={(e) => {
        e.preventDefault()
        holdController.start()
      }}
      onContextMenu={(e) => e.preventDefault()}
    />
  )
}

export function Compose() {
  const message = useStore((s) => s.message)
  const setMessage = useStore((s) => s.setMessage)
  const glassRef = useGlassRef()
  const formRef = useRef(null)
  const glass = (el) => {
    glassRef(el)
    formRef.current = el
  }

  // While the lantern is being lit, the form steps aside: fields fade, the glass
  // clears, and the lantern burns through behind the button.
  useEffect(
    () =>
      holdController.subscribe(({ holding, progress }) => {
        const el = formRef.current
        if (!el) return
        const reveal = holding || progress > 0.02 ? Math.min(1, progress * 2.5 + (holding ? 0.25 : 0)) : 0
        el.dataset.holding = reveal > 0.01 ? 'true' : 'false'
        el.style.setProperty('--reveal', reveal.toFixed(3))
        el.dataset.glassBlur = String(9 * (1 - reveal))
        el.dataset.glassTint = String(0.42 * (1 - reveal * 0.85))
        el.dataset.glassRefract = String(14 + reveal * 10)
      }),
    []
  )

  return (
    <section id="compose" className="chapter compose" aria-labelledby="compose-title">
      <LanternHotspot />
      <form
        ref={glass}
        className="compose-card glass"
        data-glass-blur="9"
        data-glass-tint="0.42"
        onSubmit={(e) => e.preventDefault()}
      >
        <p className="eyebrow">Write your lantern</p>
        <h2 id="compose-title" className="display">
          Who is it <em>for?</em>
        </h2>

        <div className="row">
          <label className="field">
            <span className="field-label">To</span>
            <input
              id="to-input"
              type="text"
              autoComplete="off"
              maxLength={MAX_NAME}
              placeholder="Their name"
              value={message.to}
              onChange={(e) => setMessage({ to: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">From</span>
            <input
              type="text"
              autoComplete="given-name"
              maxLength={MAX_NAME}
              placeholder="Your name"
              value={message.from}
              onChange={(e) => setMessage({ from: e.target.value })}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">
            Message
            <span className="count" aria-live="off">
              {message.text.length}/{MAX_MESSAGE}
            </span>
          </span>
          <textarea
            id="message-input"
            maxLength={MAX_MESSAGE}
            placeholder="Thank you for staying up with me before finals…"
            value={message.text}
            onChange={(e) => setMessage({ text: e.target.value })}
            rows={4}
          />
        </label>

        <fieldset className="papers">
          <legend>Paper</legend>
          <div className="paper-options">
            {Object.entries(PAPERS).map(([key, p]) => (
              <div className="paper-option" key={key}>
                <input
                  type="radio"
                  id={`paper-${key}`}
                  name="paper"
                  value={key}
                  checked={message.paper === key}
                  onChange={() => setMessage({ paper: key })}
                />
                <label htmlFor={`paper-${key}`}>
                  <span className="swatch" style={{ background: p.paper }} />
                  {p.label}
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="hold-zone">
          <HoldButton />
          <div className="compose-alt">
            <button type="button" className="text-link" onClick={() => holdController.lightAndRelease()}>
              Can’t hold? Light and release in one tap
            </button>
          </div>
        </div>
        <p className="privacy-note">
          Your words travel inside the link itself. Nothing is stored, but anyone with the link can read it, so keep it kind and
          keep secrets out.
        </p>
      </form>
    </section>
  )
}
