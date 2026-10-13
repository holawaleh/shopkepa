import JsBarcode from 'jsbarcode'
import { formatNaira } from './format'

// 13-digit codes are EAN-13 (ours and most manufacturers'); anything else
// (letters, 8-digit, odd lengths) prints as Code 128, which takes any text.
export function barcodeFormat(code) {
  return /^\d{13}$/.test(code) ? 'EAN13' : 'CODE128'
}

export function drawBarcode(svgEl, code, options = {}) {
  const opts = { format: barcodeFormat(code), height: 50, width: 1.6, fontSize: 13, margin: 4, ...options }
  try {
    JsBarcode(svgEl, code, opts)
  } catch {
    // e.g. a 13-digit code with a wrong check digit - fall back to Code 128
    JsBarcode(svgEl, code, { ...opts, format: 'CODE128' })
  }
}

function barcodeSvgMarkup(code) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  drawBarcode(svg, code, { height: 42, width: 1.5, fontSize: 12, margin: 0 })
  return svg.outerHTML
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

/**
 * Print sticker labels: name, price and barcode. `items` is a list of
 * { product, copies }. Laid out for A4 sticker sheets of 3 x 7
 * (63.5 x 38.1 mm), the most common size sold in Nigeria.
 */
export function printBarcodeLabels(items, { businessName, showPrice = true } = {}) {
  const labels = []
  for (const { product, copies } of items) {
    if (!product.barcode) continue
    const svg = barcodeSvgMarkup(product.barcode)
    const html = `
      <div class="label">
        ${businessName ? `<div class="biz">${escapeHtml(businessName)}</div>` : ''}
        <div class="name">${escapeHtml(product.name)}</div>
        ${showPrice ? `<div class="price">${escapeHtml(formatNaira(product.retail_price))}</div>` : ''}
        <div class="code">${svg}</div>
      </div>`
    for (let i = 0; i < Math.max(1, copies || 1); i++) labels.push(html)
  }
  if (labels.length === 0) return false

  const win = window.open('', '_blank', 'width=820,height=900,scrollbars=yes')
  if (!win) { alert('Please allow pop-ups for ShopKepa to print.'); return false }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Barcode labels</title><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
    .sheet { display: grid; grid-template-columns: repeat(3, 63.5mm); grid-auto-rows: 38.1mm;
             column-gap: 2.5mm; justify-content: center; padding: 15mm 0 0; }
    .label { overflow: hidden; padding: 2mm 3mm; display: flex; flex-direction: column;
             align-items: center; justify-content: center; text-align: center; break-inside: avoid; }
    .biz { font-size: 7pt; color: #444; text-transform: uppercase; letter-spacing: .3px; }
    .name { font-size: 8.5pt; font-weight: bold; line-height: 1.15; max-height: 2.3em; overflow: hidden; }
    .price { font-size: 10pt; font-weight: bold; margin: .5mm 0; }
    .code svg { max-width: 57mm; height: auto; display: block; }
    @media screen { body { background: #eee; } .sheet { background: #fff; width: 210mm; margin: 10px auto; min-height: 297mm; }
                    .label { outline: 1px dashed #ccc; } }
    @page { size: A4; margin: 0; }
  </style></head><body><div class="sheet">${labels.join('')}</div>
  <script>window.onload = function () { setTimeout(function () { window.print() }, 250) }<\/script>
  </body></html>`)
  win.document.close()
  return true
}
