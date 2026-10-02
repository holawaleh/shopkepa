import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, LayoutDashboard, Package, Users,
  BarChart2, Wrench, Settings, LogOut, Menu, X, Wifi, WifiOff, Hotel,
  ReceiptText, Bell, Cpu, Sun, Moon, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { reportsAPI } from '../../api/client'

// The rail's collapsed width - AppLayout reserves exactly this much space
// at desktop widths so the rail can sit fixed/overlaying without reflow.
export const RAIL_WIDTH = 64
const RAIL_WIDTH_EXPANDED = 220
// Fixed height of the offline banner - both the rail and AppLayout's main
// content offset by this (only while offline) so the banner never overlaps
// either of them, since all three are independently fixed/positioned.
export const OFFLINE_BANNER_HEIGHT = 32

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
  { key: 'pos',       to: '/pos',       label: 'POS',       icon: ShoppingCart,   roles: ['owner', 'admin', 'manager', 'cashier'], privilege: 'pos' },
  { key: 'products',  to: '/products',  label: 'Products',  icon: Package,        roles: ['owner', 'admin', 'manager'], privilege: 'products' },
  { key: 'customers', to: '/customers', label: 'Customers', icon: Users,          roles: ['owner', 'admin', 'manager', 'cashier'], always: true, privilege: 'customers' },
  { key: 'reports',   to: '/reports',   label: 'Reports',   icon: BarChart2,      roles: ['owner', 'admin', 'manager'], always: true, privilege: 'reports' },
  { key: 'jobcards',  to: '/jobcards',  label: 'Job Cards', icon: Wrench,         roles: ['owner', 'admin', 'manager', 'cashier'], privilege: 'job_cards' },
  { key: 'hotel',     to: '/hotel',     label: 'Hotel',     icon: Hotel,          roles: ['owner', 'admin', 'manager', 'cashier'], privilege: 'hotel' },
  { key: 'expenses',  to: '/expenses',  label: 'Expenses',  icon: ReceiptText,    roles: ['owner', 'admin', 'manager'], always: true, privilege: 'expenses' },
]

// Rendered in the same rail, below a divider, rather than a separate bar
const UTIL_NAV = [
  { key: 'ai',       to: '/ai',       icon: Cpu,      label: 'AI Assistant', roles: ['owner', 'admin', 'manager'] },
  { key: 'settings', to: '/settings', icon: Settings, label: 'Settings',     roles: ['owner', 'admin'] },
]

function RailRow({ to, label, icon: Icon, active, onClick, badge }) {
  const content = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, width: RAIL_WIDTH_EXPANDED,
      padding: '9px 0 9px 22px', color: active ? 'var(--gold)' : 'var(--muted)',
      background: active ? 'var(--gold-dim)' : 'transparent',
      textDecoration: 'none', fontSize: 13, fontWeight: active ? 500 : 400,
      whiteSpace: 'nowrap', cursor: 'pointer', border: 'none',
    }}>
      <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        <Icon size={17} />
        {badge > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -7, minWidth: 14, height: 14,
            borderRadius: 999, background: 'var(--warning)', color: 'var(--navy)',
            fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>{badge}</span>
        )}
      </span>
      <span className="rail-label">{label}</span>
    </div>
  )
  return to
    ? <Link to={to} onClick={onClick} style={{ textDecoration: 'none' }}>{content}</Link>
    : <button onClick={onClick} style={{ background: 'none', padding: 0, width: '100%', textAlign: 'left' }}>{content}</button>
}

