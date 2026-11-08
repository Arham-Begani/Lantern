/*
 * DOM elements that should render as live liquid glass register here.
 * Each frame the effect reads their on-screen rectangles.
 *
 * data-glass-radius / data-glass-blur / data-glass-tint / data-glass-refract
 * can tune individual panels.
 */
const elements = new Set()

export const glassRegistry = {
  add(el) {
    elements.add(el)
    document.documentElement.classList.add('has-live-glass-candidates')
  },
  delete(el) {
    elements.delete(el)
  },
  get elements() {
    return elements
  },
}

export function useGlassRef() {
  let current = null
  return (el) => {
    if (current && current !== el) glassRegistry.delete(current)
    if (el) glassRegistry.add(el)
    current = el
  }
}
