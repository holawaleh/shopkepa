// All print functions open a new window, inject styled HTML, then call print().
// No external PDF libraries needed.

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    color: #111;
    background: #fff;
    padding: 24px;
    font-size: 13px;
  }
  h1 { font-size: 18px; text-align: center; margin-bottom: 2px; }
  h2 { font-size: 13px; text-align: center; font-weight: normal; color: #555; margin-bottom: 4px; }
  .center { text-align: center; }
  .divider { border: none; border-top: 1px dashed #aaa; margin: 10px 0; }
  .solid   { border: none; border-top: 2px solid #111; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 4px 0; vertical-align: top; }
  .right { text-align: right; }
  .label { color: #555; }
  .total-row td { font-weight: bold; border-top: 1px solid #ccc; padding-top: 6px; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 10px;
    font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
  }
  @media print {
    body { padding: 0; }
    @page { margin: 10mm; size: A5; }
  }
`

function openPrint(html) {
  const win = window.open('', '_blank', 'width=560,height=750,scrollbars=yes')
  if (!win) { alert('Please allow pop-ups for ShopKepa to print.'); return }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ShopKepa — Print Preview</title><style>
${STYLES}
#print-bar{position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;border-top:1px solid #333;padding:10px 16px;display:flex;gap:10px;justify-content:flex-end;z-index:99}
#print-bar button{padding:7px 20px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-family:inherit}
#btn-print{background:#c9a84c;color:#000;font-weight:600}
#btn-cancel{background:transparent;color:#aaa;border:1px solid #444!important}
body{padding-bottom:56px}
@media print{#print-bar{display:none}body{padding-bottom:0}}
</style></head><body>${html}
<div id="print-bar">
  <button id="btn-cancel" onclick="window.close()">Cancel</button>
  <button id="btn-print" onclick="window.print()">Print</button>
</div>
</body></html>`)
  win.document.close()
}

function naira(n) {
  const num = parseFloat(n || 0)
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
}

// ── Sale Receipt ──────────────────────────────────────────────────────────

export function printSaleReceipt(sale, businessName = 'ShopKepa') {
  const items = (sale.items || []).map(i => `
    <tr>
      <td>${i.product_name}</td>
      <td class="right">${i.quantity}</td>
      <td class="right">${naira(i.unit_price)}</td>
      <td class="right">${naira(i.line_total)}</td>
    </tr>
  `).join('')

  const change = Math.max(0, parseFloat(sale.amount_paid || 0) - parseFloat(sale.total_amount || 0))

  openPrint(`
    <h1>${businessName}</h1>
    <h2>Sales Receipt</h2>
    <hr class="solid">

    <table>
      <tr><td class="label">Receipt #</td><td class="right">${sale.sale_number || '—'}</td></tr>
      <tr><td class="label">Date</td><td class="right">${fmtDate(sale.created_at)} ${fmtTime(sale.created_at)}</td></tr>
      <tr><td class="label">Branch</td><td class="right">${sale.branch_name || '—'}</td></tr>
      ${sale.customer_name ? `<tr><td class="label">Customer</td><td class="right">${sale.customer_name}</td></tr>` : ''}
    </table>

    <hr class="divider">

    <table>
      <thead>
        <tr>
          <th style="text-align:left">Item</th>
          <th class="right">Qty</th>
          <th class="right">Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items}
      </tbody>
    </table>

    <hr class="divider">

    <table>
      <tr><td class="label">Subtotal</td><td class="right">${naira(sale.subtotal)}</td></tr>
      ${parseFloat(sale.discount_amount) > 0 ? `<tr><td class="label">Discount</td><td class="right">- ${naira(sale.discount_amount)}</td></tr>` : ''}
      <tr class="total-row"><td>TOTAL</td><td class="right">${naira(sale.total_amount)}</td></tr>
      <tr><td class="label">Amount Paid</td><td class="right">${naira(sale.amount_paid)}</td></tr>
      ${change > 0 ? `<tr><td class="label">Change</td><td class="right">${naira(change)}</td></tr>` : ''}
      ${parseFloat(sale.balance_due) > 0 ? `<tr><td class="label" style="color:red">Balance Due</td><td class="right" style="color:red;font-weight:bold">${naira(sale.balance_due)}</td></tr>` : ''}
    </table>

    <hr class="solid">
    <p class="center" style="margin-top:8px;font-size:12px;color:#555">
      Thank you for your patronage!<br>
      Powered by ShopKepa
    </p>
  `)
}

// ── Job Card Receipt ───────────────────────────────────────────────────────

export function printJobCardReceipt(job, businessName = 'ShopKepa') {
  const parts = (job.parts || []).map(p => `
    <tr>
      <td>${p.part_name}</td>
      <td class="right">${p.quantity}</td>
      <td class="right">${naira(p.unit_cost)}</td>
      <td class="right">${naira(p.line_total)}</td>
    </tr>
  `).join('')

  const statusColor = {
    received: '#555', diagnosing: 'orange', repairing: '#c9a84c',
    ready: 'green', collected: '#555',
  }[job.status] || '#555'

  openPrint(`
    <h1>${businessName}</h1>
    <h2>Job Card Receipt</h2>
    <hr class="solid">

    <table>
      <tr><td class="label">Job #</td><td class="right" style="font-weight:bold">${job.job_number || '—'}</td></tr>
      <tr><td class="label">Date</td><td class="right">${fmtDate(job.intake_date || job.created_at)}</td></tr>
      <tr><td class="label">Branch</td><td class="right">${job.branch_name || '—'}</td></tr>
      <tr><td class="label">Status</td><td class="right"><span class="badge" style="color:${statusColor};border:1px solid ${statusColor}">${job.status?.toUpperCase() || ''}</span></td></tr>
    </table>

    <hr class="divider">

    <p style="font-weight:bold;margin-bottom:4px">CUSTOMER</p>
    <table>
      <tr><td class="label">Name</td><td class="right">${job.customer_name || '—'}</td></tr>
      ${job.customer_phone ? `<tr><td class="label">Phone</td><td class="right">${job.customer_phone}</td></tr>` : ''}
    </table>

    <hr class="divider">

    <p style="font-weight:bold;margin-bottom:4px">DEVICE</p>
    <p>${job.device_description || '—'}</p>
    <p class="label" style="margin-top:4px;font-size:12px">${job.customer_complaint || ''}</p>

    ${parts ? `
    <hr class="divider">
    <p style="font-weight:bold;margin-bottom:4px">PARTS USED</p>
    <table>
      <thead><tr><th style="text-align:left">Part</th><th class="right">Qty</th><th class="right">Cost</th><th class="right">Total</th></tr></thead>
      <tbody>${parts}</tbody>
    </table>` : ''}

    ${job.technician_notes ? `
    <hr class="divider">
    <p style="font-weight:bold;margin-bottom:4px">TECHNICIAN NOTES</p>
    <p style="font-size:12px;color:#444">${job.technician_notes}</p>` : ''}

    <hr class="divider">

    <table>
      <tr><td class="label">Labour</td><td class="right">${naira(job.labour_charge)}</td></tr>
      <tr><td class="label">Parts</td><td class="right">${naira(job.parts_charge)}</td></tr>
      <tr class="total-row"><td>TOTAL CHARGE</td><td class="right">${naira(job.total_charge)}</td></tr>
      <tr><td class="label">Amount Paid</td><td class="right">${naira(job.amount_paid)}</td></tr>
      ${parseFloat(job.balance_due) > 0
        ? `<tr><td class="label" style="color:red">Balance Due</td><td class="right" style="color:red;font-weight:bold">${naira(job.balance_due)}</td></tr>`
        : ''}
    </table>

    ${job.warranty_days ? `
    <hr class="divider">
    <p class="center" style="font-size:12px;color:#555">Warranty: ${job.warranty_days} day(s) from collection date</p>` : ''}

    <hr class="solid">
    <p class="center" style="margin-top:8px;font-size:12px;color:#555">
      ${job.technician_name ? `Technician: ${job.technician_name}<br>` : ''}
      Powered by ShopKepa
    </p>
  `)
}

// ── Customer Statement ─────────────────────────────────────────────────────

export function printCustomerStatement(customer, sales, businessName = 'ShopKepa') {
  const transactionRows = []

  sales.forEach((sale) => {
    let runningBalance = parseFloat(sale.total_amount || 0)
    transactionRows.push({
      key: `${sale.id}-sale`,
      date: sale.sale_date || sale.created_at,
      type: 'Sale',
      reference: sale.sale_number || '-',
      officer: sale.created_by_name || '-',
      debit: parseFloat(sale.total_amount || 0),
      credit: null,
      balance: runningBalance,
    })

    ;(sale.payments || []).forEach((payment) => {
      runningBalance = Math.max(0, runningBalance - parseFloat(payment.amount || 0))
      transactionRows.push({
        key: payment.id,
        date: payment.payment_date || payment.created_at,
        type: `Payment ${payment.tranche_number ? `#${payment.tranche_number}` : ''}`.trim(),
        reference: payment.reference_number || payment.id || '-',
        officer: payment.created_by_name || '-',
        debit: null,
        credit: parseFloat(payment.amount || 0),
        balance: runningBalance,
      })
    })
  })

  const rows = transactionRows.map(row => `
    <tr>
      <td>${fmtDate(row.date)}</td>
      <td>${row.type}</td>
      <td>${row.reference}</td>
      <td>${row.officer}</td>
      <td class="right">${row.debit === null ? '' : naira(row.debit)}</td>
      <td class="right">${row.credit === null ? '' : naira(row.credit)}</td>
      <td class="right" style="${row.balance > 0 ? 'color:red;font-weight:bold' : ''}">${naira(row.balance)}</td>
    </tr>
  `).join('')

  const totalSpend   = sales.reduce((s, x) => s + parseFloat(x.total_amount  || 0), 0)
  const totalPaid    = sales.reduce((s, x) => s + parseFloat(x.amount_paid   || 0), 0)
  const totalBalance = sales.reduce((s, x) => s + parseFloat(x.balance_due   || 0), 0)

  openPrint(`
    <h1>${businessName}</h1>
    <h2>Customer Statement</h2>
    <hr class="solid">

    <table style="margin-bottom:8px">
      <tr><td class="label">Customer</td><td class="right" style="font-weight:bold">${customer.full_name}</td></tr>
      ${customer.phone_number ? `<tr><td class="label">Phone</td><td class="right">${customer.phone_number}</td></tr>` : ''}
      ${customer.business_name ? `<tr><td class="label">Business</td><td class="right">${customer.business_name}</td></tr>` : ''}
      <tr><td class="label">Statement Date</td><td class="right">${fmtDate(new Date().toISOString())}</td></tr>
    </table>

    <hr class="divider">

    ${rows ? `
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Date</th>
          <th style="text-align:left">Type</th>
          <th style="text-align:left">Transaction ID</th>
          <th style="text-align:left">Account Officer</th>
          <th class="right">Debit</th>
          <th class="right">Paid</th>
          <th class="right">Balance</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4">TOTALS</td>
          <td class="right">${naira(totalSpend)}</td>
          <td class="right">${naira(totalPaid)}</td>
          <td class="right" style="${totalBalance > 0 ? 'color:red' : ''}">${naira(totalBalance)}</td>
        </tr>
      </tfoot>
    </table>` : '<p style="text-align:center;color:#555">No transactions found.</p>'}

    <hr class="solid">

    <table style="margin-top:8px">
      <tr><td class="label">Total Lifetime Spend</td><td class="right" style="font-weight:bold">${naira(totalSpend)}</td></tr>
      <tr><td class="label">Total Paid</td><td class="right">${naira(totalPaid)}</td></tr>
      <tr><td class="label" ${totalBalance > 0 ? 'style="color:red"' : ''}>Outstanding Balance</td>
          <td class="right" ${totalBalance > 0 ? 'style="color:red;font-weight:bold"' : ''}>${naira(totalBalance)}</td></tr>
    </table>

    <hr class="solid">
    <p class="center" style="margin-top:8px;font-size:12px;color:#555">Powered by ShopKepa</p>
  `)
}
