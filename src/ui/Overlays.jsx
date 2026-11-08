import { useEffect, useRef, useState } from 'react'
import { gsap, SplitText } from '../lib/scroll'
import { rig, useStore } from '../state/store'
import { skipFlight, lightAnother, receive, skipDescent, openLetter } from '../lib/director'
import { useGlassRef } from '../lib/glassRegistry'
import { ShareIcon, CopyIcon, EyeIcon } from './Icons'

function useFadeIn(deps, opts = {}) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const reduced = useStore.getState().reducedMotion
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: reduced ? 0 : 30, filter: reduced ? 'none' : 'blur(8px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: reduced ? 0.4 : 1.4, ease: 'expo.out', delay: opts.delay || 0 }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

/* ---------------------------------------------------------------- */

export function FlightOverlay() {
  const to = useStore((s) => s.message.to)
  const glass = useGlassRef()
  const cap = useRef(null)
  const [showCaption, setShowCaption] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      if (rig.flight > 0.72) {
        setShowCaption(true)
        clearInterval(id)
      }
    }, 100)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!showCaption || !cap.current) return
    const split = new SplitText(cap.current, { type: 'chars', charsClass: 'split-char' })
    gsap.from(split.chars, { opacity: 0, y: 30, filter: 'blur(10px)', stagger: 0.03, duration: 1.2, ease: 'expo.out' })
    return () => split.revert()
  }, [showCaption])

  return (
    <>
      <div className="flight-caption" aria-hidden="true">
        {showCaption && (
          <h2 ref={cap} className="display text-glow">
            On its way{to ? <> to <em>{to}</em></> : ''}.
          </h2>
        )}
      </div>
      <button ref={glass} type="button" className="skip-btn glass" data-glass-radius="999" onClick={skipFlight}>
        Skip
      </button>
    </>
  )
}

/* ---------------------------------------------------------------- */

export function SentPanel() {
  const { to } = useStore((s) => s.message)
  const url = useStore((s) => s.shareUrl)
  const say = useStore((s) => s.say)
  const [copied, setCopied] = useState(false)
  const glass = useGlassRef()
  const card = useFadeIn([], { delay: 0.3 })
  const title = useFadeIn([], { delay: 4.5 })
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    say('Link copied.')
    setTimeout(() => setCopied(false), 2400)
  }

  const share = async () => {
    try {
      await navigator.share({
        title: 'Someone lit a lantern for you',
        text: to ? `${to}, I lit a lantern for you.` : 'I lit a lantern for you.',
        url,
      })
    } catch {
      /* the share sheet was dismissed */
    }
  }

  useEffect(() => {
    document.getElementById('sent-heading')?.focus({ preventScroll: true })
  }, [])

  return (
    <>
      <div className="sent-title" ref={title} aria-hidden="true">
        <h2 className="display text-glow">
          Somewhere, a light is <em>on its way.</em>
        </h2>
      </div>
      <div className="overlay">
        <section
          ref={(el) => {
            glass(el)
            card.current = el
          }}
          className="sent-card glass"
          data-glass-blur="12"
          data-glass-tint="0.58"
          aria-labelledby="sent-heading"
        >
          <p className="eyebrow">Released</p>
          <h2 id="sent-heading" tabIndex={-1} className="display" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', marginBottom: 12 }}>
            {to ? (
              <>
                Now send it to <em>{to}.</em>
              </>
            ) : (
              <>
                Now send it <em>on its way.</em>
              </>
            )}
          </h2>
          <p>When they open your link, the lantern drifts down from the sky to their lake and unfolds into your words.</p>
          <div className="btn-row">
            {canShare ? (
              <button type="button" className="btn primary grow" onClick={share}>
                <ShareIcon /> Send the link
              </button>
            ) : null}
            <button type="button" className={`btn grow ${canShare ? '' : 'primary'}`} onClick={copy}>
              <CopyIcon /> {copied ? 'Copied' : 'Copy link'}
            </button>
            <a className="btn grow" href={url} target="_blank" rel="noopener">
              <EyeIcon /> Preview
            </a>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="text-link" onClick={lightAnother}>
              Light another lantern
            </button>
          </div>
          <p className="fine-print">The message is written into the link itself. Anyone who has the link can read it.</p>
        </section>
      </div>
    </>
  )
}

/* ---------------------------------------------------------------- */

export function ReceiveIntro() {
  const received = useStore((s) => s.received)
  const ref = useFadeIn([], { delay: 0.6 })
  const from = received?.from
  return (
    <div className="overlay center">
      <div className="recv-intro" ref={ref}>
        <p className="eyebrow">{received?.to ? `For ${received.to}` : 'A lantern for you'}</p>
        <h1 className="display text-glow">
          {from ? (
            <>
              {from} lit a lantern <em>for you.</em>
            </>
          ) : (
            <>
              Someone lit a lantern <em>for you.</em>
            </>
          )}
        </h1>
        <p className="lede text-glow">It’s drifting high above the clouds. Bring it down to your lake and open it.</p>
        <button type="button" className="btn primary" style={{ height: 58, padding: '0 34px', fontSize: '1.05rem' }} onClick={receive} autoFocus>
          Bring it down
        </button>
      </div>
    </div>
  )
}

export function ReceiveDescent() {
  const glass = useGlassRef()
  return (
    <button ref={glass} type="button" className="skip-btn glass" data-glass-radius="999" onClick={skipDescent}>
      Skip
    </button>
  )
}

export function ReceiveLanded() {
  const ref = useFadeIn([])
  return (
    <div className="overlay">
      <div ref={ref} className="open-btn">
        <p className="lede text-glow" style={{ margin: '0 auto 18px' }}>
          It has landed. Open the lantern to read it.
        </p>
        <button type="button" className="btn primary" style={{ height: 56, padding: '0 30px' }} onClick={openLetter} autoFocus>
          Open the lantern
        </button>
      </div>
    </div>
  )
}

export function ReceiveError() {
  const glass = useGlassRef()
  return (
    <div className="overlay center">
      <div ref={glass} className="error-card glass">
        <p className="eyebrow">Hmm</p>
        <h1 className="display" style={{ fontSize: '2.2rem', marginBottom: 12 }}>
          This lantern couldn’t be read.
        </h1>
        <p className="lede" style={{ margin: '0 auto 20px' }}>
          The link may have been cut short when it was copied. Ask them to send it again, or light one of your own.
        </p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            history.replaceState(null, '', location.pathname)
            location.reload()
          }}
        >
          Light your own lantern
        </button>
      </div>
    </div>
  )
}
