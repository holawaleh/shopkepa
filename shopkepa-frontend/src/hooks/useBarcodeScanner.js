import { useEffect, useRef } from 'react'

// USB / Bluetooth barcode scanners act as a keyboard ("HID keyboard mode",
// the factory default): they type the code in a few milliseconds and press
// Enter. No driver is needed - we just tell that burst apart from a person
// typing, wherever the focus is on the page.
const MAX_GAP_MS   = 50   // scanners type a key every ~5-30ms; people take 100ms+
const MIN_LENGTH   = 4

// Set the value of a React-controlled input so React sees the change
function setInputValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const isTextField = (el) =>
  el && (el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(el.type)))

/**
 * Calls onScan(code) for every hardware scan. Inputs marked
 * `data-barcode-input` handle scans themselves (Enter on their own
 * onKeyDown) and are left alone. If a scan lands in some other field
 * (e.g. the customer search box), that field is put back as it was.
 */
export function useBarcodeScanner(onScan, { enabled = true } = {}) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    if (!enabled) return
    let buffer = ''
    let lastAt = 0
    let target = null
    let valueBefore = ''

    const reset = () => { buffer = ''; target = null }

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const now = performance.now()
      const gap = now - lastAt
      lastAt = now

      if (e.key === 'Enter') {
        const code = buffer.trim()
        const el = target
        const before = valueBefore
        reset()
        if (code.length < MIN_LENGTH || gap > MAX_GAP_MS) return
        if (el?.closest?.('[data-barcode-input]')) return
        e.preventDefault()
        e.stopPropagation()
        if (isTextField(el)) setInputValue(el, before)
        onScanRef.current(code)
        return
      }

      if (e.key.length !== 1) return   // Shift, Tab, arrows...
      if (gap > MAX_GAP_MS) {
        // Slow key: a person typing. Start a fresh possible scan from here.
        buffer = ''
        target = e.target
        valueBefore = isTextField(target) ? target.value : ''
      }
      buffer += e.key
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [enabled])
}
