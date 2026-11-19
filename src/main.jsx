import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppProvider } from './context/AppProvider'
import './styles/index.css'

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <App />
  </AppProvider>,
)

// Offline shell: registered for the web/PWA build only. Inside the Android
// WebView the app bundle already lives on the device, so a worker is redundant.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI).href
    navigator.serviceWorker.register(swUrl, { scope: './' }).catch(() => {
      /* non-fatal: the app still works, it just loses shell precaching */
    })
  })
}
