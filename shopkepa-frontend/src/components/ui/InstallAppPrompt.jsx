import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

// Chrome/Edge/Android fire `beforeinstallprompt` once, often before React
// mounts, so main.jsx stashes it on window.__skInstallPrompt and re-announces
// it with this event.
export const INSTALL_READY_EVENT = 'shopkepa:install-ready'

const DISMISS_KEY = 'shopkepa_install_dismissed_at'
const DISMISS_DAYS = 7

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// iPhone/iPad Safari has no install prompt; people add it from the Share menu.
const isIosSafari = () => {
  const ua = window.navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  return ios && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua)
}

const recentlyDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at && Date.now() - at < DISMISS_DAYS * 86400000
  } catch { return false }
}

export default function InstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState(() => window.__skInstallPrompt || null)
  const [hidden, setHidden] = useState(() => isStandalone() || recentlyDismissed())
  const [ios] = useState(isIosSafari)

  useEffect(() => {
    const onReady = () => setPromptEvent(window.__skInstallPrompt || null)
    const onInstalled = () => { window.__skInstallPrompt = null; setHidden(true) }
    window.addEventListener(INSTALL_READY_EVENT, onReady)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener(INSTALL_READY_EVENT, onReady)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden || (!promptEvent && !ios)) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode */ }
    setHidden(true)
  }

  const install = async () => {
    promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    window.__skInstallPrompt = null   // a prompt can only be used once
    setPromptEvent(null)
    if (outcome === 'accepted') setHidden(true)
  }

  return (
    <div className="sk-install-floater" role="dialog" aria-label="Install ShopKepa">
      <img src="/pwa-192x192.png" alt="" width="40" height="40" style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Install ShopKepa</div>
        <div style={{ fontSize: 12.5, color: '#B8C7DD', lineHeight: 1.4, marginTop: 2 }}>
          {ios
            ? <>Add ShopKepa to your home screen for one-tap access - works offline too. Tap <Share size={12} style={{ verticalAlign: '-2px' }} /> <b>Share</b>, then <b>Add to Home Screen</b>.</>
            : 'Add ShopKepa to your home screen for one-tap access - works offline too.'}
        </div>
        {!ios && (
          <button onClick={install} className="sk-install-btn">
            <Download size={14} /> Install app
          </button>
        )}
      </div>
      <button onClick={dismiss} aria-label="Not now" className="sk-install-close">
        <X size={16} />
      </button>
      <style>{`
        .sk-install-floater {
          position: fixed; right: 20px; bottom: 20px; z-index: 140;
          width: min(360px, calc(100vw - 32px));
          display: flex; gap: 12px; align-items: flex-start;
          padding: 14px 14px 14px 16px; border-radius: 14px;
          background: #0D1F3C; border: 1px solid rgba(201,168,76,0.45);
          box-shadow: 0 12px 32px rgba(0,0,0,0.35);
          animation: sk-install-in .35s ease-out;
        }
        .sk-install-btn {
          margin-top: 10px; display: inline-flex; align-items: center; gap: 6px;
          background: #C9A84C; color: #0A1628; border: none; border-radius: 8px;
          padding: 7px 14px; font-weight: 600; font-size: 13px; cursor: pointer;
        }
        .sk-install-close {
          background: none; border: none; color: #8FA3C0; cursor: pointer; padding: 2px; flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .sk-install-floater { left: 16px; right: 16px; bottom: 16px; width: auto; }
        }
        @keyframes sk-install-in { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .sk-install-floater { animation: none } }
      `}</style>
    </div>
  )
}
