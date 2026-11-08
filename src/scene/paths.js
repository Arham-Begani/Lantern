import * as THREE from 'three'

/*
 * World layout (metres, roughly):
 *   lake surface        y = 0, stretching away toward -z
 *   the hero lantern    rests on a flat stone at the origin
 *   cloud deck          y ≈ 30 – 50
 *   sky lanterns        y ≈ 55 – 150 (above the cloud sea)
 *   mountain ridges     z = -40 … -280, the farthest peaks pierce the clouds
 */

export const LANTERN_HOME = new THREE.Vector3(0, 0.16, 0)
export const LANTERN_SCALE = 0.9

const v = (x, y, z) => new THREE.Vector3(x, y, z)

/** Piecewise Catmull-Rom path keyed by progress values. */
export class KeyedPath {
  constructor(keys) {
    this.keys = keys
    this.pos = new THREE.CatmullRomCurve3(keys.map((k) => k.pos), false, 'centripetal', 0.5)
    this.look = new THREE.CatmullRomCurve3(keys.map((k) => k.look), false, 'centripetal', 0.5)
  }
  /** Map a progress value p (0..1, keyed) to curve parameter t (0..1, uniform per segment). */
  param(p) {
    const k = this.keys
    const n = k.length - 1
    if (p <= k[0].p) return 0
    if (p >= k[n].p) return 1
    let i = 0
    while (i < n - 1 && p > k[i + 1].p) i++
    const local = (p - k[i].p) / (k[i + 1].p - k[i].p)
    // gentle ease inside each segment so the camera "settles" on each framing
    const e = local * local * (3 - 2 * local)
    const mixed = THREE.MathUtils.lerp(local, e, 0.35)
    return (i + mixed) / n
  }
  sample(p, outPos, outLook) {
    const t = this.param(p)
    this.pos.getPoint(t, outPos)
    this.look.getPoint(t, outLook)
  }
}

/** The scroll story. The last key depends on the viewport so the compose card never covers the lantern. */
export function makeStoryPath(aspect, narrow = false) {
  const portrait = aspect < 0.85
  const finalPos = portrait ? v(0, 1.8, 7.0) : narrow ? v(0.9, 1.5, 4.6) : v(0.55, 1.45, 4.0)
  const finalLook = portrait ? v(0, -1.75, 0) : narrow ? v(2.1, 1.0, 0) : v(1.25, 1.0, 0)
  return new KeyedPath([
    { p: 0.0, pos: v(0, 80, 64), look: v(0, 72, -200) },
    { p: 0.14, pos: v(-2, 72, 56), look: v(0, 52, -170) },
    { p: 0.3, pos: v(-3, 54, 46), look: v(0, 30, -130) },
    { p: 0.44, pos: v(-2, 38, 40), look: v(0, 16, -110) },
    { p: 0.58, pos: v(0, 20, 34), look: v(0, 6, -90) },
    { p: 0.72, pos: v(1.5, 6.5, 21), look: v(0, 2.6, -60) },
    { p: 0.87, pos: v(1.6, 2.4, 8.6), look: v(0.2, 1.1, -6) },
    { p: 1.0, pos: finalPos, look: finalLook },
  ])
}

/** Where the hero lantern travels after release. */
export const flightLanternPath = new THREE.CatmullRomCurve3(
  [v(0, 0.16, 0), v(0, 0.9, -0.3), v(0.5, 6, -2.5), v(1.0, 18, -6), v(1.3, 34, -10), v(1.5, 50, -14), v(1.7, 64, -18), v(1.9, 76, -22)],
  false,
  'centripetal'
)

/** Camera during the release flight, as offsets from the lantern (blended to a world framing at the end). */
export const flightCamPath = new KeyedPath([
  { p: 0.0, pos: v(0.7, 1.45, 4.2), look: v(0, 1.0, 0) },
  { p: 0.1, pos: v(1.2, 1.2, 5.0), look: v(0, 1.3, -0.3) },
  { p: 0.3, pos: v(3.2, 2.2, 10.5), look: v(0.5, 6.4, -2.5) },
  { p: 0.48, pos: v(3.4, 13, 7), look: v(1.0, 19, -6) },
  { p: 0.62, pos: v(2.6, 30, 2.5), look: v(1.3, 35.5, -10) },
  { p: 0.76, pos: v(3.4, 48, 6), look: v(1.5, 54, -16) },
  { p: 0.9, pos: v(4, 62, -4), look: v(1.7, 70, -20) },
  { p: 1.0, pos: v(4.2, 69, -7), look: v(1.2, 77.5, -22) },
])

/** The recipient's lantern descends from the sky and settles on the water. */
export const recvLanternPath = new THREE.CatmullRomCurve3(
  [v(-1.2, 90, -6), v(-1.0, 76, -6.5), v(-0.6, 56, -6), v(-0.2, 36, -5), v(0.2, 16, -4), v(0.5, 4, -3.4), v(0.6, 0.4, -3.2), v(0.6, 0.05, -3.2)],
  false,
  'centripetal'
)

export const recvCamPath = new KeyedPath([
  { p: 0.0, pos: v(3, 78, 14), look: v(-1.2, 90, -6) },
  { p: 0.18, pos: v(3.4, 72, 8), look: v(-1.0, 76, -6.5) },
  { p: 0.38, pos: v(3.4, 54, 6), look: v(-0.6, 55, -6) },
  { p: 0.55, pos: v(3.2, 36, 6), look: v(-0.2, 35, -5) },
  { p: 0.72, pos: v(2.8, 17, 6.5), look: v(0.2, 15, -4) },
  { p: 0.88, pos: v(1.8, 4.5, 5.5), look: v(0.5, 3.4, -3.4) },
  { p: 1.0, pos: v(1.0, 1.05, 3.0), look: v(0.45, 0.05, -3.2) },
])

/** Where the recipient's lantern finally floats. */
export const RECV_REST = v(0.6, 0.05, -3.2)
