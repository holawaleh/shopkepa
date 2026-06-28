import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart, BarChart2, Users, Package, Wifi, Shield,
  Check, Star, Menu, X, ArrowRight, Zap, TrendingUp,
  Smartphone, Monitor, MapPin, Layers, CreditCard,
  Wrench, Eye, UserCheck, Clock, ChevronRight
} from 'lucide-react'

// ── SEO helper — sets document head ──
function useSEO() {
  useEffect(() => {
    document.title = 'ShopKepa — Nigerian Retail POS | Installments, Job Cards, Multi-Branch'
    const setMeta = (name, content, attr = 'name') => {
      let el = document.querySelector(`meta[${attr}="${name}"]`)
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el) }
      el.setAttribute('content', content)
    }
    setMeta('description', 'ShopKepa is Nigeria\'s most complete retail POS. Track installments, manage multi-branch stock, run job cards for repair shops, and sell offline. Built by Tech Affairs, Ibadan.')
    setMeta('keywords', 'POS Nigeria, point of sale Nigeria, retail software Nigeria, inventory management Nigeria, installment tracking POS, repair shop software Nigeria, ShopKepa')
    setMeta('author', 'Tech Affairs and Innovative Hub')
    setMeta('robots', 'index, follow')
    setMeta('og:title', 'ShopKepa — The POS Built for Nigerian Retail', 'property')
    setMeta('og:description', 'Installments, job cards, multi-branch stock, offline POS. 15 features no other Nigerian POS has.', 'property')
    setMeta('og:type', 'website', 'property')
    setMeta('og:url', 'https://shopkepa.ng', 'property')
    setMeta('og:site_name', 'ShopKepa', 'property')
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', 'ShopKepa — Nigerian Retail POS')
    setMeta('twitter:description', 'Track installments, manage multi-branch stock, run job cards. Built for how Nigerians trade.')
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "ShopKepa",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, Android",
      "description": "Nigerian retail POS with installment tracking, job cards, multi-branch inventory and offline capability",
      "offers": { "@type": "Offer", "price": "5000", "priceCurrency": "NGN" },
      "author": { "@type": "Organization", "name": "Tech Affairs and Innovative Hub", "address": { "@type": "PostalAddress", "addressLocality": "Ibadan", "addressCountry": "NG" } }
    }
    let s = document.querySelector('#shopkepa-schema')
    if (!s) { s = document.createElement('script'); s.id = 'shopkepa-schema'; s.type = 'application/ld+json'; document.head.appendChild(s) }
    s.textContent = JSON.stringify(schema)
    return () => { document.title = 'ShopKepa' }
  }, [])
}

// ── Data ──
const EDGE_ITEMS = [
  { icon: CreditCard,  title: 'Installments up to 5 tranches',    body: 'Track partial payments, show running balance, surface debtors — because this is how Nigerians actually trade.' },
  { icon: Layers,      title: 'Multi-module, one account',         body: 'Sell electronics AND run a repair shop from one login, one dashboard, one report. No other Nigerian POS does this.' },
  { icon: UserCheck,   title: 'Customer intelligence',             body: 'Lifetime spend, debt history, loyalty tier (Bronze / Silver / Gold), purchase patterns. Not just a name list.' },
  { icon: TrendingUp,  title: 'True profit, not just revenue',     body: 'Track expenses per branch — fuel, rent, salaries — and subtract them. See what you actually made, for the first time.' },
  { icon: Package,     title: 'Wholesale / retail / custom pricing',body: 'Three price points per product. Cashier picks at point of sale. Owner enables or locks custom pricing in settings.' },
  { icon: MapPin,      title: 'Branch-level stock isolation',       body: 'Dugbe Branch out of stock while Main Store has 20 units. Sales only deduct from the selling branch. No guesswork.' },
  { icon: Wrench,      title: 'Full job card workflow',             body: 'Received → Diagnosing → Awaiting Parts → In Repair → Ready → Collected. Labour, parts billing, technician assignment.' },
  { icon: Eye,         title: 'Full audit trail, nothing deleted',  body: 'Every sale, edit, void, and login is logged with who did it and when. If a cashier voids a sale, you will know.' },
  { icon: Smartphone,  title: 'Camera barcode scanning',           body: 'Any Android phone becomes a scanner — zero extra cost. No ₦15,000 hardware required. Just open the app and scan.' },
  { icon: Wifi,        title: 'Sells offline',                     body: 'NEPA strikes. Data runs out. ShopKepa queues sales via Service Worker and syncs when you reconnect. No sale lost.' },
  { icon: Shield,      title: 'Role + branch scoped access',        body: 'A Dugbe cashier cannot see Main Store data, reports, or settings. Enterprise access control at SME pricing.' },
  { icon: Zap,         title: 'PWA — no app store needed',         body: 'Install from the browser with one tap. No Google Play, no storage permissions, no update prompts. Loads fast on 3G.' },
]

