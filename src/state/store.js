import { create } from 'zustand'
import { Color, Vector3 } from 'three'
import { detectInitialQuality, prefersReducedMotion } from '../lib/quality'

/**
 * Per-frame values live in `rig`, a plain mutable object read inside useFrame.
 * GSAP tweens these directly, so animation never triggers React renders.
 */
export const rig = {
  scroll: 0, // 0..1 progress through the story (target, damped in CameraRig)
  scrollMax: 0, // furthest the visitor has scrolled (water lanterns stay lit)
  hold: 0, // 0..1 how far the hold-to-light gesture has progressed
  glow: 0, // 0..1 how lit the hero lantern is (smoothed)
  flight: 0, // 0..1 release flight timeline
  recv: 0, // 0..1 recipient descent timeline
  dawn: 0, // 0..1 dawn ending
  burst: 0, // short flare used on release / open
  pointer: { x: 0, y: 0 },
  cut: 0, // 0..1 fade-to-ink overlay used for reduced-motion cuts
  inkVersion: 0, // bumps when lantern text changes
  afterFlight: 0, // slow drift once the lantern is in the sky
  ripple: 0, // 0..1 ring expansion on the water
  rippleAmp: 0,
  rippleX: 0,
  rippleZ: 0,
  snap: true, // jump the camera to its target on the next frame
  lanternScreen: { x: 0, y: 0, h: 0, visible: false },
  lanternWorld: new Vector3(0, 0.16, 0),
  glowColor: new Color('#ffb060'),
}

export const PAPERS = {
  ivory: { label: 'Ivory', paper: '#f1e4c8', glow: '#ffc27a' },
  saffron: { label: 'Saffron', paper: '#f0b45c', glow: '#ffa53d' },
  rose: { label: 'Rose', paper: '#e8a3a0', glow: '#ff9a7a' },
}

export const MAX_MESSAGE = 240
export const MAX_NAME = 40

// ?quality=high|medium|low pins the graphics tier (handy for testing and for slow devices)
const forced = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('quality') : null
const FORCED = ['high', 'medium', 'low'].includes(forced) ? forced : null

export const useStore = create((set, get) => ({
  // story | flight | sent | recv-intro | recv-descent | recv-landed | recv-letter
  phase: 'story',
  setPhase: (phase) => set({ phase }),

  message: { to: '', text: '', from: '', paper: 'ivory' },
  setMessage: (patch) => {
    set({ message: { ...get().message, ...patch } })
    rig.inkVersion++
  },

  received: null, // decoded message when visiting a lantern link
  receiveError: false,

  quality: FORCED || detectInitialQuality(), // high | medium | low
  qualityMode: FORCED ? (FORCED === 'medium' ? 'auto' : FORCED) : 'auto', // auto | high | low
  setQualityMode: (qualityMode) => {
    if (qualityMode === 'auto') set({ qualityMode, quality: detectInitialQuality() })
    else set({ qualityMode, quality: qualityMode })
  },
  degrade: () => {
    const { quality, qualityMode } = get()
    if (qualityMode !== 'auto' || FORCED) return
    if (quality === 'high') set({ quality: 'medium' })
    else if (quality === 'medium') set({ quality: 'low' })
  },

  reducedMotion: prefersReducedMotion(),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  sound: false,
  setSound: (sound) => set({ sound }),

  sceneReady: false,
  setSceneReady: () => set({ sceneReady: true }),

  announce: '',
  say: (announce) => set({ announce }),

  shareUrl: '',
  setShareUrl: (shareUrl) => set({ shareUrl }),

  creditsOpen: false,
  setCreditsOpen: (creditsOpen) => set({ creditsOpen }),
}))
