import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ShoppingCart, Users, AlertTriangle, ArrowRight } from 'lucide-react'
import { reportsAPI } from '../../api/client'
import { formatNaira, formatNairaShort, formatTime, parseApiError } from '../../utils/format'
import { useAuth } from '../../context/AuthContext'
import AppLayout from '../../components/layout/AppLayout'

function MetricCard({ label, value, sub, accent = false, icon: Icon }) {
  return (
    <div className="metric-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="metric-label">{label}</div>
        {Icon && <Icon size={16} color="var(--muted)" />}
      </div>
      <div className={`metric-value ${accent ? '' : 'white'}`} style={{ marginTop: 6 }}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  )
}

function SkeletonCard() {
  return <div className="metric-card"><div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 8 }} /><div className="skeleton" style={{ height: 28, width: '80%' }} /></div>
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    reportsAPI.dashboard()
      .then(res => setData(res.data))
      .catch(err => setError(parseApiError(err)))
      .finally(() => setLoading(false))
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>{greeting()},</p>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>
          {user?.first_name || 'Welcome'} 👋
        </h1>
      </div>

      {error && (
        <div style={{ color: 'var(--error)', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: 'rgba(224,85,85,0.1)', borderRadius: 'var(--r-sm)' }}>
          {error}
        </div>
      )}

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {loading ? (
          [1,2,3,4].map(i => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              label="Today's revenue"
              value={formatNairaShort(data?.today_revenue || 0)}
              sub={data?.revenue_change ? `${data.revenue_change > 0 ? '+' : ''}${data.revenue_change}% vs yesterday` : null}
              accent
              icon={TrendingUp}
            />
            <MetricCard
              label="Transactions"
              value={data?.today_transactions || 0}
              sub="Since midnight"
              icon={ShoppingCart}
            />
            <MetricCard
              label="Customers today"
              value={data?.today_customers || 0}
              icon={Users}
            />
            <MetricCard
              label="Low stock alerts"
              value={data?.low_stock_count || 0}
              sub={data?.low_stock_count > 0 ? 'Needs attention' : 'All good'}
              icon={AlertTriangle}
            />
          </>
        )}
      </div>

      {/* Recent sales + Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Recent sales */}
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500 }}>Recent sales</h2>
            <Link to="/reports" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--mid)' }}>
                <div className="skeleton" style={{ height: 11, width: '70%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 11, width: '40%' }} />
              </div>
            ))
          ) : data?.recent_sales?.length ? (
            data.recent_sales.map((sale, i) => (
              <div key={i} className="table-row" style={{ gridTemplateColumns: '1fr auto auto', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13 }}>{sale.customer_name || 'Walk-in'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatTime(sale.created_at)}</div>
                </div>
                <span className={`badge badge-${sale.payment_status === 'paid' ? 'paid' : 'pending'}`}>
                  {sale.payment_status}
                </span>
                <div style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 500, textAlign: 'right' }}>
                  {formatNaira(sale.total)}
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>
              No sales yet today
            </p>
          )}
        </div>

        {/* Quick links */}
        <div className="card" style={{ padding: '16px 18px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Quick actions</h2>
          {[
            { to: '/pos',       label: 'New sale',        sub: 'Open the POS',          icon: ShoppingCart },
            { to: '/products',  label: 'Add product',     sub: 'Update inventory',       icon: AlertTriangle },
            { to: '/customers', label: 'View customers',  sub: 'Debtors and history',    icon: Users },
            { to: '/reports',   label: 'Branch report',   sub: 'Revenue by branch',      icon: TrendingUp },
          ].map(({ to, label, sub, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid var(--mid)',
                textDecoration: 'none', transition: 'opacity 0.15s',
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color="var(--gold)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>
              </div>
              <ArrowRight size={14} color="var(--muted)" />
            </Link>
          ))}
        </div>

      </div>

      {/* FAB → POS */}
      <Link to="/pos" className="fab" aria-label="New sale">
        <ShoppingCart size={22} />
      </Link>
    </AppLayout>
  )
}
