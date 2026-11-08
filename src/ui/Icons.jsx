const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const SoundOn = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M4 10v4h3l5 4V6L7 10H4z" />
    <path d="M16 9c1.2 1.6 1.2 4.4 0 6M18.6 6.5c2.6 3 2.6 8 0 11" />
  </svg>
)
export const SoundOff = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M4 10v4h3l5 4V6L7 10H4z" />
    <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
  </svg>
)
export const MotionIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M3 12c3-6 6-6 9 0s6 6 9 0" />
  </svg>
)
export const StillIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M3 12h18" />
  </svg>
)
export const InfoIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.01" />
  </svg>
)
export const ShareIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
  </svg>
)
export const CopyIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <rect x="8" y="8" width="12" height="12" rx="2.5" />
    <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
  </svg>
)
export const EyeIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const FlameIcon = (props) => (
  <svg viewBox="0 0 16 20" className="flame-ico" aria-hidden="true" {...props}>
    <path
      d="M8 1c.5 3 4.5 5 4.5 10A4.5 4.5 0 013.5 11C3.5 8 5.5 7 6 4c1 1.5 1.6 2.6 1.6 4C9 6.5 8.6 3.5 8 1z"
      fill="currentColor"
    />
  </svg>
)
