import { useState, useEffect } from 'react'
import { AlertCircle, TrendingUp, DollarSign, ShoppingCart, RefreshCw } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { reportsAPI, branchesAPI } from '../../api/client'
import { formatNaira, formatDate, parseApiError } from '../../utils/format'

function today() {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div style={{
      background: 'var(--blue)', border: '1px solid var(--mid)',
      borderRadius: 10, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ? 'var(--gold)' : 'var(--light)', marginBottom: 2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}

export default function ReportsPage() {
  const [branches, setBranches]   = useState([])
  const [branchId, setBranchId]   = useState('')
  const [dateFrom, setDateFrom]   = useState(daysAgo(29))
  const [dateTo, setDateTo]       = useState(today())
  const [daily, setDaily]         = useState(null)
  const [monthly, setMonthly]     = useState(null)
  const [inventory, setInventory] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    branchesAPI.list().then(res => {
      const raw = res.data
      setBranches(Array.isArray(raw) ? raw : (raw.results ?? []))
    }).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {
        date_from: dateFrom,
        date_to:   dateTo,
        branch_id: branchId || undefined,
      }
      const [dailyRes, monthlyRes, invRes] = await Promise.allSettled([
        reportsAPI.dailySales({ date: today(), branch_id: branchId || undefined }),
        reportsAPI.monthlySales(params),
        reportsAPI.inventory({ branch_id: branchId || undefined }),
      ])
      if (dailyRes.status === 'fulfilled')   setDaily(dailyRes.value.data)
      if (monthlyRes.status === 'fulfilled') setMonthly(monthlyRes.value.data)
      if (invRes.status === 'fulfilled')     setInventory(invRes.value.data)
      if (dailyRes.status === 'rejected') throw dailyRes.reason
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [branchId])

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)' }}>Reports</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {branches.length > 0 && (
            <select className="input" style={{ width: 'auto', fontSize: 13 }}
              value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">All branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input type="date" className="input" style={{ width: 'auto', fontSize: 13 }}
            value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
          <input type="date" className="input" style={{ width: 'auto', fontSize: 13 }}
            value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
            onClick={load} disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Loading…' : 'Run'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
          borderRadius: 'var(--r-sm)', padding: '10px 14px',
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20,
        }}>
          <AlertCircle size={15} color="var(--error)" />
          <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
        </div>
      )}

      {/* Today's Summary */}
      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          Today — {formatDate(today())}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard label="Revenue" value={daily ? formatNaira(daily.total_revenue || 0) : '—'} sub="All payments received" accent />
          <StatCard label="Transactions" value={daily ? (daily.total_transactions ?? '—') : '—'} sub="Completed sales" />
          <StatCard label="Cash" value={daily ? formatNaira(daily.by_payment?.cash || 0) : '—'} sub="Cash payments" />
          <StatCard label="Transfer" value={daily ? formatNaira(daily.by_payment?.transfer || 0) : '—'} sub="Bank transfers" />
          <StatCard label="POS" value={daily ? formatNaira(daily.by_payment?.pos || 0) : '—'} sub="Card / POS terminal" />
        </div>
      </div>

      {/* Period summary */}
      {monthly && (
        <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--light)', marginBottom: 16 }}>
            Period Summary ({formatDate(dateFrom)} – {formatDate(dateTo)})
          </h2>
          {Array.isArray(monthly.results) && monthly.results.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                  {['Date', 'Revenue', 'Transactions', 'Discount'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left', fontSize: 11,
                      color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.results.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--mid)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--light)' }}>{formatDate(row.date || row.week || row.month)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--gold)', fontWeight: 500 }}>{formatNaira(row.total_revenue || row.revenue || 0)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{row.total_transactions ?? row.transactions ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{formatNaira(row.total_discount || row.discount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No sales in this period.</p>
          )}
        </div>
      )}

      {/* Top products */}
      {daily?.top_products?.length > 0 && (
        <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--light)', marginBottom: 16 }}>Top Products Today</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                {['Product', 'Qty Sold', 'Revenue'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left', fontSize: 11,
                    color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.top_products.slice(0, 10).map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--mid)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--light)' }}>{p.product_name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{p.total_qty}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--gold)', fontWeight: 500 }}>{formatNaira(p.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inventory snapshot */}
      {inventory && (
        <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--light)', marginBottom: 16 }}>Inventory Snapshot</h2>
          {inventory.low_stock_items?.length > 0 ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12 }}>
                {inventory.low_stock_items.length} product(s) at or below reorder level
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                    {['Product', 'Branch', 'In Stock', 'Reorder At'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px', textAlign: 'left', fontSize: 11,
                        color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.low_stock_items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--mid)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--light)' }}>{item.product_name}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{item.branch_name}</td>
                      <td style={{ padding: '10px 12px', color: item.quantity_in_stock === 0 ? 'var(--error)' : 'var(--warning)', fontWeight: 500 }}>
                        {item.quantity_in_stock}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{item.reorder_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p style={{ color: 'var(--success)', fontSize: 13 }}>All products are above reorder level.</p>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AppLayout>
  )
}