export default function TopNav() {
  const { user, logout, isOwner, activeCodes } = useAuth()
  const isOnline = useOnlineStatus()
  const location  = useLocation()
  const navigate  = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [debtors, setDebtors] = useState([])
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('shopkepa_theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const next = saved || (prefersDark ? 'dark' : 'light')
    setTheme(next)
    document.documentElement.dataset.theme = next
  }, [])

  // Close the mobile drawer on navigation
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
    window.localStorage.setItem('shopkepa_theme', next)
  }

  const enabledKeys = new Set()
  activeCodes.forEach(code => {
    (MODULE_NAV_ENABLES[code] || []).forEach(k => enabledKeys.add(k))
  })

  // Owners/admins always have every privilege; everyone else is gated by
  // the granular, owner-editable checkboxes set in Settings > Team.
  const hasPrivilege = (code) => {
    if (!code) return true
    if (user?.role === 'owner' || user?.role === 'admin') return true
    return (user?.permissions || []).includes(code)
  }

  const visibleItems = ALL_NAV.filter(item => {
    if (!item.roles || !item.roles.includes(user?.role)) return false
    if (!hasPrivilege(item.privilege)) return false
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
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.role])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const utilItems = [
    ...(user?.is_superuser ? [{ key: 'platform', to: '/platform', icon: ShieldCheck, label: 'Platform admin' }] : []),
    ...UTIL_NAV.filter(u => u.roles.includes(user?.role)),
  ]

  return (
    <>
      {!isOnline && (
        <div className="offline-banner" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
          height: OFFLINE_BANNER_HEIGHT, boxSizing: 'border-box',
        }}>
          <WifiOff size={13} />
          Working offline - changes will sync when reconnected
        </div>
      )}

      {/* Mobile: floating trigger, since the rail is fully hidden at rest */}
      <button onClick={() => setMobileOpen(o => !o)} className="rail-hamburger"
        style={{
          display: 'none', position: 'fixed', top: (isOnline ? 0 : OFFLINE_BANNER_HEIGHT) + 14, left: 14, zIndex: 160,
          width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
          background: 'var(--blue)', border: '1px solid var(--mid)', color: 'var(--light)', cursor: 'pointer',
        }}>
        {mobileOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      {/* Backdrop behind the drawer on mobile */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 149 }} />
      )}

      {/* z-index kept below every page Modal (z-index 200) so an open modal
          always wins regardless of DOM order - the rail should never be
          able to render on top of one. */}
      <nav className={`side-rail${mobileOpen ? ' expanded' : ''}`} style={{
        background: 'var(--blue)', borderRight: '1px solid var(--mid)',
        position: 'fixed', top: isOnline ? 0 : OFFLINE_BANNER_HEIGHT, left: 0, bottom: 0, zIndex: 150,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Brand */}
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 14, width: RAIL_WIDTH_EXPANDED,
          height: 56, flexShrink: 0, padding: '0 0 0 20px', textDecoration: 'none',
          borderBottom: '1px solid var(--mid)',
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: 7, background: 'var(--gold-dim)',
            color: 'var(--gold)', fontWeight: 700, fontSize: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>S</span>
          <span className="rail-label" style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 16, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
            ShopKepa
          </span>
        </Link>

        {/* Main nav */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', overflowY: 'auto' }}>
          {visibleItems.map(item => (
            <RailRow key={item.key} to={item.to} label={item.label} icon={item.icon}
              active={location.pathname.startsWith(item.to)} />
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Utility + account, pinned to the bottom */}
        <div style={{ borderTop: '1px solid var(--mid)', padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
          {utilItems.map(u => (
            <RailRow key={u.key} to={u.to} label={u.label} icon={u.icon}
              active={location.pathname.startsWith(u.to)} />
          ))}

          <RailRow icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggleTheme} />

          {['owner', 'admin', 'manager'].includes(user?.role) && (
            // A plain link like every other rail item - clicking takes you
            // straight to the full Outstanding Debts list in Reports,
            // rather than a small popover with no way out to the real page.
            <RailRow to="/reports#debtors" icon={Bell} label="Debtors" badge={debtors.length}
              active={location.pathname.startsWith('/reports') && location.hash === '#debtors'} />
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, width: RAIL_WIDTH_EXPANDED,
            padding: '10px 0 4px 22px', whiteSpace: 'nowrap',
          }}>
            <span style={{ flexShrink: 0, display: 'flex', color: isOnline ? 'var(--success)' : 'var(--warning)' }}>
              {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
            </span>
            <span className="rail-label" style={{ fontSize: 12, color: 'var(--muted)' }}>
              {user?.first_name || user?.email?.split('@')[0]}
              {isOwner && <span style={{ marginLeft: 4, color: 'var(--gold)', fontSize: 10 }}>- Owner</span>}
            </span>
          </div>

          <RailRow icon={LogOut} label="Sign out" onClick={handleLogout} />
        </div>
      </nav>

      <style>{`
        .side-rail { width: ${RAIL_WIDTH}px; transition: width 0.18s ease; }
        .side-rail:hover, .side-rail.expanded { width: ${RAIL_WIDTH_EXPANDED}px; box-shadow: 10px 0 40px rgba(0,0,0,0.35); }
        .side-rail .rail-label { opacity: 0; transition: opacity 0.12s ease; }
        .side-rail:hover .rail-label, .side-rail.expanded .rail-label { opacity: 1; }
        @media (max-width: 768px) {
          .side-rail { width: 0; border-right: none !important; }
          .side-rail.expanded { width: ${RAIL_WIDTH_EXPANDED}px; }
          .rail-hamburger { display: flex !important; }
        }
      `}</style>
    </>
  )
}
