import { useEffect, useMemo, useRef, useState } from 'react'
import { ShaderMount } from '@paper-design/shaders-react'
import {
  liquidMetalFragmentShader,
  toProcessedLiquidMetal,
  getShaderColorFromString,
  ShaderFitOptions,
  LiquidMetalShapes,
  defaultObjectSizing,
} from '@paper-design/shaders'
import { hasWebGL } from '../lib/quality'

const WEBGL = typeof window !== 'undefined' && hasWebGL()

/*
 * The LANTERN wordmark in molten gold, rendered with the Paper Shaders
 * liquid-metal shader (Apache-2.0). Liquid Logo (paper-design/liquid-logo)
 * is the visual reference; its app code is not used.
 *
 * We run the shader through ShaderMount ourselves so the processed mask is
 * handed over as a data: URL. (The packaged component uses a blob: URL,
 * which hosts with a strict Content-Security-Policy, Embarko included, block.)
 */

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })

async function makeProcessedMask(text) {
  const raw = await makeWordmarkImage(text)
  const { pngBlob } = await toProcessedLiquidMetal(raw)
  return blobToDataUrl(pngBlob)
}

const METAL = {
  u_colorBack: getShaderColorFromString('#00000000'),
  u_colorTint: getShaderColorFromString('#ffc777'),
  u_repetition: 2,
  u_softness: 0.55,
  u_shiftRed: 0.12,
  u_shiftBlue: -0.12,
  u_distortion: 0.1,
  u_contour: 0.5,
  u_angle: 72,
  u_isImage: true,
  u_shape: LiquidMetalShapes.none,
  u_fit: ShaderFitOptions.contain,
  u_scale: 0.98,
  u_rotation: defaultObjectSizing.rotation,
  u_offsetX: defaultObjectSizing.offsetX,
  u_offsetY: defaultObjectSizing.offsetY,
  u_originX: defaultObjectSizing.originX,
  u_originY: defaultObjectSizing.originY,
  u_worldWidth: defaultObjectSizing.worldWidth,
  u_worldHeight: defaultObjectSizing.worldHeight,
}

async function makeWordmarkImage(text) {
  await document.fonts.load('900 200px "Fraunces Variable"').catch(() => {})
  const c = document.createElement('canvas')
  const W = 2000
  const H = 440
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.clearRect(0, 0, W, H)
  g.fillStyle = '#000'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = 300
  const spacing = 0.1
  const letters = text.split('')
  const measure = () => {
    g.font = `900 ${size}px "Fraunces Variable", Georgia, serif`
    return letters.reduce((w, ch) => w + g.measureText(ch).width, 0) + size * spacing * (letters.length - 1)
  }
  while (measure() > W * 0.9) size -= 8
  const total = measure()
  let x = (W - total) / 2
  for (const ch of letters) {
    const w = g.measureText(ch).width
    g.fillText(ch, x + w / 2, H / 2 + size * 0.04)
    x += w + size * spacing
  }
  return c.toDataURL('image/png')
}

export function LiquidWordmark({ text = 'LANTERN', className = '', active: activeProp = true }) {
  const active = activeProp && WEBGL
  const [img, setImg] = useState('')
  const [ok, setOk] = useState(false)
  const ref = useRef(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!WEBGL) return
    let alive = true
    makeProcessedMask(text)
      .then((u) => alive && setImg(u))
      .catch(() => {}) // keep the CSS gold wordmark
    return () => {
      alive = false
    }
  }, [text])
  const uniforms = useMemo(() => ({ ...METAL, u_image: img }), [img])

  // stop the shader entirely when the wordmark scrolls out of view
  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!img) return
    const t = setTimeout(() => setOk(true), 900)
    return () => clearTimeout(t)
  }, [img])

  return (
    <div ref={ref} className={className} role="img" aria-label={text}>
      <div className="hero-mark-fallback" style={{ opacity: ok && active ? 0 : 1 }} aria-hidden="true">
        {text}
      </div>
      {img && visible && active && (
        <ShaderMount
          fragmentShader={liquidMetalFragmentShader}
          uniforms={uniforms}
          mipmaps={['u_image']}
          speed={0.55}
          maxPixelCount={1600 * 400}
          style={{ position: 'absolute', inset: 0, filter: 'brightness(1.65) saturate(1.15) drop-shadow(0 0 18px rgba(255, 170, 80, 0.35))' }}
        />
      )}
    </div>
  )
}