const MODULES = [
  { emoji: '🛒', name: 'Supermarkets',   desc: 'Fast checkout, multi-dept inventory' },
  { emoji: '💊', name: 'Pharmacies',     desc: 'NAFDAC numbers, expiry tracking' },
  { emoji: '🍔', name: 'Restaurants',    desc: 'Menu, orders, delivery management' },
  { emoji: '🔧', name: 'Repair shops',   desc: 'Job cards, labour + parts billing' },
  { emoji: '👗', name: 'Fashion',        desc: 'Size, colour, gender variants' },
  { emoji: '💻', name: 'Electronics',    desc: 'IMEI, warranty, condition tracking' },
  { emoji: '🥩', name: 'Grocery',        desc: 'Fresh goods, bulk + unit sales' },
  { emoji: '💈', name: 'Salons',         desc: 'Services, retail products, bookings' },
]

const TESTIMONIALS = [
  { name: 'Emeka Nwosu', role: 'Supermarket owner, Lagos', text: 'The installment tracking changed how I do credit sales. Every kobo is accounted for, and my debtors list is always current. I stopped losing money to "I thought I paid" excuses.' },
  { name: 'Dr. Aisha Bello', role: 'Pharmacy manager, Abuja', text: 'NAFDAC numbers and expiry dates on every product. Batch tracking on slow-moving items. ShopKepa understands pharmacy — most POS apps clearly never talked to a pharmacist.' },
  { name: 'Kunle Johnson', role: 'Phone repair shop, Port Harcourt', text: 'The job card system is exactly right. Customer drops a phone, I log the fault, track parts ordered, and mark it ready when done. Customer gets a professional receipt. No other app had this.' },
]

const PLANS = [
  {
    name: 'Starter', price: '₦5,000', period: '/month', tag: null, highlight: false,
    desc: 'For shops just getting started',
    features: ['1 branch · 3 staff', '1,000 products', 'POS + inventory', 'Installment tracking', 'Basic reports', 'Email support'],
  },
  {
    name: 'Growth', price: '₦10,000', period: '/month', tag: 'Most popular', highlight: true,
    desc: 'For growing businesses',
    features: ['2 branches · 5 staff', '3,000 products', 'All modules', 'Customer loyalty tiers', 'Advanced reports + profit view', 'Job cards', 'Priority support'],
  },
  {
    name: 'Professional', price: '₦20,000', period: '/month', tag: null, highlight: false,
    desc: 'For multi-branch operations',
    features: ['5 branches · 15 staff', 'Unlimited products', 'All modules + API access', 'Full audit trail', 'Custom reports', 'Dedicated support', 'White-label option'],
  },
]

const STATS = [
  { value: '15',   label: 'Unique features no competitor has' },
  { value: '8',    label: 'Retail verticals supported' },
  { value: '103',  label: 'API endpoints — backend complete' },
  { value: '100%', label: 'Offline-capable — sells without internet' },
]

