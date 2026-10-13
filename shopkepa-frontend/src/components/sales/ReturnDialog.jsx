import { useEffect, useRef, useState } from 'react'
import { X, AlertCircle, Undo2 } from 'lucide-react'
import { salesAPI } from '../../api/client'
import { formatNaira, formatDate, parseApiError } from '../../utils/format'
import { newIdempotencyKey } from '../../utils/idempotency'

// Same sum the server does: each unit's line price, less its share of any
// whole-sale discount. The server's figure is the one that's saved.
function unitValue(sale, item) {
  let unit = parseFloat(item.line_total) / item.quantity
  const subtotal = parseFloat(sale.subtotal || 0)
  const discount = parseFloat(sale.discount_amount || 0)
  if (discount > 0 && subtotal > 0) unit = unit * (subtotal - discount) / subtotal
  return unit
}

/**
 * Record goods brought back from a sale. onDone(returnRecord, updatedSale)
 * is called after it's saved.
 */
export default function ReturnDialog({ saleId, onClose, onDone }) {
  const [sale, setSale]       = useState(null)
  const [qty, setQty]         = useState({})      // sale_item_id -> number
  const [damaged, setDamaged] = useState({})      // sale_item_id -> bool
  const [method, setMethod]   = useState('cash')
  const [reason, setReason]   = useState('')
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const keyRef = useRef(newIdempotencyKey())

  useEffect(() => {
    salesAPI.get(saleId)
      .then(res => setSale(res.data))
      .catch(err => setError(parseApiError(err)))
  }, [saleId])

  const items = (sale?.items || []).map(i => ({ ...i, remaining: i.quantity - (i.returned_quantity || 0) }))
  const chosen = items.filter(i => (qty[i.id] || 0) > 0)
  const everythingBack = items.length > 0 && items.every(i => (qty[i.id] || 0) >= i.remaining)
  let value = chosen.reduce((sum, i) => sum + Math.round(unitValue(sale, i) * qty[i.id] * 100) / 100, 0)
  if (sale && (everythingBack || value > parseFloat(sale.total_amount))) value = parseFloat(sale.total_amount)
  const debtCut = sale ? Math.min(value, parseFloat(sale.balance_due || 0)) : 0
  const refund  = sale ? Math.min(value - debtCut, parseFloat(sale.amount_paid || 0)) : 0

  const setItemQty = (item, v) => {
    const n = Math.max(0, Math.min(item.remaining, parseInt(v, 10) || 0))
    setQty(q => ({ ...q, [item.id]: n }))
  }

  const submit = async () => {
    if (chosen.length === 0) { setError('Enter how many of each item came back.'); return }
    setSaving(true); setError('')
    try {
      const res = await salesAPI.createReturn(saleId, {
        items: chosen.map(i => ({ sale_item_id: i.id, quantity: qty[i.id], restock: !damaged[i.id] })),
        refund_method: refund > 0 ? method : null,
        reason: reason.trim(),
      }, keyRef.current)
      keyRef.current = newIdempotencyKey()
      onDone?.(res.data.return, res.data.sale)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const fullyReturned = sale && items.every(i => i.remaining <= 0)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <div role="dialog" aria-label="Return items" style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 12, padding: 22, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--light)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Undo2 size={16} /> Return items {sale && <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 13 }}>- {sale.sale_number}</span>}
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {error && (
          <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '9px 12px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <AlertCircle size={14} color="var(--error)" />
            <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
          </div>
        )}

        {!sale ? (
          !error && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading sale...</p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              {sale.customer_name || 'Walk-in customer'} - sold {formatDate(sale.sale_date)} - total now {formatNaira(sale.total_amount)}
              {parseFloat(sale.balance_due) > 0 && <> - owes {formatNaira(sale.balance_due)}</>}
            </p>

            {fullyReturned ? (
              <p style={{ fontSize: 13, color: 'var(--warning)' }}>Everything on this receipt has already been returned.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {items.map(i => (
                  <div key={i.id} style={{ background: 'var(--navy)', borderRadius: 8, padding: '9px 11px', opacity: i.remaining > 0 ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--light)' }}>{i.product_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          Bought {i.quantity} at {formatNaira(i.unit_price)}
                          {i.returned_quantity > 0 && ` - ${i.returned_quantity} already returned`}
                        </div>
                      </div>
                      <input className="input" type="number" min="0" max={i.remaining} disabled={i.remaining <= 0}
                        aria-label={`Quantity of ${i.product_name} returned`}
                        value={qty[i.id] ?? ''} placeholder="0" onChange={e => setItemQty(i, e.target.value)}
                        style={{ width: 70, textAlign: 'center' }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)', width: 44 }}>of {i.remaining}</span>
                    </div>
                    {(qty[i.id] || 0) > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                        <input type="checkbox" checked={!!damaged[i.id]} onChange={e => setDamaged(d => ({ ...d, [i.id]: e.target.checked }))} />
                        Damaged - don't put back in stock
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}

            {chosen.length > 0 && (
              <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4 }}>
                <span style={{ color: 'var(--muted)' }}>Value of goods returned</span><strong style={{ color: 'var(--light)' }}>{formatNaira(value)}</strong>
                {debtCut > 0 && <><span style={{ color: 'var(--muted)' }}>Taken off what they owe</span><strong style={{ color: 'var(--light)' }}>{formatNaira(debtCut)}</strong></>}
                <span style={{ color: 'var(--muted)' }}>Refund to give the customer</span><strong style={{ color: 'var(--gold)' }}>{formatNaira(refund)}</strong>
              </div>
            )}

            {refund > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>Refund paid by</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['cash', 'Cash'], ['transfer', 'Transfer'], ['pos', 'POS']].map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setMethod(v)} className="btn-ghost"
                      style={{ flex: 1, padding: '7px 0', borderColor: method === v ? 'var(--gold)' : undefined, color: method === v ? 'var(--gold)' : undefined }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!fullyReturned && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>Reason (optional)</label>
                <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Wrong size, faulty, changed mind" maxLength={500} />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              {!fullyReturned && (
                <button type="button" className="btn-gold" style={{ flex: 2 }} disabled={saving || chosen.length === 0} onClick={submit}>
                  {saving ? 'Saving...' : 'Record return'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
