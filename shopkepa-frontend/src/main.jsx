import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.jsx'

if (typeof window !== 'undefined') {
  const storedTheme = window.localStorage.getItem('shopkepa_theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light')
  document.documentElement.dataset.theme = initialTheme
  document.documentElement.style.colorScheme = initialTheme
}

// Keep Chrome's one-time install prompt for the "Install ShopKepa" floater,
// which may mount after the event has already fired.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__skInstallPrompt = e
  window.dispatchEvent(new Event('shopkepa:install-ready'))
})

// When a new service worker activates it claims this client (autoUpdate mode).
// Reload so the new SW's precache serves the new hashed assets instead of
// Vercel's SPA catch-all returning text/html for unknown asset paths.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) { reloading = true; window.location.reload() }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
