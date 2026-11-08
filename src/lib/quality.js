export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function detectInitialQuality() {
  if (typeof window === 'undefined') return 'medium'
  const touch = isTouchDevice()
  const small = Math.min(window.innerWidth, window.innerHeight) < 700
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  if (cores <= 2 || mem <= 2) return 'low'
  if (touch || small) return 'medium'
  return 'high'
}

/** Everything that scales with quality, in one place. */
export const TIERS = {
  high: {
    dpr: [1, 2],
    clouds: 1,
    cloudSegments: 34,
    skyLanterns: 360,
    stars: 3200,
    mirrorDetail: true,
    post: true,
    bloomLevels: 8,
    reeds: 220,
    cranes: 14,
    waterLanterns: 46,
    fireflies: 90,
  },
  medium: {
    dpr: [1, 1.5],
    clouds: 0.7,
    cloudSegments: 22,
    skyLanterns: 190,
    stars: 1900,
    mirrorDetail: true,
    post: true,
    bloomLevels: 5,
    reeds: 120,
    cranes: 10,
    waterLanterns: 28,
    fireflies: 60,
  },
  low: {
    dpr: [0.75, 1],
    clouds: 0.45,
    cloudSegments: 12,
    skyLanterns: 90,
    stars: 1000,
    mirrorDetail: false,
    post: false,
    bloomLevels: 0,
    reeds: 60,
    cranes: 6,
    waterLanterns: 14,
    fireflies: 30,
  },
}
