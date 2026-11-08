import * as THREE from 'three'

/* Small deterministic PRNG so procedural textures look the same every visit. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let cloudUrl = null
/** Soft cloud puff with billowy internal detail, handed to drei <Clouds> as a data URL. */
export function cloudTextureUrl() {
  if (cloudUrl) return cloudUrl
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const rnd = mulberry32(7)
  // a broad soft body
  const body = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  body.addColorStop(0, 'rgba(255,255,255,0.75)')
  body.addColorStop(0.45, 'rgba(255,255,255,0.45)')
  body.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = body
  g.fillRect(0, 0, s, s)
  // billows layered on top
  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 28; i++) {
    const a = rnd() * Math.PI * 2
    const d = Math.pow(rnd(), 0.9) * s * 0.22
    const x = s / 2 + Math.cos(a) * d
    const y = s / 2 + Math.sin(a) * d * 0.75
    const r = s * (0.12 + rnd() * 0.16)
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.12)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  g.globalCompositeOperation = 'destination-in'
  const mask = g.createRadialGradient(s / 2, s / 2, s * 0.12, s / 2, s / 2, s / 2)
  mask.addColorStop(0, 'rgba(0,0,0,1)')
  mask.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = mask
  g.fillRect(0, 0, s, s)
  cloudUrl = c.toDataURL('image/png')
  return cloudUrl
}

let fiberTex = null
/** Rice-paper fibre texture: long thin strands plus fine grain, tileable-ish. */
export function paperFiberTexture() {
  if (fiberTex) return fiberTex
  const s = 512
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  g.fillStyle = 'rgb(128,128,128)'
  g.fillRect(0, 0, s, s)
  const rnd = mulberry32(42)
  const img = g.getImageData(0, 0, s, s)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 128 + (rnd() - 0.5) * 34
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n
  }
  g.putImageData(img, 0, 0)
  g.lineCap = 'round'
  for (let i = 0; i < 900; i++) {
    const x = rnd() * s
    const y = rnd() * s
    const len = 8 + rnd() * 60
    const ang = (rnd() - 0.5) * 1.4 + Math.PI / 2
    const bright = rnd() > 0.5
    g.strokeStyle = bright ? `rgba(255,255,255,${0.05 + rnd() * 0.12})` : `rgba(0,0,0,${0.04 + rnd() * 0.1})`
    g.lineWidth = 0.4 + rnd() * 1.2
    g.beginPath()
    g.moveTo(x, y)
    g.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + (rnd() - 0.5) * 10, y + Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    g.stroke()
  }
  fiberTex = new THREE.CanvasTexture(c)
  fiberTex.wrapS = fiberTex.wrapT = THREE.RepeatWrapping
  fiberTex.colorSpace = THREE.NoColorSpace
  fiberTex.anisotropy = 4
  return fiberTex
}

/* ------------------------------------------------------------------ */
/* Lantern ink: the visitor's words, brushed onto the paper.           */
/* ------------------------------------------------------------------ */

export const INK_W = 1024
export const INK_H = 512

function wrapLines(g, text, maxWidth, maxLines) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
      if (lines.length === maxLines) break
    } else line = test
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'
  }
  return lines
}

/**
 * Draws white "ink" on black into the given canvas. The canvas covers the
 * lantern's circumference (u) and height (v); the text sits at u≈0.5, which
 * we rotate to face the camera.
 */
export function drawInk(canvas, { to, text, from }) {
  const g = canvas.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, INK_W, INK_H)
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const cx = INK_W / 2
  // The visible face spans roughly a quarter of the circumference.
  const faceW = INK_W * 0.24
  let y = INK_H * 0.34
  if (to) {
    g.font = `500 22px "Inter Variable", system-ui, sans-serif`
    g.globalAlpha = 0.85
    g.fillText(`for ${to}`.toUpperCase().split('').join(String.fromCharCode(8202)), cx, y)
    y += 34
  }
  const body = text || ''
  if (body) {
    const size = body.length > 140 ? 21 : body.length > 70 ? 25 : 30
    g.font = `italic 420 ${size}px "Fraunces Variable", Georgia, serif`
    g.globalAlpha = 0.95
    const lines = wrapLines(g, body, faceW, body.length > 140 ? 9 : 7)
    const lh = size * 1.22
    for (const l of lines) {
      g.fillText(l, cx, y + lh / 2)
      y += lh
    }
  }
  if (from) {
    y += 14
    g.font = `italic 400 22px "Fraunces Variable", Georgia, serif`
    g.globalAlpha = 0.85
    g.fillText(`— ${from}`, cx, y)
  }
  g.globalAlpha = 1
}
