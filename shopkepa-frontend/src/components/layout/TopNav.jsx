import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, LayoutDashboard, Package, Users,
  BarChart2, Wrench, Settings, LogOut, Menu, X, Wifi, WifiOff, Hotel,
  ReceiptText, Bell, Cpu, Sun, Moon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { reportsAPI } from '../../api/client'

const MODULE_NAV_ENABLES = {
  general_trade:      ['pos', 'products'],
  fashion:            ['pos', 'products'],
  electronics:        ['pos', 'products'],
  food:               ['pos', 'products'],
  pharmacy:           ['pos', 'products'],
  building_materials: ['pos', 'products'],
  stationery:         ['pos', 'products'],
  technical_services: ['jobcards'],
  hotel:              ['hotel'],
}

// Settings and AI live in the right-side utility bar, not the main nav
const ALL_NAV = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager'], always: true },
  { key: 'pos',       to: '/pos',       label: 'POS',       icon: ShoppingCart,   roles: ['owner', 'admin', 'manager', 'cashier'] },
  { key: 'products',  to: '/products',  label: 'Products',  icon: Package,        roles: ['owner', 'admin', 'manager'] },
  { key: 'customers', to: '/customers', label: 'Customers', icon: Users,          roles: ['owner', 'admin', 'manager', 'cashier'], always: true },
  { key: 'reports',   to: '/reports',   label: 'Reports',   icon: BarChart2,      roles: ['owner', 'admin', 'manager'], always: true },
  { key: 'jobcards',  to: '/jobcards',  label: 'Job Cards', icon: Wrench,         roles: ['owner', 'admin', 'manager', 'cashier'] },
  { key: 'hotel',     to: '/hotel',     label: 'Hotel',     icon: Hotel,          roles: ['owner', 'admin', 'manager', 'cashier'] },
  { key: 'expenses',  to: '/expenses',  label: 'Expenses',  icon: ReceiptText,    roles: ['owner', 'admin', 'manager'], always: true },
]

// Utility items rendered as icon buttons on the right side
const UTIL_NAV = [
  { key: 'ai',       to: '/ai',       icon: Cpu,      roles: ['owner', 'admin', 'manager'], title: 'AI Assistant (Premium)' },
  { key: 'settings', to: '/settings', icon: Settings, roles: ['owner', 'admin'],            title: 'Settings' },
]

