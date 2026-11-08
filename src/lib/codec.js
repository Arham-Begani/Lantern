import { MAX_MESSAGE, MAX_NAME, PAPERS } from '../state/store'

/*
 * A lantern lives entirely inside its link: the part after "#" is never sent
 * to the server. It is encoded, not encrypted: anyone with the link can read it.
 */

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64) {
  const norm = b64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(norm + '==='.slice((norm.length + 3) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const clean = (s, max) =>
  String(s ?? '')
    // strip control characters except newlines
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .slice(0, max)

export function encodeLantern({ to, text, from, paper }) {
  const payload = JSON.stringify({
    v: 1,
    t: clean(to, MAX_NAME).trim(),
    m: clean(text, MAX_MESSAGE).trim(),
    f: clean(from, MAX_NAME).trim(),
    p: PAPERS[paper] ? paper : 'ivory',
  })
  return toBase64Url(payload)
}

export function decodeLantern(code) {
  if (!code || code.length > 4000) return null
  try {
    const o = JSON.parse(fromBase64Url(code))
    if (!o || o.v !== 1) return null
    const m = clean(o.m, MAX_MESSAGE).trim()
    if (!m) return null
    return {
      to: clean(o.t, MAX_NAME).trim(),
      text: m,
      from: clean(o.f, MAX_NAME).trim(),
      paper: PAPERS[o.p] ? o.p : 'ivory',
    }
  } catch {
    return null
  }
}

export function lanternUrl(message) {
  const base = `${location.origin}${location.pathname}`
  return `${base}#l=${encodeLantern(message)}`
}

export function readLanternFromLocation() {
  const hash = location.hash || ''
  const m = hash.match(/[#&]l=([A-Za-z0-9_-]+)/)
  if (!m) return { present: false, lantern: null }
  return { present: true, lantern: decodeLantern(m[1]) }
}
