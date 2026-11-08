# Third-party notices

Lantern bundles or adapts the following open-source software. Each keeps its own license.

| Project | Use in Lantern | License |
|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) | 3D engine | MIT |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | React renderer for the single main 3D canvas | MIT |
| [drei](https://github.com/pmndrs/drei) | Clouds, reflective lake material, billboards, performance helpers | MIT |
| [react-postprocessing](https://github.com/pmndrs/react-postprocessing) / [postprocessing](https://github.com/pmndrs/postprocessing) | Bloom, vignette, grain, and the host for the live glass pass | MIT |
| [three-custom-shader-material](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) | Glowing rice-paper, shore and reed shaders on standard materials | MIT |
| [liquid-glass-js](https://github.com/dashersw/liquid-glass-js) | **Adapted**: refraction model (edge/rim refraction, blur, tint, rim light) re-implemented as a live post-processing pass in `src/scene/LiquidGlassEffect.js` | MIT, Copyright (c) 2025 Armagan Amcalar |
| [Paper Shaders](https://github.com/paper-design/shaders) | Liquid-metal wordmark | Apache-2.0 (see NOTICE below) |
| [Liquid Logo](https://github.com/paper-design/liquid-logo) | Visual reference only. No code copied (its PolyForm Shield license is not used) | n/a |
| [ShaderGradient](https://github.com/ruucm/shadergradient) | Dusk veil while loading and over received lanterns | MIT (per package.json and README) |
| [GSAP](https://gsap.com) incl. ScrollTrigger and SplitText | Scroll choreography and typography | GreenSock Standard "no charge" License, https://gsap.com/standard-license |
| [Lenis](https://github.com/darkroomengineering/lenis) | Smooth native scrolling | MIT |
| [zustand](https://github.com/pmndrs/zustand) | State | MIT |
| [React](https://react.dev) | UI | MIT |
| [Fraunces](https://github.com/undercasetype/Fraunces) and [Inter](https://github.com/rsms/inter) via Fontsource | Typefaces | SIL Open Font License 1.1 |

## Paper Shaders NOTICE

```
Paper Shaders
Copyright 2026 Paper

Powered by Paper Shaders:
https://shaders.paper.design
```

## liquid-glass-js license

```
MIT License

Copyright (c) 2025 Armagan Amcalar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The sound is synthesised in the browser (no audio files). All textures are generated procedurally at runtime.
