/*
 * Ambient sound, synthesised in the browser, so there's no audio file and
 * nothing to license. Off by default; it only starts after the visitor turns
 * it on (a user gesture), per browser autoplay rules.
 */

let ctx = null
let master = null
let flameGain = null
let flameFilter = null
let padGain = null
let enabled = false

function noiseBuffer(c, seconds = 4, brown = false) {
  const len = c.sampleRate * seconds
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
}

function loopNoise(c, brown) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 5, brown)
  src.loop = true
  src.start()
  return src
}

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  // wind: brown noise, low-passed, slowly breathing
  const wind = loopNoise(ctx, true)
  const windLp = ctx.createBiquadFilter()
  windLp.type = 'lowpass'
  windLp.frequency.value = 420
  const windGain = ctx.createGain()
  windGain.gain.value = 0.32
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.07
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.14
  lfo.connect(lfoGain).connect(windGain.gain)
  lfo.start()
  wind.connect(windLp).connect(windGain).connect(master)

  // water lapping: band-passed noise with slow swells
  const water = loopNoise(ctx, false)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 900
  bp.Q.value = 0.7
  const waterGain = ctx.createGain()
  waterGain.gain.value = 0.018
  const lfo2 = ctx.createOscillator()
  lfo2.frequency.value = 0.23
  const lfo2Gain = ctx.createGain()
  lfo2Gain.gain.value = 0.012
  lfo2.connect(lfo2Gain).connect(waterGain.gain)
  lfo2.start()
  water.connect(bp).connect(waterGain).connect(master)

  // flame: a soft crackle-rush that swells while the lantern is held
  const flame = loopNoise(ctx, false)
  flameFilter = ctx.createBiquadFilter()
  flameFilter.type = 'bandpass'
  flameFilter.frequency.value = 600
  flameFilter.Q.value = 0.5
  flameGain = ctx.createGain()
  flameGain.gain.value = 0
  flame.connect(flameFilter).connect(flameGain).connect(master)

  // warm pad (A, E, C#): fades in when a lantern is lit
  padGain = ctx.createGain()
  padGain.gain.value = 0
  const padLp = ctx.createBiquadFilter()
  padLp.type = 'lowpass'
  padLp.frequency.value = 1400
  padGain.connect(padLp).connect(master)
  ;[110, 164.81, 277.18, 220.0].forEach((f, i) => {
    const o = ctx.createOscillator()
    o.type = i % 2 ? 'sine' : 'triangle'
    o.frequency.value = f
    o.detune.value = (i - 1.5) * 4
    const g = ctx.createGain()
    g.gain.value = 0.05 / (i + 1)
    o.connect(g).connect(padGain)
    o.start()
  })
}

function ramp(param, value, seconds) {
  if (!ctx) return
  const now = ctx.currentTime
  param.cancelScheduledValues(now)
  param.setTargetAtTime(value, now, seconds / 3)
}

export const sound = {
  get enabled() {
    return enabled
  },
  async setEnabled(on) {
    enabled = on
    if (on && !ctx) build()
    if (!ctx) return
    if (on) await ctx.resume()
    ramp(master.gain, on ? 0.8 : 0, 1.2)
  },
  setFlame(level) {
    if (!ctx || !enabled) return
    ramp(flameGain.gain, level * 0.09, 0.15)
    flameFilter.frequency.value = 500 + level * 900
  },
  pad(on) {
    if (!ctx) return
    ramp(padGain.gain, on ? 1 : 0, on ? 4 : 2.5)
  },
  whoosh() {
    if (!ctx || !enabled) return
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 3)
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    const g = ctx.createGain()
    const now = ctx.currentTime
    f.frequency.setValueAtTime(200, now)
    f.frequency.exponentialRampToValueAtTime(1800, now + 2.2)
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.16, now + 0.5)
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.8)
    src.connect(f).connect(g).connect(master)
    src.start()
    src.stop(now + 3)
  },
}
