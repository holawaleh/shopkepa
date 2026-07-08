import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import App from './App.jsx'

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
