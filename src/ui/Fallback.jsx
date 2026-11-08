import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'

/*
 * For browsers without WebGL: the same story, palette and gestures, drawn
 * with CSS and SVG. Sending and receiving lanterns work exactly the same.
 */

const RIDGES = [
  { fill: '#363a68', d: 'M0 120 L80 70 L160 95 L260 40 L340 80 L420 55 L520 90 L600 45 L700 85 L800 60 L800 200 L0 200Z', speed: 0.05 },
  { fill: '#1d2147', d: 'M0 140 L90 100 L170 125 L250 85 L360 120 L450 95 L560 130 L650 100 L740 125 L800 110 L800 200 L0 200Z', speed: 0.1 },
  { fill: '#0f1230', d: 'M0 160 L70 140 L140 150 L220 128 L300 152 L380 136 L470 156 L560 138 L660 154 L740 140 L800 150 L800 200 L0 200Z', speed: 0.18 },
]

export function FallbackScene() {
  const phase = useStore((s) => s.phase)
  const ridges = useRef([])
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      ridges.current.forEach((el, i) => el && (el.style.transform = `translateY(${y * RIDGES[i].speed * -0.4}px)`))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const flown = phase === 'flight' || phase === 'sent'
  const waiting = phase === 'recv-intro'
  return (
    <div className="fallback-scene" aria-hidden="true">
      <div className="fallback-stars" />
      <div className="fallback-moon" />
      {RIDGES.map((r, i) => (
        <div key={i} className="fallback-ridge" ref={(el) => (ridges.current[i] = el)} style={{ bottom: `${8 + i * 2}%` }}>
          <svg viewBox="0 0 800 200" preserveAspectRatio="none">
            <path d={r.d} fill={r.fill} />
          </svg>
        </div>
      ))}
      <div className="fallback-ridge" style={{ bottom: 0, height: '12%', background: 'linear-gradient(180deg,#0c1628,#06080f)' }} />
      <div className={`fallback-lantern ${flown || waiting ? 'flown' : ''} ${phase === 'story' ? 'dim' : ''}`} />
    </div>
  )
}
