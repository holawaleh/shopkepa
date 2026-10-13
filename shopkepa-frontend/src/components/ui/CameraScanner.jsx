import { useEffect, useRef, useState } from 'react'
import { X, Camera } from 'lucide-react'

const SAME_CODE_PAUSE_MS = 2000   // don't re-add the item still in front of the lens

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 1500
    gain.gain.value = 0.15
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => ctx.close()
  } catch { /* no audio - fine */ }
  navigator.vibrate?.(60)
}

function cameraError(err) {
  if (!window.isSecureContext) return 'The camera only works on the secure (https) site.'
  if (err?.name === 'NotAllowedError') return 'Camera access was blocked. Allow the camera for this site in your browser settings, then try again.'
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'No camera was found on this device.'
  if (err?.name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.'
  return 'Could not start the camera.'
}

/**
 * Full-screen phone-camera barcode scanner. With `continuous`, it stays
 * open so several items can be scanned in a row (POS); otherwise it closes
 * after the first code (filling a form field).
 */
export default function CameraScanner({ onScan, onClose, continuous = false, title = 'Scan barcode' }) {
  const videoRef = useRef(null)
  const lastRef = useRef({ code: '', at: 0 })
  // Refs so a parent re-render doesn't restart the camera
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)
  const [lastCode, setLastCode] = useState('')

  useEffect(() => {
    let controls = null
    let cancelled = false

    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
        // Loaded on demand so the scanning library isn't in every page's bundle
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
          videoRef.current,
          (result) => {
            if (!result || cancelled) return
            const code = result.getText().trim()
            const now = Date.now()
            if (code === lastRef.current.code && now - lastRef.current.at < SAME_CODE_PAUSE_MS) return
            lastRef.current = { code, at: now }
            beep()
            setLastCode(code)
            onScanRef.current(code)
            if (!continuous) { cancelled = true; controls?.stop(); onCloseRef.current() }
          },
        )
        if (cancelled) controls.stop()
      } catch (err) {
        if (!cancelled) setError(cameraError(err))
      } finally {
        if (!cancelled) setStarting(false)
      }
    })()

    return () => { cancelled = true; controls?.stop() }
  }, [continuous])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div role="dialog" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', color: '#fff' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 15 }}><Camera size={17} /> {title}</span>
        <button onClick={onClose} aria-label="Close camera" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 20, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
          {continuous ? 'Done' : <><X size={16} /> Close</>}
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {!error && (
          <div style={{ position: 'absolute', left: '10%', right: '10%', top: '50%', height: 140, transform: 'translateY(-50%)',
            border: '2px solid rgba(201,168,76,0.9)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}>
            <div style={{ position: 'absolute', left: 8, right: 8, top: '50%', height: 2, background: 'rgba(224,85,85,0.85)' }} />
          </div>
        )}
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 24, textAlign: 'center', color: '#fff', fontSize: 14 }}>
          {error
            ? <div style={{ background: 'rgba(224,85,85,0.9)', borderRadius: 10, padding: '12px 14px' }}>{error}</div>
            : starting
              ? 'Starting camera...'
              : lastCode
                ? <div style={{ background: 'rgba(76,175,125,0.9)', display: 'inline-block', borderRadius: 20, padding: '6px 14px', fontFamily: 'monospace' }}>Scanned {lastCode}</div>
                : 'Point the camera at a barcode'}
        </div>
      </div>
    </div>
  )
}