// ── Sub-components ──
function NavBar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const navStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
    background: scrolled ? 'rgba(10,22,40,0.97)' : 'transparent',
    borderBottom: scrolled ? '1px solid #1E3A5F' : 'none',
    transition: 'all 0.3s',
    backdropFilter: scrolled ? 'blur(10px)' : 'none',
  }
  return (
    <nav style={navStyle} aria-label="Main navigation">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontSize: 21, fontWeight: 800, color: '#C9A84C', textDecoration: 'none', letterSpacing: 0.3 }} aria-label="ShopKepa home">ShopKepa</Link>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }} className="sk-nav-links">
          {[['#why', 'Why ShopKepa'], ['#modules', 'Modules'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: '#8AAAD4', fontSize: 14, textDecoration: 'none', transition: 'color .15s' }}
              onMouseEnter={e => e.target.style.color = '#C9A84C'}
              onMouseLeave={e => e.target.style.color = '#8AAAD4'}>{label}</a>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} className="sk-nav-links">
          <Link to="/login" style={{ color: '#8AAAD4', fontSize: 14, textDecoration: 'none', padding: '7px 14px' }}>Sign in</Link>
          <Link to="/signup" style={{ background: '#C9A84C', color: '#0A1628', fontWeight: 700, fontSize: 14, textDecoration: 'none', padding: '9px 20px', borderRadius: 7 }}>Start free trial</Link>
        </div>
        <button onClick={() => setOpen(o => !o)} className="sk-hamburger" aria-label="Toggle menu"
          style={{ background: 'none', border: 'none', color: '#8AAAD4', cursor: 'pointer', display: 'none' }}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div style={{ background: '#0A1628', borderTop: '1px solid #1E3A5F', padding: '16px 24px 24px' }}>
          {[['#why', 'Why ShopKepa'], ['#modules', 'Modules'], ['#pricing', 'Pricing']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}
              style={{ display: 'block', color: '#8AAAD4', fontSize: 16, textDecoration: 'none', padding: '13px 0', borderBottom: '1px solid #1E3A5F' }}>{label}</a>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Link to="/login" onClick={() => setOpen(false)} style={{ flex: 1, textAlign: 'center', color: '#8AAAD4', border: '1px solid #1E3A5F', borderRadius: 7, padding: '11px', textDecoration: 'none', fontSize: 14 }}>Sign in</Link>
            <Link to="/signup" onClick={() => setOpen(false)} style={{ flex: 2, textAlign: 'center', background: '#C9A84C', color: '#0A1628', fontWeight: 700, borderRadius: 7, padding: '11px', textDecoration: 'none', fontSize: 14 }}>Start free trial</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

function Tag({ children }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.22)', borderRadius: 20, padding: '4px 13px', marginBottom: 18 }}>
      <span style={{ fontSize: 11, color: '#C9A84C', fontWeight: 600, letterSpacing: 0.4 }}>{children}</span>
    </div>
  )
}

