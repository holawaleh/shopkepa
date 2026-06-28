import { useState, useEffect } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import { salesAPI, productsAPI, customersAPI } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div style={{
      background: 'var(--blue)',
      border: '1px solid var(--mid)',
      borderRadius: 10,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent ? 'var(--gold)' : 'var(--light)', marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
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

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ revenue: 0, sales: 0, products: 0, customers: 0 })
  const [recentSales, setRecentSales] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [salesRes, productsRes, customersRes] = await Promise.allSettled([
        salesAPI.list({ page_size: 20, ordering: '-created_at' }),
        productsAPI.list({ page_size: 1 }),
        customersAPI.list({ page_size: 1 }),
      ])

      const salesData   = salesRes.status     === 'fulfilled' ? salesRes.value.data     : null
      const productsData = productsRes.status === 'fulfilled' ? productsRes.value.data  : null
      const customersData = customersRes.status === 'fulfilled' ? customersRes.value.data : null

      const allSales = salesData?.results ?? salesData ?? []
      const todayStr = new Date().toISOString().split('T')[0]
      const todaySales = allSales.filter(s => (s.created_at || '').startsWith(todayStr))
      const todayRevenue = todaySales.reduce((sum, s) => sum + parseFloat(s.total ?? s.amount ?? 0), 0)

      setStats({
        revenue:   todayRevenue,
        sales:     todaySales.length,
        products:  productsData?.count  ?? 0,
        customers: customersData?.count ?? 0,
      })
      setRecentSales(allSales.slice(0, 6))
      setLoading(false)
    }
    load()
  }, [])

  const name = user?.first_name || user?.email?.split('@')[0] || 'there'
  const today = new Date().toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 2, color: 'var(--light)' }}>
          {greeting()}, {name}
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>{today}</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard
          label="Today's Revenue"
          value={loading ? '—' : fmt(stats.revenue)}
          sub="Cash + transfers"
          accent
        />
        <StatCard
          label="Today's Sales"
          value={loading ? '—' : stats.sales}
          sub="Transactions"
        />
        <StatCard
          label="Products"
          value={loading ? '—' : stats.products}
          sub="In catalogue"
        />
        <StatCard
          label="Customers"
          value={loading ? '—' : stats.customers}
          sub="Registered"
        />
      </div>

      {/* Recent sales table */}
      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--light)' }}>Recent Sales</h2>

        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : recentSales.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            No sales recorded yet. Open the POS tab to start selling.
          </p>
        ) : (
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
                  <td style={{ padding: '10px 0', color: 'var(--light)' }}>
                    {s.customer_name ?? s.customer?.name ?? 'Walk-in'}
                  </td>
                  <td style={{ padding: '10px 0', color: 'var(--muted)' }}>
                    {s.items?.length ?? '—'}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--gold)', fontWeight: 500 }}>
                    {fmt(s.total ?? s.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  )
}
