# Lantern: light one for someone

A cinematic website for the Embarko Student Challenge. You descend through a sea of clouds to a moonlit lake and write a few words to someone you never properly thanked. Then you press and hold to light a paper lantern and let it go. The camera follows it up through clouds that glow from inside as it passes. You get a link, and when the recipient opens it, the lantern drifts down to their lake and unfolds into your letter.

The message lives entirely inside the link, after the `#`, which browsers never send to a server. There's no backend, no account and no storage.

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` produces a static site in `dist/` that can be deployed as an Embarko static site. Embarko builds Vite projects itself from `package.json`.

Append `?quality=high`, `?quality=medium` or `?quality=low` to pin the graphics tier while testing.

## How it's put together

- **One WebGL canvas** (`src/scene/Experience.jsx`) renders everything: sky dome with moon and stars, five parallax ridge layers, a translucent cloud deck lit by the lantern, a reflective lake, reeds, the hero lantern and hundreds of instanced sky lanterns.
- **Scroll story**: Lenis smooth scroll and GSAP ScrollTrigger feed `rig.scroll`, and `CameraRig` follows a keyed Catmull-Rom path through the chapters.
- **Director** (`src/lib/director.js`): GSAP timelines for the release flight, the recipient's descent and the dawn ending, all tweening plain values on `rig`.
- **Live liquid glass** (`src/scene/LiquidGlassEffect.js`): a post-processing pass adapted from liquid-glass-js. It refracts the live 3D frame behind DOM elements marked `data-glass`. Without post-processing it falls back to CSS `backdrop-filter`.
- **Quality tiers** (`src/lib/quality.js`): high, medium and low scale clouds, lantern counts, reflections, bloom and pixel ratio. `PerformanceMonitor` steps down automatically.
- **Accessibility**: real-text story, keyboard hold (Space or Enter), a single-tap alternative to holding, a reduced-motion mode (chapter cuts instead of camera travel), a live region for announcements, and a no-WebGL CSS/SVG fallback where sending and receiving still work.

See `THIRD_PARTY_NOTICES.md` for licenses.
