import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, LogOut, Search, X, RefreshCw, Building2, Users, Activity,
  LayoutDashboard, Copy, KeyRound, MessageCircle, ChevronDown, ChevronRight,
} from 'lucide-react'
import { platformAPI } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatNaira, formatDate, formatDateTime, parseApiError } from '../../utils/format'

// ─── Small shared pieces ──────────────────────────────────────────────────

const card = { background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '16px 18px' }
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }
const td = { padding: '9px 10px', fontSize: 13, color: 'var(--light)', verticalAlign: 'top' }
const tdMuted = { ...td, color: 'var(--muted)' }

const ACTIONS = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_ISSUED']

function Stat({ label, value, sub, accent }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 'clamp(16px, 1.6vw, 22px)', fontWeight: 700, color: accent ? 'var(--gold)' : 'var(--light)', overflowWrap: 'anywhere' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function StatusPill({ active, labels = ['Active', 'Disabled'] }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
      background: active ? 'rgba(76,175,125,0.12)' : 'rgba(224,85,85,0.12)',
      color: active ? 'var(--success)' : 'var(--error)',
    }}>{active ? labels[0] : labels[1]}</span>
  )
}

function SmallButton({ children, onClick, danger, disabled, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      fontSize: 11, padding: '3px 9px', borderRadius: 4, background: 'none', whiteSpace: 'nowrap',
      border: '1px solid var(--mid)', cursor: disabled ? 'wait' : 'pointer',
      color: danger ? 'var(--error)' : 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>{children}</button>
  )
}