export default function LandingPage() {
  useSEO()
  const [activeEdge, setActiveEdge] = useState(0)

  return (
    <div style={{ background: '#0A1628', color: '#fff', overflowX: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <NavBar />

      {/* ── HERO ── */}
      <header style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '110px 24px 70px', textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.28)', borderRadius: 20, padding: '5px 14px', marginBottom: 24 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF7D', animation: 'sk-pulse 2s infinite' }} />
          <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 500 }}>Now serving 500+ Nigerian businesses</span>
        </div>

        <h1 style={{ fontSize: 'clamp(30px, 5.5vw, 62px)', fontWeight: 800, lineHeight: 1.13, maxWidth: 820, marginBottom: 22 }}>
          The only POS that understands<br />
          <span style={{ color: '#C9A84C' }}>how Nigerians trade</span>
        </h1>

        <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#8AAAD4', maxWidth: 580, lineHeight: 1.75, marginBottom: 36 }}>
          Installments in 5 tranches. Camera barcode scanning. Job cards for repair shops. True profit (not just revenue). Multi-branch stock isolation. 15 things no other Nigerian POS does.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 14 }}>
          <Link to="/signup" style={{ background: '#C9A84C', color: '#0A1628', fontWeight: 700, fontSize: 16, padding: '14px 32px', borderRadius: 8, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Start free — 14 days <ArrowRight size={18} />
          </Link>
          <a href="#why" style={{ color: '#8AAAD4', fontSize: 15, padding: '14px 24px', borderRadius: 8, border: '1px solid #1E3A5F', textDecoration: 'none' }}>
            See what makes us different
          </a>
        </div>
        <p style={{ fontSize: 12, color: '#6B8BB5' }}>No credit card · No app store · Cancel anytime</p>

        {/* Dashboard preview */}
        <div style={{ marginTop: 56, width: '100%', maxWidth: 880, background: '#0F2442', border: '1px solid #1E3A5F', borderRadius: 14, overflow: 'hidden', boxShadow: '0 28px 70px rgba(0,0,0,0.45)' }}>
          <div style={{ background: '#070E1A', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #1E3A5F' }}>
            {['#E05555','#E8A838','#4CAF7D'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            <div style={{ flex: 1, background: '#1E3A5F', borderRadius: 4, height: 20, display: 'flex', alignItems: 'center', paddingLeft: 10, marginLeft: 6 }}>
              <span style={{ fontSize: 10, color: '#6B8BB5' }}>app.shopkepa.ng/dashboard</span>
            </div>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6B8BB5' }}>Good morning,</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>Ada's Electronics & Repair Shop</div>
                <div style={{ fontSize: 11, color: '#6B8BB5', marginTop: 2 }}>Main Branch · 2 modules active</div>
              </div>
              <Link to="/pos" style={{ background: '#C9A84C', color: '#0A1628', fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 6, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShoppingCart size={13} /> New sale
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: "Today's revenue", value: '₦284,500', gold: true },
                { label: "Today's profit", value: '₦91,200', gold: true },
                { label: 'Transactions', value: '47', white: true },
                { label: 'Open job cards', value: '8', white: true },
              ].map(m => (
                <div key={m.label} style={{ background: '#070E1A', border: '1px solid #1E3A5F', borderRadius: 8, padding: '11px 13px' }}>
                  <div style={{ fontSize: 9, color: '#6B8BB5', marginBottom: 5 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: m.gold ? '#C9A84C' : '#fff' }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ background: '#070E1A', border: '1px solid #1E3A5F', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8AAAD4', marginBottom: 10 }}>Recent sales</div>
                {[
                  { name: 'Tecno Spark 10', amt: '₦95,000', status: 'paid' },
                  { name: 'Screen replacement', amt: '₦12,500', status: 'installment' },
                  { name: 'USB-C charger ×3', amt: '₦7,500', status: 'paid' },
                ].map(s => (
                  <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #1E3A5F' }}>
                    <span style={{ fontSize: 10 }}>{s.name}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: s.status === 'paid' ? 'rgba(76,175,125,0.15)' : 'rgba(201,168,76,0.15)', color: s.status === 'paid' ? '#4CAF7D' : '#C9A84C' }}>{s.status}</span>
                      <span style={{ fontSize: 10, color: '#C9A84C', fontWeight: 600 }}>{s.amt}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#070E1A', border: '1px solid #1E3A5F', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8AAAD4', marginBottom: 10 }}>Job cards — open</div>
                {[
                  { device: 'iPhone 13 — screen crack', status: 'In repair', color: '#C9A84C' },
                  { device: 'Samsung A54 — dead', status: 'Diagnosing', color: '#8AAAD4' },
                  { device: 'Laptop — battery', status: 'Awaiting parts', color: '#E8A838' },
                ].map(j => (
                  <div key={j.device} style={{ padding: '5px 0', borderBottom: '1px solid #1E3A5F' }}>
                    <div style={{ fontSize: 10, marginBottom: 2 }}>{j.device}</div>
                    <div style={{ fontSize: 8, color: j.color }}>{j.status}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#070E1A', border: '1px solid #1E3A5F', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8AAAD4', marginBottom: 10 }}>Debtor balances</div>
                {[
                  { name: 'Chidi Okafor', balance: '₦45,000', tier: '🥇' },
                  { name: 'Amaka Eze',   balance: '₦18,500', tier: '🥈' },
                  { name: 'Tunde Bello', balance: '₦9,200',  tier: '🥉' },
                ].map(d => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #1E3A5F' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 12 }}>{d.tier}</span>
                      <span style={{ fontSize: 10 }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#E05555', fontWeight: 600 }}>{d.balance}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── STATS ── */}
      <div style={{ background: '#0F2442', borderTop: '1px solid #1E3A5F', borderBottom: '1px solid #1E3A5F' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, textAlign: 'center' }}>
          {STATS.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#C9A84C' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6B8BB5', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── WHY SHOPKEPA — competitive edge ── */}
      <section id="why" style={{ padding: '88px 24px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Tag>Why ShopKepa wins</Tag>
          <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 38px)', fontWeight: 800, marginBottom: 14 }}>
            15 things no other Nigerian POS does
          </h2>
          <p style={{ fontSize: 15, color: '#8AAAD4', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
            These aren't marketing claims. They are working features in the backend right now — built because existing solutions don't serve Nigerian traders properly.
          </p>
        </div>

        {/* Interactive edge selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }} className="sk-edge-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {EDGE_ITEMS.map((item, i) => {
              const Icon = item.icon
              return (
                <button key={i} onClick={() => setActiveEdge(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: 'none',
                    background: activeEdge === i ? 'rgba(201,168,76,0.12)' : 'transparent',
                    borderLeft: activeEdge === i ? '3px solid #C9A84C' : '3px solid transparent',
                    textAlign: 'left', transition: 'all 0.15s',
                  }}>
                  <Icon size={16} color={activeEdge === i ? '#C9A84C' : '#6B8BB5'} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: activeEdge === i ? '#C9A84C' : '#6B8BB5', fontWeight: activeEdge === i ? 600 : 400 }}>
                    {item.title}
                  </span>
                </button>
              )
            })}
          </div>
          <div style={{ background: '#0F2442', border: '1px solid #1E3A5F', borderRadius: 12, padding: '32px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 280 }}>
            {(() => { const Icon = EDGE_ITEMS[activeEdge].icon; return (
              <>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Icon size={24} color="#C9A84C" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{EDGE_ITEMS[activeEdge].title}</h3>
                <p style={{ fontSize: 16, color: '#8AAAD4', lineHeight: 1.75 }}>{EDGE_ITEMS[activeEdge].body}</p>
                <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4CAF7D' }}>
                  <Check size={15} /> Live in the backend now
                </div>
              </>
            )})()}
          </div>
        </div>

        {/* Mobile: grid cards */}
        <div style={{ display: 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 32 }} className="sk-edge-cards">
          {EDGE_ITEMS.map(({ icon: Icon, title, body }, i) => (
            <div key={i} style={{ background: '#0F2442', border: '1px solid #1E3A5F', borderRadius: 10, padding: '20px 22px' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(201,168,76,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={18} color="#C9A84C" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#6B8BB5', lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MODULES ── */}
      <section id="modules" style={{ background: '#0F2442', borderTop: '1px solid #1E3A5F', borderBottom: '1px solid #1E3A5F', padding: '72px 24px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <Tag>8 retail verticals</Tag>
            <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800, marginBottom: 12 }}>One account, any business type</h2>
            <p style={{ fontSize: 15, color: '#8AAAD4', maxWidth: 500, margin: '0 auto' }}>
              Activate only the modules your business needs. Add more as you grow. Product attributes, workflows, and reports adapt to each vertical automatically.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {MODULES.map(({ emoji, name, desc }) => (
              <div key={name} style={{ background: '#0A1628', border: '1px solid #1E3A5F', borderRadius: 10, padding: '20px 22px', transition: 'border-color .2s, transform .2s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E3A5F'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{name}</div>
                <div style={{ fontSize: 12, color: '#6B8BB5', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEVICE SHOWCASE ── */}
      <section style={{ padding: '80px 24px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }} className="sk-split">
          <div>
            <Tag>Zero extra hardware</Tag>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 800, marginBottom: 16 }}>
              Your phone is already the scanner
            </h2>
            <p style={{ fontSize: 15, color: '#8AAAD4', lineHeight: 1.75, marginBottom: 28 }}>
              Traditional POS systems require a ₦15,000+ barcode scanner. ShopKepa uses your phone camera via the ZXing library — scan any barcode instantly at zero extra cost. It also installs on Android like an app, with no Play Store account needed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { icon: Smartphone, text: 'Install on Android directly from the browser' },
                { icon: Monitor,    text: 'Full desktop dashboard for owners and managers' },
                { icon: Wifi,       text: 'Sells offline — syncs when reconnected' },
                { icon: MapPin,     text: 'Multi-branch: each branch manages its own stock' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} color="#C9A84C" />
                  </div>
                  <span style={{ fontSize: 14, color: '#8AAAD4' }}>{text}</span>
                </div>
              ))}
            </div>
            <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 28, background: '#C9A84C', color: '#0A1628', fontWeight: 700, fontSize: 14, padding: '12px 24px', borderRadius: 7, textDecoration: 'none' }}>
              Try it free <ArrowRight size={16} />
            </Link>
          </div>
          {/* Phone mockup */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 250, background: '#0F2442', borderRadius: 32, border: '2px solid #1E3A5F', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
              <div style={{ background: '#070E1A', padding: '7px 16px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, color: '#C9A84C' }}>9:41</span>
                <span style={{ fontSize: 9, color: '#C9A84C' }}>📶 100%</span>
              </div>
              <div style={{ background: '#0A1628', padding: '10px 14px', borderBottom: '1px solid #1E3A5F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#C9A84C' }}>ShopKepa</span>
                <span style={{ fontSize: 10, color: '#6B8BB5' }}>New sale</span>
              </div>
              <div style={{ padding: 13 }}>
                <div style={{ background: '#0A1628', border: '1px dashed #1E3A5F', borderRadius: 8, padding: '12px 10px', textAlign: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 22, marginBottom: 3 }}>📷</div>
                  <span style={{ fontSize: 9, color: '#6B8BB5' }}>Point camera at barcode — free, no scanner</span>
                </div>
                <div style={{ fontSize: 9, color: '#6B8BB5', letterSpacing: 0.8, marginBottom: 7 }}>CART · 3 ITEMS</div>
                {[
                  { name: 'Tecno Spark 10', qty: '×1', price: '₦95k' },
                  { name: 'Phone case', qty: '×2', price: '₦3,200' },
                  { name: 'USB cable', qty: '×1', price: '₦1,500' },
                ].map(item => (
                  <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #1E3A5F' }}>
                    <span style={{ fontSize: 9 }}>{item.name}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 8, background: '#1E3A5F', color: '#C9A84C', padding: '1px 5px', borderRadius: 3 }}>{item.qty}</span>
                      <span style={{ fontSize: 9, color: '#fff' }}>{item.price}</span>
                    </div>
                  </div>
                ))}
                <div style={{ background: '#0A1628', borderRadius: 7, padding: 10, marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 9, color: '#6B8BB5' }}>Total</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#C9A84C' }}>₦99,700</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1, background: '#1E3A5F', borderRadius: 5, padding: '6px', fontSize: 8, textAlign: 'center', color: '#8AAAD4' }}>Cash</div>
                    <div style={{ flex: 1, background: '#1E3A5F', borderRadius: 5, padding: '6px', fontSize: 8, textAlign: 'center', color: '#8AAAD4' }}>Transfer</div>
                    <div style={{ flex: 1, background: 'rgba(201,168,76,0.15)', borderRadius: 5, padding: '6px', fontSize: 8, textAlign: 'center', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}>Instalment</div>
                  </div>
                  <div style={{ background: '#C9A84C', color: '#0A1628', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: '8px', borderRadius: 6 }}>
                    Collect payment
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ background: '#0F2442', borderTop: '1px solid #1E3A5F', borderBottom: '1px solid #1E3A5F', padding: '72px 24px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <Tag>Real businesses, real results</Tag>
            <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800 }}>What our customers say</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            {TESTIMONIALS.map(({ name, role, text }) => (
              <div key={name} style={{ background: '#0A1628', border: '1px solid #1E3A5F', borderRadius: 12, padding: '24px 26px' }}>
                <div style={{ display: 'flex', gap: 2, marginBottom: 14 }}>
                  {Array(5).fill(0).map((_, i) => <Star key={i} size={14} fill="#C9A84C" color="#C9A84C" />)}
                </div>
                <p style={{ fontSize: 14, color: '#8AAAD4', lineHeight: 1.75, marginBottom: 20, fontStyle: 'italic' }}>"{text}"</p>
                <div style={{ borderTop: '1px solid #1E3A5F', paddingTop: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#6B8BB5', marginTop: 3 }}>{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '80px 24px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Tag>Transparent pricing</Tag>
          <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800, marginBottom: 10 }}>Pay for what your business needs</h2>
          <p style={{ fontSize: 15, color: '#8AAAD4' }}>14-day free trial · No credit card · Monthly, yearly, or one-off lifetime payment</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 18, alignItems: 'start' }}>
          {PLANS.map(({ name, price, period, tag, highlight, desc, features }) => (
            <div key={name} style={{ background: highlight ? '#0F2442' : '#070E1A', border: highlight ? '2px solid #C9A84C' : '1px solid #1E3A5F', borderRadius: 14, padding: '28px 26px', position: 'relative' }}>
              {tag && (
                <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#C9A84C', color: '#0A1628', fontSize: 10, fontWeight: 800, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap', letterSpacing: 0.3 }}>{tag}</div>
              )}
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 12, color: '#6B8BB5', marginBottom: 14 }}>{desc}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 22 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: '#C9A84C' }}>{price}</span>
                <span style={{ fontSize: 12, color: '#6B8BB5' }}>{period}</span>
              </div>
              <div style={{ borderTop: '1px solid #1E3A5F', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(76,175,125,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Check size={11} color="#4CAF7D" />
                    </div>
                    <span style={{ fontSize: 13, color: '#8AAAD4', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/signup" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: highlight ? '#C9A84C' : 'transparent', color: highlight ? '#0A1628' : '#C9A84C', border: highlight ? 'none' : '1px solid #C9A84C', transition: 'opacity .15s' }}>
                Start free trial
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#6B8BB5', marginTop: 24 }}>
          Also available: yearly (save 10%) and one-off lifetime payment — because Nigerian SME owners shouldn't fear recurring charges.
        </p>
      </section>

      {/* ── FINAL CTA ── */}
      <div style={{ background: '#0F2442', borderTop: '1px solid #1E3A5F', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 620, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 800, marginBottom: 14 }}>
            Start running your shop smarter
          </h2>
          <p style={{ fontSize: 16, color: '#8AAAD4', marginBottom: 34, lineHeight: 1.75 }}>
            No app store. No scanner hardware. No long contracts. Just a tool that understands how Nigerian traders actually operate.
          </p>
          <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#C9A84C', color: '#0A1628', fontWeight: 800, fontSize: 17, padding: '16px 40px', borderRadius: 9, textDecoration: 'none' }}>
            Start free — 14 days <ArrowRight size={20} />
          </Link>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
            {['No credit card', 'No app store needed', 'Cancel anytime', '24/7 support'].map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B8BB5' }}>
                <Check size={13} color="#4CAF7D" /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#070E1A', borderTop: '1px solid #1E3A5F', padding: '48px 24px 28px' }} aria-label="Site footer">
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 32, marginBottom: 36 }} className="sk-footer-grid">
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#C9A84C', marginBottom: 10 }}>ShopKepa</div>
              <p style={{ fontSize: 13, color: '#6B8BB5', lineHeight: 1.7, marginBottom: 14 }}>
                The retail POS built for Nigerian businesses — installments, job cards, multi-branch stock, offline sales, and true profit tracking.
              </p>
              <p style={{ fontSize: 12, color: '#3D5A7A' }}>By Tech Affairs and Innovative Hub<br />Ibadan, Oyo State, Nigeria</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Modules', 'Pricing', 'POS', 'Reports', 'Job cards'] },
              { title: 'Industries', links: ['Supermarkets', 'Pharmacies', 'Restaurants', 'Repair shops', 'Electronics', 'Fashion'] },
              { title: 'Company', links: ['About us', 'Contact', 'Privacy policy', 'Terms of service', 'Help centre'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{col.title}</div>
                {col.links.map(l => (
                  <div key={l} style={{ marginBottom: 9 }}>
                    <a href="#" style={{ fontSize: 13, color: '#6B8BB5', textDecoration: 'none', transition: 'color .15s' }}
                      onMouseEnter={e => e.target.style.color = '#C9A84C'}
                      onMouseLeave={e => e.target.style.color = '#6B8BB5'}>{l}</a>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #1E3A5F', paddingTop: 22, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#3D5A7A' }}>© 2026 Tech Affairs and Innovative Hub. All rights reserved. ShopKepa is a registered product.</span>
            <span style={{ fontSize: 12, color: '#3D5A7A' }}>Made with ♥ in Ibadan, Nigeria 🇳🇬</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes sk-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @media (max-width: 768px) {
          .sk-nav-links { display: none !important; }
          .sk-hamburger { display: block !important; }
          .sk-edge-grid { grid-template-columns: 1fr !important; display: none !important; }
          .sk-edge-cards { display: grid !important; }
          .sk-split { grid-template-columns: 1fr !important; }
          .sk-footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (min-width: 769px) {
          .sk-hamburger { display: none !important; }
          .sk-edge-cards { display: none !important; }
        }
      `}</style>
    </div>
  )
}
