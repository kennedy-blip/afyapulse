import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom lacks several browser APIs that framer-motion and the app's
// environment detection rely on.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
window.ResizeObserver = window.ResizeObserver || ObserverStub
window.IntersectionObserver = window.IntersectionObserver || ObserverStub
window.scrollTo = () => {}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {}
window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {}
window.navigator.vibrate = () => true

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
