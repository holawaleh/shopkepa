import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, LayoutDashboard, Package, Users,
  BarChart2, Wrench, Settings, LogOut, Menu, X, Wifi, WifiOff, Hotel,
  ReceiptText, Bot,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

// Which nav keys each module code enables
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

const ALL_NAV = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager'], always: true },
  { key: 'pos',       to: '/pos',       label: 'POS',       icon: ShoppingCart,   roles: ['owner', 'admin', 'manager', 'cashier'] },
  { key: 'products',  to: '/products',  label: 'Products',  icon: Package,        roles: ['owner', 'admin', 'manager'] },
  { key: 'customers', to: '/customers', label: 'Customers', icon: Users,          roles: ['owner', 'admin', 'manager', 'cashier'], always: true },
  { key: 'reports',   to: '/reports',   label: 'Reports',   icon: BarChart2,      roles: ['owner', 'admin', 'manager'], always: true },
  { key: 'jobcards',  to: '/jobcards',  label: 'Job Cards', icon: Wrench,         roles: ['owner', 'admin', 'manager', 'cashier'] },
  { key: 'hotel',     to: '/hotel',     label: 'Hotel',     icon: Hotel,          roles: ['owner', 'admin', 'manager', 'cashier'] },
  { key: 'expenses',  to: '/expenses',  label: 'Expenses',  icon: ReceiptText,    roles: ['owner', 'admin', 'manager'], always: true },
  { key: 'ai',        to: '/ai',        label: 'AI',        icon: Bot,            roles: ['owner', 'admin', 'manager'], always: true },
  { key: 'settings',  to: '/settings',  label: 'Settings',  icon: Settings,       roles: ['owner', 'admin'], always: true },
]

export default function TopNav() {
  const { user, logout, isOwner, activeCodes } = useAuth()
  const isOnline = useOnlineStatus()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  // Build enabled nav keys from active module codes
  const enabledKeys = new Set()
  activeCodes.forEach(code => {
    (MODULE_NAV_ENABLES[code] || []).forEach(k => enabledKeys.add(k))
  })

  const visibleItems = ALL_NAV.filter(item => {
    if (!item.roles || !item.roles.includes(user?.role)) return false
    if (item.always) return true
    return enabledKeys.has(item.key)
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      {!isOnline && (
        <div className="offline-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <WifiOff size={13} />
          Working offline — changes will sync when reconnected
        </div>
      )}

      <nav style={{ background: 'var(--blue)', borderBottom: '1px solid var(--mid)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>

          <Link to="/" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 18, textDecoration: 'none', letterSpacing: 0.5, flexShrink: 0 }}>
            ShopKepa
          </Link>

          {/* Desktop nav */}
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

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: isOnline ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {user?.first_name || user?.email?.split('@')[0]}
              {isOwner && <span style={{ marginLeft: 4, color: 'var(--gold)', fontSize: 10 }}>· Owner</span>}
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

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ background: 'var(--navy)', borderTop: '1px solid var(--mid)', padding: '8px 16px 16px' }}>
            {visibleItems.map(({ to, label, icon: Icon }) => {
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