function Table({ headers, children, empty, colSpan }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ borderBottom: '1px solid var(--mid)' }}>
          {headers.map(h => <th key={h} style={{ ...th, textAlign: /price|revenue|total|profit|cost|stock|sales|users|margin|qty/i.test(h) ? 'right' : 'left' }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {children}
          {empty && <tr><td colSpan={colSpan || headers.length} style={{ ...tdMuted, textAlign: 'center', padding: 20 }}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Modal({ title, onClose, children, width = 1000 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 12px', overflowY: 'auto' }}>
      <div style={{ ...card, width: '100%', maxWidth: width, padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--light)', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const right = (style = td) => ({ ...style, textAlign: 'right', whiteSpace: 'nowrap' })
const ngPhoneForWhatsApp = (phone) => {
  const digits = (phone || '').replace(/\D/g, '')
  return digits.startsWith('0') ? `234${digits.slice(1)}` : digits
}

// ─── Reset link dialog ────────────────────────────────────────────────────

function ResetLinkDialog({ result, onClose }) {
  const toast = useToast()
  const message = `Hello ${result.user.full_name}, use this link to set a new ShopKepa password (valid for 30 minutes, one use only): ${result.reset_url}`
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.reset_url); toast.success('Reset link copied') }
    catch { toast.error('Could not copy - select the link and copy it manually') }
  }
  return (
    <Modal title={`Password reset link — ${result.user.full_name}`} onClose={onClose} width={560}>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Send this to the user. It works once and expires in {result.expires_in_minutes} minutes.
        Their current password keeps working until they use it.
      </p>
      <div style={{ background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 8, padding: 10, fontSize: 12, color: 'var(--light)', wordBreak: 'break-all', marginBottom: 14 }}>
        {result.reset_url}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-gold" style={{ width: 'auto', padding: '8px 16px' }} onClick={copy}><Copy size={14} /> Copy link</button>
        {result.user.phone_number && (
          <a className="btn-ghost" style={{ textDecoration: 'none' }} target="_blank" rel="noreferrer"
            href={`https://wa.me/${ngPhoneForWhatsApp(result.user.phone_number)}?text=${encodeURIComponent(message)}`}>
            <MessageCircle size={14} /> Send on WhatsApp
          </a>
        )}
      </div>
    </Modal>
  )
}

// ─── User actions (shared by Users tab and business detail) ───────────────

function useUserActions(onChanged) {
  const toast = useToast()
  const [busyId, setBusyId] = useState(null)
  const [resetResult, setResetResult] = useState(null)

  const toggle = async (u) => {
    const disabling = u.is_active
    if (disabling && !window.confirm(`Disable ${u.full_name}? They'll be signed out everywhere and can't log in until re-enabled.`)) return
    setBusyId(u.id)
    try {
      await platformAPI.updateUser(u.id, { is_active: !u.is_active })
      toast.success(`${u.full_name} ${disabling ? 'disabled' : 're-enabled'}`)
      onChanged?.()
    } catch (err) { toast.error(parseApiError(err)) }
    finally { setBusyId(null) }
  }

  const reset = async (u) => {
    setBusyId(u.id)
    try { setResetResult((await platformAPI.resetLink(u.id)).data) }
    catch (err) { toast.error(parseApiError(err)) }
    finally { setBusyId(null) }
  }

  const dialog = resetResult && <ResetLinkDialog result={resetResult} onClose={() => setResetResult(null)} />
  return { toggle, reset, busyId, dialog }
}

function UserActionButtons({ u, actions }) {
  if (u.is_superuser) return <span style={{ fontSize: 11, color: 'var(--muted)' }}>platform admin</span>
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <SmallButton onClick={() => actions.reset(u)} disabled={actions.busyId === u.id} title="Generate a one-time password reset link">
        <KeyRound size={11} /> Reset link
      </SmallButton>
      <SmallButton onClick={() => actions.toggle(u)} disabled={actions.busyId === u.id} danger={u.is_active}>
        {u.is_active ? 'Disable' : 'Enable'}
      </SmallButton>
    </div>
  )
}

// ─── Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ openBusiness }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { platformAPI.overview().then(r => setData(r.data)).catch(e => setError(parseApiError(e))) }, [])

  if (error) return <p style={{ color: 'var(--error)' }}>{error}</p>
  if (!data) return <p style={{ color: 'var(--muted)' }}>Loading…</p>

  const { businesses: b, users: u, sales: s } = data
  const maxSignups = Math.max(1, ...data.signups_by_day.map(d => d.count))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 45%), 1fr))', gap: 12 }}>
        <Stat label="Businesses" value={b.total} sub={`${b.active} active · ${b.disabled} disabled`} />
        <Stat label="Used in last 7 days" value={b.used_in_last_7d} sub="sold or logged in" />
        <Stat label="New businesses" value={b.new_30d} sub={`${b.new_7d} in last 7 days`} />
        <Stat label="Users" value={u.total} sub={`${u.active} active · ${u.disabled} disabled`} />
        <Stat label="Sales today" value={formatNaira(s.today.revenue)} sub={`${s.today.count} transactions`} accent />
        <Stat label="Sales, last 30 days" value={formatNaira(s.last_30d.revenue)} sub={`${s.last_30d.count} transactions`} accent />
        <Stat label="Sales, all time" value={formatNaira(s.all_time.revenue)} sub={`${s.all_time.count} transactions`} />
        <Stat label="Owed to shops" value={formatNaira(s.all_time.outstanding)} sub="unpaid customer balances" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={card}>
          <h3 style={{ fontSize: 13, color: 'var(--light)', margin: '0 0 12px' }}>Signups, last 30 days</h3>
          {data.signups_by_day.length === 0 ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>No signups in the last 30 days.</p> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
              {data.signups_by_day.map(d => (
                <div key={d.date} title={`${formatDate(d.date)}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{d.count}</span>
                  <div style={{ width: '100%', maxWidth: 22, height: `${(d.count / maxSignups) * 80}px`, minHeight: 4, background: 'var(--gold)', borderRadius: 3 }} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={card}>
          <h3 style={{ fontSize: 13, color: 'var(--light)', margin: '0 0 12px' }}>Top businesses by sales, last 30 days</h3>
          {data.top_businesses_30d.length === 0 ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>No sales in the last 30 days.</p>
            : data.top_businesses_30d.map(t => (
              <button key={t.id} onClick={() => openBusiness(t.id)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--mid)', padding: '8px 0', cursor: 'pointer', fontSize: 13 }}>
                <span style={{ color: 'var(--light)' }}>{t.name}</span>
                <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatNaira(t.revenue)}</span>
              </button>
            ))}
        </div>
        <div style={card}>
          <h3 style={{ fontSize: 13, color: 'var(--light)', margin: '0 0 12px' }}>Newest businesses</h3>
          {data.recent_signups.map(r => (
            <button key={r.id} onClick={() => openBusiness(r.id)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--mid)', padding: '8px 0', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>
              <span style={{ color: 'var(--light)' }}>{r.name}<span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{r.owner_name}</span></span>
              <span style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Businesses ───────────────────────────────────────────────────────────

function useSearchList(fetcher, filters) {
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const key = JSON.stringify(filters)

  const load = useCallback(async (p = 1) => {
    setLoading(true); setError('')
    try {
      const res = await fetcher({ ...filters, page: p })
      setRows(prev => p === 1 ? res.data.results : [...prev, ...res.data.results])
      setCount(res.data.count); setPage(p)
    } catch (e) { setError(parseApiError(e)) }
    finally { setLoading(false) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => load(1), 300)
    return () => clearTimeout(t)
  }, [load])

  return { rows, count, loading, error, reload: () => load(1), more: rows.length < count ? () => load(page + 1) : null }
}

function FilterBar({ search, setSearch, status, setStatus, placeholder, onRefresh, loading, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input className="input" placeholder={placeholder} value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32, fontSize: 13 }} />
      </div>
      {setStatus && (
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      )}
      {children}
      <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={onRefresh} title="Refresh">
        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
      </button>
    </div>
  )
}

function LoadMore({ more, loading, shown, count }) {
  if (shown === 0) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
      <span>Showing {shown} of {count}</span>
      {more && <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={more} disabled={loading}>{loading ? 'Loading…' : 'Load more'}</button>}
    </div>
  )
}

function BusinessesTab({ openBusiness, refreshKey }) {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const list = useSearchList(platformAPI.businesses, { search: search || undefined, status: status || undefined, refreshKey })
  const [busyId, setBusyId] = useState(null)

  const toggle = async (b) => {
    if (b.is_active && !window.confirm(`Disable ${b.name}? Everyone in this business will be locked out immediately.`)) return
    setBusyId(b.id)
    try {
      await platformAPI.updateBusiness(b.id, { is_active: !b.is_active })
      toast.success(`${b.name} ${b.is_active ? 'disabled' : 're-enabled'}`)
      list.reload()
    } catch (e) { toast.error(parseApiError(e)) }
    finally { setBusyId(null) }
  }

  return (
    <div style={card}>
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        placeholder="Search business, owner, email, phone…" onRefresh={list.reload} loading={list.loading} />
      {list.error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{list.error}</p>}
      <Table headers={['Business', 'Contact', 'Signed up', 'Modules', 'Users', 'Sales', 'Revenue', 'Last active', 'Plan', 'Status', '']}
        empty={list.rows.length === 0 ? (list.loading ? 'Loading…' : 'No businesses match.') : null}>
        {list.rows.map(b => (
          <tr key={b.id} style={{ borderTop: '1px solid var(--mid)', opacity: b.is_active ? 1 : 0.6 }}>
            <td style={td}>
              <button onClick={() => openBusiness(b.id)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--gold)', cursor: 'pointer', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>{b.name}</button>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.owner_name}</div>
            </td>
            <td style={tdMuted}><div>{b.email || '—'}</div><div style={{ fontSize: 11 }}>{b.phone_number}</div></td>
            <td style={{ ...tdMuted, whiteSpace: 'nowrap' }}>{formatDate(b.created_at)}</td>
            <td style={tdMuted} title={b.modules.join(', ')}>{b.modules.length ? `${b.modules.length} active` : 'None'}</td>
            <td style={right(tdMuted)}>{b.user_count}</td>
            <td style={right(tdMuted)}>{b.sales_count}</td>
            <td style={{ ...right(), color: 'var(--gold)' }}>{formatNaira(b.revenue)}</td>
            <td style={{ ...tdMuted, whiteSpace: 'nowrap' }}>{b.last_activity_at ? formatDate(b.last_activity_at) : 'Never'}</td>
            <td style={{ ...tdMuted, textTransform: 'capitalize' }}>{b.subscription_tier}</td>
            <td style={td}><StatusPill active={b.is_active} /></td>
            <td style={right()}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <SmallButton onClick={() => openBusiness(b.id)}>View</SmallButton>
                <SmallButton onClick={() => toggle(b)} disabled={busyId === b.id} danger={b.is_active}>{b.is_active ? 'Disable' : 'Enable'}</SmallButton>
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <LoadMore more={list.more} loading={list.loading} shown={list.rows.length} count={list.count} />
    </div>
  )
}

function MoneyRow({ label, value, strong, tone }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--mid)', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 500, color: tone || 'var(--light)' }}>{value}</span>
    </div>
  )
}

function BusinessDetail({ id, onClose, onChanged }) {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    platformAPI.business(id).then(r => {
      setData(r.data)
      const b = r.data.business
      setPlan({
        subscription_tier: b.subscription_tier,
        subscription_expires_at: b.subscription_expires_at ? b.subscription_expires_at.slice(0, 10) : '',
        ai_queries_limit: String(b.ai_queries_limit),
      })
    }).catch(e => setError(parseApiError(e)))
  }, [id])
  useEffect(() => { load() }, [load])
  const actions = useUserActions(load)

  const save = async (patch, message) => {
    setSaving(true)
    try { await platformAPI.updateBusiness(id, patch); toast.success(message); load(); onChanged() }
    catch (e) { toast.error(parseApiError(e)) }
    finally { setSaving(false) }
  }
  const savePlan = () => save({
    subscription_tier: plan.subscription_tier,
    subscription_expires_at: plan.subscription_expires_at ? `${plan.subscription_expires_at}T23:59:59Z` : null,
    ai_queries_limit: parseInt(plan.ai_queries_limit, 10) || 0,
  }, 'Plan updated')
  const toggleBusiness = () => {
    const b = data.business
    if (b.is_active && !window.confirm(`Disable ${b.name}? Everyone in it is locked out immediately.`)) return
    save({ is_active: !b.is_active }, `${b.name} ${b.is_active ? 'disabled' : 're-enabled'}`)
  }

  const b = data?.business
  return (
    <Modal title={b ? b.name : 'Loading…'} onClose={onClose}>
      {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
      {!data ? (!error && <p style={{ color: 'var(--muted)' }}>Loading…</p>) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Identity + status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div style={{ ...card, background: 'var(--navy)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <StatusPill active={b.is_active} />
                <SmallButton onClick={toggleBusiness} disabled={saving} danger={b.is_active}>{b.is_active ? 'Disable business' : 'Enable business'}</SmallButton>
              </div>
              <MoneyRow label="Owner" value={b.owner_name} />
              <MoneyRow label="Email" value={b.email || '—'} />
              <MoneyRow label="Phone" value={b.phone_number} />
              <MoneyRow label="Address" value={b.address || '—'} />
              <MoneyRow label="Signed up" value={formatDateTime(b.created_at)} />
              <MoneyRow label="Modules" value={b.modules.join(', ') || 'None'} />
              <MoneyRow label="Branches" value={data.branches.map(x => x.name).join(', ')} />
            </div>
            <div style={{ ...card, background: 'var(--navy)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Subscription</div>
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>Plan</label>
              <select className="input" style={{ marginBottom: 8, fontSize: 13 }} value={plan.subscription_tier} onChange={e => setPlan(p => ({ ...p, subscription_tier: e.target.value }))}>
                <option value="free">Free</option><option value="basic">Basic</option><option value="pro">Pro</option>
              </select>
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>Expires on</label>
              <input className="input" type="date" style={{ marginBottom: 8, fontSize: 13 }} value={plan.subscription_expires_at} onChange={e => setPlan(p => ({ ...p, subscription_expires_at: e.target.value }))} />
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>AI queries limit (used {b.ai_queries_used})</label>
              <input className="input" type="number" min="0" style={{ marginBottom: 10, fontSize: 13 }} value={plan.ai_queries_limit} onChange={e => setPlan(p => ({ ...p, ai_queries_limit: e.target.value }))} />
              <button className="btn-gold" style={{ padding: '8px 16px' }} onClick={savePlan} disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button>
            </div>
          </div>

          {/* Money */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {[['Last 30 days', data.sales.last_30d], ['All time', data.sales.all_time]].map(([label, m]) => (
              <div key={label} style={{ ...card, background: 'var(--navy)' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{label} · {m.count} sales</div>
                <MoneyRow label="Sold for (revenue)" value={formatNaira(m.revenue)} tone="var(--gold)" />
                <MoneyRow label="Collected" value={formatNaira(m.collected)} />
                <MoneyRow label="Owed by customers" value={formatNaira(m.outstanding)} tone={parseFloat(m.outstanding) > 0 ? 'var(--warning)' : undefined} />
                <MoneyRow label="Bought for (cost of goods)" value={formatNaira(m.cost_of_goods)} />
                <MoneyRow label="Gross profit" value={formatNaira(m.gross_profit)} strong tone="var(--success)" />
                {m.expenses !== undefined && <>
                  <MoneyRow label="Expenses" value={formatNaira(m.expenses)} />
                  <MoneyRow label="Net profit (estimate)" value={formatNaira(m.net_profit_estimate)} strong tone={parseFloat(m.net_profit_estimate) >= 0 ? 'var(--success)' : 'var(--error)'} />
                </>}
                {m.lines_without_cost_price > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{m.lines_without_cost_price} sold item(s) have no cost price, so they're left out of profit.</div>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -10 }}>Cost of goods uses each product's current cost price.</div>

          {/* Users */}
          <section>
            <h3 style={{ fontSize: 14, color: 'var(--light)', margin: '0 0 8px' }}>Users ({data.users.length})</h3>
            <Table headers={['Name', 'Login (username / email)', 'Phone', 'Role', 'Signed up', 'Last login', 'Status', '']}>
              {data.users.map(u => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--mid)', opacity: u.is_deleted ? 0.6 : 1 }}>
                  <td style={td}>{u.full_name}</td>
                  <td style={tdMuted}><div>@{u.username}</div><div style={{ fontSize: 11 }}>{u.email}</div></td>
                  <td style={tdMuted}>{u.phone_number}</td>
                  <td style={{ ...tdMuted, textTransform: 'capitalize' }}>{u.role}</td>
                  <td style={{ ...tdMuted, whiteSpace: 'nowrap' }}>{formatDate(u.signed_up_at)}</td>
                  <td style={{ ...tdMuted, whiteSpace: 'nowrap' }}>{u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}<div style={{ fontSize: 11 }}>{u.login_count} logins{u.last_login_ip ? ` · ${u.last_login_ip}` : ''}</div></td>
                  <td style={td}>{u.is_deleted
                    ? <StatusPill active={false} labels={['', 'Removed']} />
                    : <StatusPill active={u.is_active} />}</td>
                  <td style={right()}>{!u.is_deleted && <UserActionButtons u={u} actions={actions} />}</td>
                </tr>
              ))}
            </Table>
          </section>

          {/* Products: bought vs sold prices */}
          <section>
            <h3 style={{ fontSize: 14, color: 'var(--light)', margin: '0 0 8px' }}>Products — cost vs selling price ({data.products.length})</h3>
            <Table headers={['Product', 'Module / category', 'Cost price', 'Wholesale price', 'Retail price', 'Margin', 'Stock']}
              empty={data.products.length === 0 ? 'No products yet.' : null}>
              {data.products.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--mid)', opacity: p.is_active ? 1 : 0.6 }}>
                  <td style={td}>{p.name}{p.sku && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.sku}</div>}</td>
                  <td style={tdMuted}>{p.module}{p.category && <div style={{ fontSize: 11 }}>{p.category}</div>}</td>
                  <td style={right(tdMuted)}>{p.cost_price != null ? formatNaira(p.cost_price) : '—'}</td>
                  <td style={right(tdMuted)}>{formatNaira(p.wholesale_price)}</td>
                  <td style={{ ...right(), color: 'var(--gold)' }}>{formatNaira(p.retail_price)}</td>
                  <td style={{ ...right(), color: p.margin_pct == null ? 'var(--muted)' : parseFloat(p.margin_pct) < 0 ? 'var(--error)' : 'var(--success)' }}>{p.margin_pct != null ? `${p.margin_pct}%` : '—'}</td>
                  <td style={right(tdMuted)}>{p.stock}</td>
                </tr>
              ))}
            </Table>
          </section>

          {/* Recent sales: what each item actually sold for */}
          <section>
            <h3 style={{ fontSize: 14, color: 'var(--light)', margin: '0 0 8px' }}>Recently sold items</h3>
            <Table headers={['Date', 'Receipt', 'Item', 'Qty', 'Sold at (each)', 'Cost (each)', 'Line total']}
              empty={data.recent_sale_lines.length === 0 ? 'No sales yet.' : null}>
              {data.recent_sale_lines.map((l, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--mid)' }}>
                  <td style={{ ...tdMuted, whiteSpace: 'nowrap' }}>{formatDateTime(l.date)}</td>
                  <td style={{ ...tdMuted, fontFamily: 'monospace' }}>{l.sale_number}</td>
                  <td style={td}>{l.product}{l.price_type !== 'retail' && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6, textTransform: 'uppercase' }}>{l.price_type}</span>}</td>
                  <td style={right(tdMuted)}>{l.quantity}</td>
                  <td style={right()}>{formatNaira(l.sold_unit_price)}</td>
                  <td style={right(tdMuted)}>{l.cost_price != null ? formatNaira(l.cost_price) : '—'}</td>
                  <td style={{ ...right(), color: 'var(--gold)' }}>{formatNaira(l.line_total)}</td>
                </tr>
              ))}
            </Table>
          </section>

          <section>
            <h3 style={{ fontSize: 14, color: 'var(--light)', margin: '0 0 8px' }}>Recent activity</h3>
            <ActivityRows rows={data.activity} showBusiness={false} />
          </section>
        </div>
      )}
      {actions.dialog}
    </Modal>
  )
}

// ─── Users ────────────────────────────────────────────────────────────────

function UsersTab({ openBusiness }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [role, setRole] = useState('')
  const list = useSearchList(platformAPI.users, { search: search || undefined, status: status || undefined, role: role || undefined })
  const actions = useUserActions(list.reload)

  return (
    <div style={card}>
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        placeholder="Search name, username, email, phone, business…" onRefresh={list.reload} loading={list.loading}>
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={role} onChange={e => setRole(e.target.value)}>
          <option value="">All roles</option><option value="owner">Owner</option><option value="manager">Manager</option><option value="cashier">Cashier</option>
        </select>
      </FilterBar>
      {list.error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{list.error}</p>}
      <Table headers={['Name', 'Login (username / email)', 'Phone', 'Business', 'Role', 'Signed up', 'Last login', 'Status', '']}
        empty={list.rows.length === 0 ? (list.loading ? 'Loading…' : 'No users match.') : null}>
        {list.rows.map(u => (
          <tr key={u.id} style={{ borderTop: '1px solid var(--mid)', opacity: u.is_active ? 1 : 0.6 }}>
            <td style={td}>{u.full_name}</td>
            <td style={tdMuted}><div>@{u.username}</div><div style={{ fontSize: 11 }}>{u.email}</div></td>
            <td style={tdMuted}>{u.phone_number}</td>
            <td style={td}>{u.business
              ? <button onClick={() => openBusiness(u.business.id)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--gold)', cursor: 'pointer', fontSize: 13, textAlign: 'left' }}>{u.business.name}</button>
              : <span style={{ color: 'var(--muted)' }}>—</span>}
              {u.business && !u.business.is_active && <div style={{ fontSize: 11, color: 'var(--error)' }}>business disabled</div>}
            </td>
            <td style={{ ...tdMuted, textTransform: 'capitalize' }}>{u.role}</td>
            <td style={{ ...tdMuted, whiteSpace: 'nowrap' }}>{formatDate(u.signed_up_at)}</td>
            <td style={{ ...tdMuted, whiteSpace: 'nowrap' }}>{u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}<div style={{ fontSize: 11 }}>{u.login_count} logins{u.last_login_ip ? ` · ${u.last_login_ip}` : ''}</div></td>
            <td style={td}><StatusPill active={u.is_active} /></td>
            <td style={right()}><UserActionButtons u={u} actions={actions} /></td>
          </tr>
        ))}
      </Table>
      <LoadMore more={list.more} loading={list.loading} shown={list.rows.length} count={list.count} />
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
        Passwords are stored one-way scrambled and can't be shown to anyone. Use "Reset link" to get a user back into their account.
      </p>
      {actions.dialog}
    </div>
  )
}

// ─── Activity ─────────────────────────────────────────────────────────────

const humanTable = (t) => (t || '').replace('platform:', 'admin → ').replace(/_/g, ' ')

function ActivityRows({ rows, showBusiness = true, openBusiness, loading }) {
  const [open, setOpen] = useState(null)
  return (
    <Table headers={['When', ...(showBusiness ? ['Business'] : []), 'Who', 'Action', 'On', 'IP', '']}
      empty={rows.length === 0 ? (loading ? 'Loading…' : 'No activity.') : null}>
      {rows.map(a => {
        const hasDetail = a.new_values || a.old_values
        return [
          <tr key={a.id} style={{ borderTop: '1px solid var(--mid)' }}>
            <td style={{ ...tdMuted, whiteSpace: 'nowrap' }}>{formatDateTime(a.at)}</td>
            {showBusiness && <td style={td}>{a.business_name
              ? <button onClick={() => openBusiness?.(a.business_id)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--gold)', cursor: 'pointer', fontSize: 13 }}>{a.business_name}</button>
              : '—'}</td>}
            <td style={td}>{a.user_name || '—'}</td>
            <td style={td}><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--navy)', border: '1px solid var(--mid)', whiteSpace: 'nowrap' }}>{a.action.replace(/_/g, ' ').toLowerCase()}</span></td>
            <td style={tdMuted}>{humanTable(a.table)}</td>
            <td style={{ ...tdMuted, fontFamily: 'monospace', fontSize: 12 }}>{a.ip_address || '—'}</td>
            <td style={right()}>{hasDetail && (
              <button onClick={() => setOpen(open === a.id ? null : a.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }} title="Details">
                {open === a.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}</td>
          </tr>,
          open === a.id && (
            <tr key={`${a.id}-d`}><td colSpan={showBusiness ? 7 : 6} style={{ padding: '0 10px 10px' }}>
              <pre style={{ margin: 0, fontSize: 11, color: 'var(--muted)', background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 6, padding: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify({ before: a.old_values ?? undefined, after: a.new_values ?? undefined }, null, 2)}
              </pre>
            </td></tr>
          ),
        ]
      })}
    </Table>
  )
}

function ActivityTab({ openBusiness }) {
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const list = useSearchList(platformAPI.activity, {
    action: action || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined,
  })
  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={action} onChange={e => setAction(e.target.value)}>
          <option value="">All actions</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ').toLowerCase()}</option>)}
        </select>
        <input className="input" type="date" style={{ width: 'auto', fontSize: 13 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
        <input className="input" type="date" style={{ width: 'auto', fontSize: 13 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="btn-ghost" style={{ padding: '7px 12px' }} onClick={list.reload}><RefreshCw size={13} /></button>
      </div>
      {list.error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{list.error}</p>}
      <ActivityRows rows={list.rows} openBusiness={openBusiness} loading={list.loading} />
      <LoadMore more={list.more} loading={list.loading} shown={list.rows.length} count={list.count} />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'businesses', label: 'Businesses', icon: Building2 },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'activity', label: 'Activity', icon: Activity },
]

export default function PlatformPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [businessId, setBusinessId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--navy)' }}>
      <header style={{ background: 'var(--blue)', borderBottom: '1px solid var(--mid)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="var(--gold)" />
            <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 16 }}>ShopKepa</span>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>Platform admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user?.business_id && <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => navigate('/dashboard')}>My business</button>}
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{user?.full_name}</span>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={async () => { await logout(); navigate('/login') }}>
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 16px 40px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: tab === key ? 'var(--gold-dim)' : 'var(--blue)',
              color: tab === key ? 'var(--gold)' : 'var(--muted)',
              border: `1px solid ${tab === key ? 'rgba(201,168,76,0.3)' : 'var(--mid)'}`,
            }}><Icon size={14} /> {label}</button>
          ))}
        </div>

        {tab === 'overview'   && <OverviewTab openBusiness={setBusinessId} />}
        {tab === 'businesses' && <BusinessesTab openBusiness={setBusinessId} refreshKey={refreshKey} />}
        {tab === 'users'      && <UsersTab openBusiness={setBusinessId} />}
        {tab === 'activity'   && <ActivityTab openBusiness={setBusinessId} />}
      </main>

      {businessId && (
        <BusinessDetail id={businessId} onClose={() => setBusinessId(null)} onChanged={() => setRefreshKey(k => k + 1)} />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
