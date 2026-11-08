import { Effect, EffectAttribute } from 'postprocessing'
import * as THREE from 'three'

/*
 * Live liquid glass.
 *
 * Adapted from the refraction model in dashersw/liquid-glass-js
 * (MIT License, Copyright (c) 2025 Armagan Amcalar): edge/rim refraction
 * along the shape normal, a soft blur, a tint and a rim highlight.
 *
 * The original samples a one-off html2canvas snapshot of the page, so it
 * can't see a moving WebGL scene. This version runs as a post-processing
 * pass and refracts the live frame behind any DOM element marked
 * [data-glass], so the glass bends the clouds, lake and lanterns as they move.
 */

export const MAX_GLASS = 6

const fragmentShader = /* glsl */ `
  uniform vec4 uRects[${MAX_GLASS}];   // x, y (bottom-left, px), w, h (px)
  uniform vec4 uStyle[${MAX_GLASS}];   // radius px, blur px, tint amount, refraction px
  uniform float uAlpha[${MAX_GLASS}];
  uniform int uCount;
  uniform vec3 uTint;

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  vec3 blurAt(vec2 uv, float radiusPx) {
    // golden-angle spiral: 16 taps, smooth enough for frosted glass
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 16; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 16.0) * radiusPx;
      float a = fi * 2.39996;
      vec2 o = vec2(cos(a), sin(a)) * r * texelSize;
      float w = 1.0 - fi / 20.0;
      acc += texture2D(inputBuffer, uv + o).rgb * w;
      wsum += w;
    }
    return acc / wsum;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    outputColor = inputColor;
    vec2 px = uv * resolution;
    for (int i = 0; i < ${MAX_GLASS}; i++) {
      if (i >= uCount) break;
      vec4 R = uRects[i];
      vec4 S = uStyle[i];
      vec2 hs = R.zw * 0.5;
      vec2 c = R.xy + hs;
      vec2 p = px - c;
      float radius = min(S.x, min(hs.x, hs.y));
      float d = sdRoundBox(p, hs, radius);
      if (d > 1.5) continue;

      // shape normal from the SDF gradient
      float e = 1.0;
      vec2 n = normalize(vec2(
        sdRoundBox(p + vec2(e, 0.0), hs, radius) - sdRoundBox(p - vec2(e, 0.0), hs, radius),
        sdRoundBox(p + vec2(0.0, e), hs, radius) - sdRoundBox(p - vec2(0.0, e), hs, radius)
      ) + 1e-5);

      float inside = max(-d, 0.0);
      // refraction is strongest at the rim and decays toward the centre
      float edge = exp(-inside / max(S.w * 0.9, 1.0));
      float rim = exp(-inside / 3.0);
      vec2 offs = -n * (edge * S.w + rim * S.w * 0.35);
      // slight lens magnification across the body
      offs += -p * 0.025;

      vec2 suv = uv + offs * texelSize;
      vec3 col = blurAt(suv, S.y);
      // chromatic dispersion where the glass bends the most
      float disp = edge * 0.6;
      col.r = mix(col.r, blurAt(suv + n * disp * 3.0 * texelSize, S.y * 0.7).r, disp);
      col.b = mix(col.b, blurAt(suv - n * disp * 3.0 * texelSize, S.y * 0.7).b, disp);

      // tint, vertical sheen, rim highlight from the upper left, inner shadow at the base
      float vy = clamp((px.y - R.y) / max(R.w, 1.0), 0.0, 1.0);
      col = mix(col, uTint, S.z);
      col += vec3(1.0) * 0.035 * vy;
      float light = 0.5 + 0.5 * dot(n, normalize(vec2(-0.55, 0.85)));
      col += vec3(1.0, 0.96, 0.9) * rim * light * 0.32;
      col -= vec3(0.02, 0.03, 0.05) * rim * (1.0 - light) * 0.8;

      float mask = (1.0 - smoothstep(-1.0, 1.0, d)) * uAlpha[i];
      outputColor = vec4(mix(inputColor.rgb, col, mask), inputColor.a);
      break;
    }
  }
`

export class LiquidGlassEffect extends Effect {
  constructor() {
    const rects = Array.from({ length: MAX_GLASS }, () => new THREE.Vector4())
    const style = Array.from({ length: MAX_GLASS }, () => new THREE.Vector4())
    super('LiquidGlassEffect', fragmentShader, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['uRects', new THREE.Uniform(rects)],
        ['uStyle', new THREE.Uniform(style)],
        ['uAlpha', new THREE.Uniform(new Array(MAX_GLASS).fill(0))],
        ['uCount', new THREE.Uniform(0)],
        ['uTint', new THREE.Uniform(new THREE.Color('#141833'))],
      ]),
    })
  }
}