export default function TopNav() {
  const { user, logout, isOwner, activeCodes } = useAuth()
  const isOnline = useOnlineStatus()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [debtorOpen, setDebtorOpen] = useState(false)
  const [debtors, setDebtors] = useState([])
  const [debtorTotal, setDebtorTotal] = useState(0)
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('shopkepa_theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const next = saved || (prefersDark ? 'dark' : 'light')
    setTheme(next)
    document.documentElement.dataset.theme = next
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    window.localStorage.setItem('shopkepa_theme', next)
  }

  const enabledKeys = new Set()
  activeCodes.forEach(code => {
    (MODULE_NAV_ENABLES[code] || []).forEach(k => enabledKeys.add(k))
  })

  const visibleItems = ALL_NAV.filter(item => {
    if (!item.roles || !item.roles.includes(user?.role)) return false
    if (item.always) return true
    return enabledKeys.has(item.key)
  })

  useEffect(() => {
    if (!['owner', 'admin', 'manager'].includes(user?.role)) return
    let cancelled = false
    reportsAPI.debtors()
      .then((res) => {
        if (cancelled) return
        const salesDebtors = (res.data?.debtors || []).map(d => ({
          id: d.customer_id || d.plan_id || d.sale_number,
          name: d.customer_name,
          phone: d.customer_phone,
          balance: d.balance,
          ref: d.sale_number,
          type: 'Sale',
        }))
        const jobDebtors = (res.data?.unpaid_job_cards || []).map(j => ({
          id: j.customer_id || j.job_number,
          name: j.customer_name,
          phone: j.customer_phone,
          balance: j.balance_due,
          ref: j.job_number,
          type: 'Job',
        }))
        setDebtors([...salesDebtors, ...jobDebtors].filter(d => d.name))
        setDebtorTotal(parseFloat(res.data?.total_outstanding || 0))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.role])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const closeDebtorsAndGo = () => {
    setDebtorOpen(false)
    navigate('/customers')
  }

  return (
    <>
      {!isOnline && (
        <div className="offline-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <WifiOff size={13} />
          Working offline - changes will sync when reconnected
        </div>
      )}

      <nav style={{ background: 'var(--blue)', borderBottom: '1px solid var(--mid)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <Link to="/" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 18, textDecoration: 'none', letterSpacing: 0.5, flexShrink: 0 }}>
            ShopKepa
          </Link>

          <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }} className="desktop-nav">
            {visibleItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to)
              return (
                <Link key={to} to={to} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px', borderRadius: 'var(--r-sm)',
                  color: active ? 'var(--gold)' : 'var(--muted)',
                  background: active ? 'var(--gold-dim)' : 'transparent',
                  textDecoration: 'none', fontSize: 13, fontWeight: active ? 500 : 400,
                  transition: 'color 0.15s, background 0.15s', whiteSpace: 'nowrap',
                }}>
                  <Icon size={14} />
                  {label}
                </Link>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: isOnline ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            </span>

            {UTIL_NAV.filter(u => u.roles.includes(user?.role)).map(u => {
              const active = location.pathname.startsWith(u.to)
              const Icon = u.icon
              return (
                <Link key={u.key} to={u.to} title={u.title} style={{
                  display: 'flex', alignItems: 'center', padding: '5px 8px',
                  borderRadius: 'var(--r-sm)', textDecoration: 'none',
                  color: active ? 'var(--gold)' : 'var(--muted)',
                  background: active ? 'var(--gold-dim)' : 'transparent',
                  transition: 'color 0.15s',
                }}>
                  <Icon size={15} />
                </Link>
              )
            })}

            <button onClick={toggleTheme} className="btn-ghost"
              style={{ padding: '5px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {['owner', 'admin', 'manager'].includes(user?.role) && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setDebtorOpen(o => !o)} className="btn-ghost"
                  style={{ padding: '5px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}
                  title="Debtors">
                  <Bell size={13} />
                  {debtors.length > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16,
                      borderRadius: 999, background: 'var(--warning)', color: 'var(--navy)',
                      fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{debtors.length}</span>
                  )}
                </button>
                {debtorOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 300,
                    background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 8,
                    boxShadow: '0 18px 50px rgba(0,0,0,0.35)', padding: 10, zIndex: 150,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--light)', fontWeight: 600 }}>Debtors</span>
                      <span style={{ fontSize: 11, color: 'var(--warning)' }}>NGN {debtorTotal.toLocaleString('en-NG')}</span>
                    </div>
                    {debtors.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 2px' }}>No outstanding debtors.</div>
                    ) : (
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {debtors.map((d, idx) => (
                          <button key={`${d.id}-${idx}`} onClick={closeDebtorsAndGo}
                            style={{
                              width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--mid)',
                              padding: '9px 2px', textAlign: 'left', cursor: 'pointer', display: 'grid', gap: 2,
                            }}>
                            <span style={{ fontSize: 12, color: 'var(--light)', fontWeight: 500 }}>{d.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{d.phone || 'No phone'} - {d.type} {d.ref}</span>
                            <span style={{ fontSize: 11, color: 'var(--warning)' }}>Balance: NGN {Number(d.balance || 0).toLocaleString('en-NG')}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {user?.first_name || user?.email?.split('@')[0]}
              {isOwner && <span style={{ marginLeft: 4, color: 'var(--gold)', fontSize: 10 }}>- Owner</span>}
            </span>
            <button onClick={handleLogout} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              <LogOut size={13} /> Sign out
            </button>
            <button onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: 'var(--light)', cursor: 'pointer', display: 'none' }}
              className="mobile-menu-btn">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div style={{ background: 'var(--navy)', borderTop: '1px solid var(--mid)', padding: '8px 16px 16px' }}>
            {[
              ...visibleItems,
              ...UTIL_NAV.filter(u => u.roles.includes(user?.role)).map(u => ({ ...u, label: u.title })),
            ].map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to)
              return (
                <Link key={to} to={to} onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 8px', borderBottom: '1px solid var(--mid)',
                    color: active ? 'var(--gold)' : 'var(--light)',
                    textDecoration: 'none', fontSize: 15,
                  }}>
                  <Icon size={18} />
                  {label}
                </Link>
              )
            })}
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px',
              color: 'var(--error)', background: 'none', border: 'none', width: '100%',
              cursor: 'pointer', fontSize: 15, marginTop: 4,
            }}>
              <LogOut size={18} /> Sign out
            </button>
          </div>
        )}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </>
  )
}
