import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../../components/layout/AppLayout'
import { salesAPI, productsAPI, customersAPI, jobCardsAPI, hotelAPI } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

function StatCard({ label, value, sub, accent = false, linkTo }) {
  const inner = (
    <div style={{
      background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10,
      padding: '20px 24px', transition: 'border-color 0.15s',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent ? 'var(--gold)' : 'var(--light)', marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
  if (linkTo) return <Link to={linkTo} style={{ textDecoration: 'none' }}>{inner}</Link>
  return inner
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmt(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ─── Section: Sales KPIs ──────────────────────────────────────────────────

function SalesSection({ activeCodes }) {
  const [stats, setStats] = useState({ revenue: 0, sales: 0, products: 0, customers: 0 })
  const [recentSales, setRecentSales] = useState([])
  const [loading, setLoading] = useState(true)
  const hasProducts = ['general_trade','fashion','electronics','food','pharmacy','building_materials','stationery'].some(c => activeCodes.has(c))

  useEffect(() => {
    const load = async () => {
      const calls = [
        salesAPI.list({ page_size: 20, ordering: '-created_at' }),
        customersAPI.list({ page_size: 1 }),
      ]
      if (hasProducts) calls.push(productsAPI.list({ page_size: 1 }))
      const results = await Promise.allSettled(calls)
      const salesData     = results[0].status === 'fulfilled' ? results[0].value.data : null
      const customersData = results[1].status === 'fulfilled' ? results[1].value.data : null
      const productsData  = hasProducts && results[2]?.status === 'fulfilled' ? results[2].value.data : null
      const allSales  = salesData?.results ?? salesData ?? []
      const today     = todayStr()
      const todaySales   = allSales.filter(s => (s.created_at || '').startsWith(today))
      const todayRevenue = todaySales.reduce((sum, s) => sum + parseFloat(s.total ?? s.amount ?? 0), 0)
      setStats({ revenue: todayRevenue, sales: todaySales.length, products: productsData?.count ?? null, customers: customersData?.count ?? 0 })
      setRecentSales(allSales.slice(0, 6))
      setLoading(false)
    }
    load()
  }, [hasProducts])

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Today's Revenue"  value={loading ? '—' : fmt(stats.revenue)}    sub="Cash + transfers"  accent />
        <StatCard label="Today's Sales"    value={loading ? '—' : stats.sales}           sub="Transactions"     linkTo="/pos" />
        {stats.products !== null && <StatCard label="Products"  value={loading ? '—' : stats.products} sub="In catalogue"   linkTo="/products" />}
        <StatCard label="Customers"        value={loading ? '—' : stats.customers}       sub="Registered"       linkTo="/customers" />
      </div>

      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--light)' }}>Recent Sales</h2>
        {loading ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        : recentSales.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No sales recorded yet. <Link to="/pos" style={{ color: 'var(--gold)' }}>Open POS →</Link></p>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={{ textAlign: 'left',  padding: '0 0 10px', fontWeight: 500 }}>Customer</th>
                <th style={{ textAlign: 'left',  padding: '0 0 10px', fontWeight: 500 }}>Items</th>
                <th style={{ textAlign: 'right', padding: '0 0 10px', fontWeight: 500 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((s, i) => (
                <tr key={s.id ?? i} style={{ borderTop: '1px solid var(--mid)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--light)' }}>{s.customer_name ?? s.customer?.name ?? 'Walk-in'}</td>
                  <td style={{ padding: '10px 0', color: 'var(--muted)' }}>{s.items?.length ?? '—'}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--gold)', fontWeight: 500 }}>{fmt(s.total ?? s.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ─── Section: Job Cards KPIs ──────────────────────────────────────────────

function JobCardsSection() {
  const [stats, setStats] = useState({ open: 0, ready: 0, todayRevenue: 0, unpaid: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [allRes, readyRes] = await Promise.allSettled([
        jobCardsAPI.list({}),
        jobCardsAPI.list({ status: 'ready' }),
      ])
      const all   = allRes.status   === 'fulfilled' ? (allRes.value.data?.results   ?? allRes.value.data   ?? []) : []
      const ready = readyRes.status === 'fulfilled' ? (readyRes.value.data?.results ?? readyRes.value.data ?? []) : []
      const today = todayStr()
      const openStatuses = ['received', 'diagnosing', 'repairing', 'in_repair', 'awaiting_parts']
      const open  = all.filter(j => openStatuses.includes(j.status)).length
      const todayRevenue = all
        .filter(j => (j.created_at || '').startsWith(today))
        .reduce((sum, j) => sum + parseFloat(j.amount_paid ?? 0), 0)
      const unpaid = all.filter(j => j.payment_status === 'unpaid' || j.payment_status === 'partial').length
      setStats({ open, ready: ready.length, todayRevenue, unpaid })
      setRecent(all.slice(0, 6))
      setLoading(false)
    }
    load()
  }, [])

  const STATUS_COLOR = { received: 'var(--muted)', diagnosing: 'orange', in_repair: 'var(--gold)', repairing: 'var(--gold)', ready: 'var(--success)', collected: 'var(--muted)', cancelled: 'var(--error)' }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Today's Job Revenue" value={loading ? '—' : fmt(stats.todayRevenue)} sub="Payments collected" accent />
        <StatCard label="Open Jobs"            value={loading ? '—' : stats.open}             sub="Active repairs"    linkTo="/jobcards" />
        <StatCard label="Ready for Pickup"     value={loading ? '—' : stats.ready}            sub="Awaiting collection" linkTo="/jobcards" />
        <StatCard label="Unpaid / Partial"     value={loading ? '—' : stats.unpaid}           sub="Outstanding balance" />
      </div>

      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--light)' }}>Recent Job Cards</h2>
        {loading ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        : recent.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No job cards yet. <Link to="/jobcards" style={{ color: 'var(--gold)' }}>Create one →</Link></p>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Job #</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Device</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Customer</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Status</th>
                <th style={{ textAlign: 'right',padding: '0 0 10px', fontWeight: 500 }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((j, i) => (
                <tr key={j.id ?? i} style={{ borderTop: '1px solid var(--mid)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--gold)', fontFamily: 'monospace', fontSize: 12 }}>{j.job_number}</td>
                  <td style={{ padding: '10px 0', color: 'var(--light)' }}>{j.device_description}</td>
                  <td style={{ padding: '10px 0', color: 'var(--muted)' }}>{j.customer_name}</td>
                  <td style={{ padding: '10px 0' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.2)', color: STATUS_COLOR[j.status] || 'var(--muted)', textTransform: 'capitalize' }}>{j.status}</span>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: parseFloat(j.balance_due) > 0 ? 'var(--error)' : 'var(--muted)', fontWeight: 500 }}>{fmt(j.balance_due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ─── Section: Hotel KPIs ──────────────────────────────────────────────────

function HotelSection() {
  const [occ, setOcc]     = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [occRes, bookRes] = await Promise.allSettled([
        hotelAPI.occupancy(),
        hotelAPI.listBookings({ status: 'checked_in' }),
      ])
      if (occRes.status === 'fulfilled')  setOcc(occRes.value.data)
      if (bookRes.status === 'fulfilled') {
        const raw = bookRes.value.data
        setRecent((Array.isArray(raw) ? raw : (raw.results ?? [])).slice(0, 6))
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Rooms"      value={loading ? '—' : (occ?.total_rooms ?? 0)}    sub="In property"       linkTo="/hotel" />
        <StatCard label="Occupied"         value={loading ? '—' : (occ?.occupied ?? 0)}       sub="Rooms"             accent />
        <StatCard label="Available"        value={loading ? '—' : (occ?.available ?? 0)}      sub="Ready for guests"  linkTo="/hotel" />
        <StatCard label="Occupancy Rate"   value={loading ? '—' : `${occ?.occupancy_rate ?? 0}%`} sub="Current" />
        <StatCard label="Check-ins Today"  value={loading ? '—' : (occ?.checkins_today ?? 0)} sub="Expected arrivals" />
        <StatCard label="Check-outs Today" value={loading ? '—' : (occ?.checkouts_today ?? 0)}sub="Departures" />
      </div>

      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--light)' }}>Currently Checked In</h2>
        {loading ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        : recent.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No guests checked in right now. <Link to="/hotel" style={{ color: 'var(--gold)' }}>View bookings →</Link></p>
        : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Guest</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Room</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Check-out</th>
                <th style={{ textAlign: 'right',padding: '0 0 10px', fontWeight: 500 }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b, i) => (
                <tr key={b.id ?? i} style={{ borderTop: '1px solid var(--mid)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--light)', fontWeight: 500 }}>{b.guest_name}</td>
                  <td style={{ padding: '10px 0', color: 'var(--muted)' }}>Room {b.room_number} <span style={{ fontSize: 11, textTransform: 'capitalize' }}>({b.room_type})</span></td>
                  <td style={{ padding: '10px 0', color: 'var(--muted)' }}>{b.check_out_date}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: parseFloat(b.balance_due) > 0 ? 'var(--error)' : 'var(--success)', fontWeight: 500 }}>
                    {parseFloat(b.balance_due) > 0 ? fmt(b.balance_due) : 'Paid'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, activeCodes } = useAuth()
  const name  = user?.first_name || user?.email?.split('@')[0] || 'there'
  const today = new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const hasSales    = ['general_trade','fashion','electronics','food','pharmacy','building_materials','stationery'].some(c => activeCodes.has(c))
  const hasJobs     = activeCodes.has('technical_services')
  const hasHotel    = activeCodes.has('hotel')

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2, color: 'var(--light)' }}>
          {greeting()}, {name}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>{today}</p>
      </div>

      {hasSales && <SalesSection activeCodes={activeCodes} />}
      {hasJobs  && <JobCardsSection />}
      {hasHotel && <HotelSection />}

      {!hasSales && !hasJobs && !hasHotel && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🏪</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>No modules active. Go to <Link to="/settings" style={{ color: 'var(--gold)' }}>Settings → Modules</Link> to activate features for your business.</p>
        </div>
      )}
    </AppLayout>
  )
}
