import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, Noise, ToneMapping } from '@react-three/postprocessing'
import { BlendFunction, KernelSize, ToneMappingMode } from 'postprocessing'
import { LiquidGlassEffect, MAX_GLASS } from './LiquidGlassEffect'
import { glassRegistry } from '../lib/glassRegistry'
import { rig } from '../state/store'

function LiquidGlass() {
  const effect = useMemo(() => new LiquidGlassEffect(), [])

  useEffect(() => {
    document.documentElement.classList.add('live-glass')
    return () => document.documentElement.classList.remove('live-glass')
  }, [])

  useFrame((state) => {
    const u = effect.uniforms
    const rects = u.get('uRects').value
    const style = u.get('uStyle').value
    const alpha = u.get('uAlpha').value
    const buf = state.gl.domElement
    const scale = buf.width / window.innerWidth
    const vh = window.innerHeight
    let n = 0
    for (const el of glassRegistry.elements) {
      if (n >= MAX_GLASS) break
      if (!el.isConnected || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.bottom < 0 || r.top > vh) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden') continue
      let op = parseFloat(cs.opacity)
      // include ancestor fades (panels inside fading wrappers)
      let p = el.parentElement
      for (let k = 0; p && k < 4; k++, p = p.parentElement) op *= parseFloat(getComputedStyle(p).opacity)
      if (op < 0.02) continue
      const ds = el.dataset
      rects[n].set(r.left * scale, (vh - r.bottom) * scale, r.width * scale, r.height * scale)
      style[n].set(
        parseFloat(ds.glassRadius || cs.borderTopLeftRadius || 24) * scale,
        parseFloat(ds.glassBlur || 7) * scale,
        parseFloat(ds.glassTint || 0.38),
        parseFloat(ds.glassRefract || 14) * scale
      )
      alpha[n] = op
      n++
    }
    u.get('uCount').value = n
  })

  return <primitive object={effect} dispose={null} />
}

export function Effects({ levels = 8 }) {
  const bloomRef = useMemo(() => ({ current: null }), [])
  useFrame(() => {
    // the release swells the bloom for a moment
    if (bloomRef.current) bloomRef.current.intensity = 1.05 + rig.burst * 1.8
  })
  return (
    <EffectComposer multisampling={0} disableNormalPass>
      <Bloom
        ref={(b) => (bloomRef.current = b)}
        mipmapBlur
        levels={levels}
        intensity={1.05}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.35}
        radius={0.78}
        kernelSize={KernelSize.LARGE}
      />
      <LiquidGlass />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.22} darkness={0.72} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.07} />
    </EffectComposer>
  )
}
