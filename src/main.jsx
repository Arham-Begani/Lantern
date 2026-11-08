import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/inter/index.css'
import './styles/global.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Development-only handle for automated visual checks.
if (import.meta.env.DEV) {
  Promise.all([import('./state/store'), import('./lib/scroll'), import('./lib/director')]).then(([store, scroll, director]) => {
    window.__lantern = { rig: store.rig, useStore: store.useStore, gsap: scroll.gsap, tl: director.debugTimelines }
  })
}
