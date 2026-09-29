import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, TrendingUp, DollarSign, ShoppingCart, RefreshCw, Search, Printer, Phone, ArrowRight } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { reportsAPI, branchesAPI, salesAPI } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { formatNaira, formatDate, parseApiError } from '../../utils/format'
import { printSaleReceipt } from '../../utils/printDoc'

const PAYMENT_STATUS_STYLE = {
  paid:            { bg: 'rgba(76,175,125,0.12)', color: 'var(--success)' },
  partial:         { bg: 'rgba(255,165,0,0.12)',  color: 'var(--warning)' },
  unpaid:          { bg: 'rgba(224,85,85,0.12)',  color: 'var(--error)' },
}

function StatusBadge({ status }) {
  const s = PAYMENT_STATUS_STYLE[status] || { bg: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11,
      textTransform: 'capitalize', background: s.bg, color: s.color,
    }}>
      {status || '—'}
    </span>
  )
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function startOfYear() {
  const d = new Date()
  return `${d.getFullYear()}-01-01`
}

const QUICK_RANGES = [
  { label: '7d',  from: () => daysAgo(6) },
  { label: '30d', from: () => daysAgo(29) },
  { label: '90d', from: () => daysAgo(89) },
  { label: 'This year', from: startOfYear },
  { label: 'All time', from: () => '2020-01-01' },
]

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
  const { user } = useAuth()
  const navigate = useNavigate()
  const [branches, setBranches]   = useState([])
  const [branchId, setBranchId]   = useState('')
  const [dateFrom, setDateFrom]   = useState(daysAgo(89))
  const [dateTo, setDateTo]       = useState(today())
  const [daily, setDaily]         = useState(null)
  const [monthly, setMonthly]     = useState(null)
  const [inventory, setInventory] = useState(null)
  const [debtors, setDebtors]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // -- Transaction history ----------------------------------------------------
  const [sales, setSales]               = useState([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesSearch, setSalesSearch]   = useState('')
  const [printingId, setPrintingId]     = useState(null)
  const salesSearchTimer                = useRef(null)

  useEffect(() => {
    branchesAPI.list()
      .then(res => {
        const raw = res.data
        setBranches(Array.isArray(raw) ? raw : (raw.results ?? []))
      })
      .catch(err => setError(parseApiError(err)))
  }, [])

  // Accept explicit dates so a quick-range click can run immediately
  // instead of racing the setDateFrom/setDateTo state update.
  const load = async (fromOverride, toOverride) => {
    const df = fromOverride ?? dateFrom
    const dt = toOverride ?? dateTo
    setLoading(true)
    setError('')
    try {
      const params = {
        date_from: df,
        date_to:   dt,
        branch_id: branchId || undefined,
      }
      const [dailyRes, monthlyRes, invRes, debtorsRes] = await Promise.allSettled([
        reportsAPI.dailySales({ date: today(), branch_id: branchId || undefined }),
        reportsAPI.monthlySales(params),
        reportsAPI.inventory({ branch_id: branchId || undefined }),
        reportsAPI.debtors({ branch_id: branchId || undefined }),
      ])
      if (dailyRes.status === 'fulfilled')   setDaily(dailyRes.value.data)
      if (monthlyRes.status === 'fulfilled') setMonthly(monthlyRes.value.data)
      if (invRes.status === 'fulfilled')     setInventory(invRes.value.data)
      if (debtorsRes.status === 'fulfilled') setDebtors(debtorsRes.value.data)
      if (dailyRes.status === 'rejected') throw dailyRes.reason
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
    loadSales(df, dt)
  }

  const loadSales = async (fromOverride, toOverride) => {
    setSalesLoading(true)
    try {
      const res = await salesAPI.list({
        date_from: fromOverride ?? dateFrom,
        date_to:   toOverride ?? dateTo,
        branch_id: branchId || undefined,
        search:    salesSearch.trim() || undefined,
      })
      const raw = res.data
      setSales(Array.isArray(raw) ? raw : (raw.results ?? []))
    } catch {
      setSales([])
    } finally {
      setSalesLoading(false)
    }
  }

  useEffect(() => { load() }, [branchId])

  // Search re-queries on its own (debounced) - date/branch changes only
  // re-query once "Run" is pressed, matching the rest of this page.
  useEffect(() => {
    clearTimeout(salesSearchTimer.current)
    salesSearchTimer.current = setTimeout(loadSales, 300)
    return () => clearTimeout(salesSearchTimer.current)
  }, [salesSearch])

  const handleReprint = async (sale) => {
    setPrintingId(sale.id)
    try {
      const res = await salesAPI.get(sale.id)
      printSaleReceipt(res.data, res.data.business_name || user?.business_name, user?.business_logo)
    } catch {
      alert('Could not load this receipt. Please try again.')
    } finally {
      setPrintingId(null)
    }
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
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

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {QUICK_RANGES.map(r => {
          const active = dateFrom === r.from()
          return (
            <button key={r.label} onClick={() => { const f = r.from(), t = today(); setDateFrom(f); setDateTo(t); load(f, t); }}
              style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                background: active ? 'var(--gold-dim)' : 'transparent',
                border: `1px solid ${active ? 'rgba(201,168,76,0.3)' : 'var(--mid)'}`,
                color: active ? 'var(--gold)' : 'var(--muted)',
              }}>
              {r.label}
            </button>
          )
        })}
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

      {/* Transaction history */}
      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--light)' }}>
            Transaction History ({formatDate(dateFrom)} – {formatDate(dateTo)})
          </h2>
          <div style={{ position: 'relative', width: 240, maxWidth: '100%' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input" placeholder="Search receipt #, customer, item..."
              style={{ width: '100%', paddingLeft: 30, fontSize: 13 }}
              value={salesSearch} onChange={e => setSalesSearch(e.target.value)}
            />
          </div>
        </div>

        {salesLoading ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : sales.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {salesSearch
              ? `No transactions match "${salesSearch}".`
              : `No transactions between ${formatDate(dateFrom)} and ${formatDate(dateTo)} — try "This year" or "All time" above if you expected some here.`}
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                  {['Date', 'Receipt #', 'Customer', 'Branch', 'Status', 'Amount', ''].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: h === 'Amount' ? 'right' : 'left', fontSize: 11,
                      color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--mid)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(s.sale_date || s.created_at)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--light)' }}>{s.sale_number ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--light)' }}>{s.customer_name ?? 'Walk-in'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{s.branch_name ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={s.payment_status} /></td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--gold)', fontWeight: 500 }}>{formatNaira(s.total_amount || 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleReprint(s)}
                        disabled={printingId === s.id}
                        style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: 'none', border: '1px solid var(--mid)', color: 'var(--gold)', cursor: printingId === s.id ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                        title="Print receipt">
                        <Printer size={11} /> {printingId === s.id ? 'Loading…' : 'Print'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Outstanding debts - installment sale balances + unpaid job cards.
          Not date-range scoped: a debt doesn't stop mattering once it falls
          outside the selected window. */}
      {debtors && (() => {
        const saleRows = (debtors.debtors || []).map(d => ({
          key: `sale-${d.plan_id}`,
          name: d.customer_name,
          phone: d.customer_phone,
          reference: d.sale_number,
          balance: parseFloat(d.balance || 0),
          daysOutstanding: d.days_outstanding,
          kind: 'Sale',
          go: () => d.customer_id && navigate(`/customers?q=${encodeURIComponent(d.customer_phone || d.customer_name)}`),
        }))
        const jobRows = (debtors.unpaid_job_cards || []).map(j => ({
          key: `job-${j.job_number}`,
          name: j.customer_name,
          phone: j.customer_phone,
          reference: j.job_number,
          balance: parseFloat(j.balance_due || 0),
          daysOutstanding: null,
          kind: 'Job Card',
          go: () => navigate(`/jobcards?q=${encodeURIComponent(j.job_number)}`),
        }))
        const rows = [...saleRows, ...jobRows].sort((a, b) => b.balance - a.balance)

        return (
          <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--light)' }}>Outstanding Debts</h2>
              {rows.length > 0 && (
                <span style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 600 }}>
                  {formatNaira(debtors.total_outstanding || 0)} total
                </span>
              )}
            </div>
            {rows.length === 0 ? (
              <p style={{ color: 'var(--success)', fontSize: 13 }}>No outstanding balances — everyone's paid up.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                      {['Customer', 'Phone', 'Reference', 'Type', 'Days', 'Balance', ''].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: h === 'Balance' ? 'right' : 'left', fontSize: 11,
                          color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.key} style={{ borderBottom: '1px solid var(--mid)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--light)' }}>{r.name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>
                          {r.phone
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{r.phone}</span>
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--muted)', fontFamily: 'monospace' }}>{r.reference}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{r.kind}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{r.daysOutstanding != null ? `${r.daysOutstanding}d` : '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--error)', fontWeight: 600 }}>{formatNaira(r.balance)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button onClick={r.go}
                            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 4, background: 'none', border: '1px solid var(--mid)', color: 'var(--gold)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                            title="Go collect this payment">
                            Track <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

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
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No sales in this period — try widening the date range above.</p>
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
