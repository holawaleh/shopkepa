import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart, BarChart2, Users, Package, Wifi, Shield,
  Check, Star, ChevronDown, Menu, X, ArrowRight, Zap,
  TrendingUp, Clock, Lock, Smartphone, Monitor, MapPin
} from 'lucide-react'

// ── Data ──
const FEATURES = [
  { icon: ShoppingCart, title: 'Lightning-fast POS', body: 'Barcode scanning, one-tap checkout, multiple payment methods. Serve more customers in less time.' },
  { icon: Package,      title: 'Real-time inventory', body: 'Track stock across all branches instantly. Low-stock alerts before you run out.' },
  { icon: Users,        title: 'Customer loyalty', body: 'Credit accounts, installment sales, loyalty points. Build relationships that keep customers coming back.' },
  { icon: BarChart2,    title: 'Daily reports', body: 'Revenue, top products, debtor balances — all on one dashboard. No spreadsheets.' },
  { icon: Wifi,         title: 'Works offline', body: 'Power cut? Bad network? ShopKepa keeps selling. Data syncs when you reconnect.' },
  { icon: Shield,       title: 'Nigerian-built', body: 'Installments, job cards, multi-branch, Paystack. Built for how Nigerian businesses actually work.' },
]

const INDUSTRIES = [
  { emoji: '🛒', name: 'Supermarkets',    desc: 'Multi-department inventory & fast sales' },
  { emoji: '💊', name: 'Pharmacies',      desc: 'Batch tracking & expiry management' },
  { emoji: '🍔', name: 'Restaurants',     desc: 'Menu, orders & delivery management' },
  { emoji: '👗', name: 'Fashion & Boutiques', desc: 'Size, colour variants & seasonal stock' },
  { emoji: '💻', name: 'Electronics',     desc: 'High-value items & warranty tracking' },
  { emoji: '🔧', name: 'Repair Shops',    desc: 'Job cards, labour charges & parts' },
  { emoji: '🥩', name: 'Grocery Stores',  desc: 'Fresh goods & bulk sales' },
  { emoji: '💈', name: 'Beauty & Salons', desc: 'Services, products & appointments' },
]

const TESTIMONIALS = [
  { name: 'Emeka Nwosu', role: 'Supermarket Owner, Lagos', stars: 5, text: 'ShopKepa transformed how we handle sales. We process 3× more transactions daily with zero errors. The barcode scanning alone saved us hours every day.' },
  { name: 'Dr. Aisha Bello', role: 'Pharmacy Manager, Abuja', stars: 5, text: 'The installment tracking is exactly what we needed. Customers pay in parts, we track every kobo. No more lost debts in notebooks.' },
  { name: 'Kunle Johnson', role: 'Electronics Store, Port Harcourt', stars: 5, text: 'Finally a POS built for Nigeria — not some foreign software that doesn\'t understand our market. Job cards for repairs work perfectly.' },
]

const PLANS = [
  {
    name: 'Starter', price: '₦5,000', period: '/month', tag: null,
    features: ['1 branch', '3 staff accounts', '1,000 products', 'POS + inventory', 'Basic reports', 'Email support'],
  },
  {
    name: 'Growth', price: '₦10,000', period: '/month', tag: 'Most popular',
    features: ['2 branches', '5 staff accounts', '3,000 products', 'POS + inventory', 'Advanced reports', 'Priority support', 'Customer loyalty', 'Installment tracking'],
  },
  {
    name: 'Professional', price: '₦20,000', period: '/month', tag: null,
    features: ['5 branches', '15 staff accounts', 'Unlimited products', 'All modules', 'Custom reports', 'Dedicated support', 'API access', 'White-label option'],
  },
]

const STATS = [
  { value: '500+', label: 'Businesses active' },
  { value: '₦2B+', label: 'Transactions processed' },
  { value: '99.9%', label: 'Platform uptime' },
  { value: '24/7', label: 'Customer support' },
]

// ── Sub-components ──
function NavBar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: scrolled ? 'rgba(10,22,40,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--mid)' : 'none',
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', letterSpacing: 0.5 }}>ShopKepa</div>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }} className="nav-links">
          {['Features', 'Industries', 'Pricing', 'About'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ color: 'var(--light)', fontSize: 14, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color = 'var(--gold)'}
              onMouseLeave={e => e.target.style.color = 'var(--light)'}>{l}</a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }} className="nav-links">
          <Link to="/login" style={{ color: 'var(--light)', fontSize: 14, textDecoration: 'none', padding: '8px 16px' }}>Sign in</Link>
          <Link to="/signup" style={{
            background: 'var(--gold)', color: 'var(--navy)', fontSize: 14, fontWeight: 600,
            textDecoration: 'none', padding: '9px 20px', borderRadius: 6,
          }}>Get started free</Link>
        </div>

        <button onClick={() => setOpen(o => !o)} className="nav-hamburger"
          style={{ background: 'none', border: 'none', color: 'var(--light)', cursor: 'pointer' }}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{ background: 'var(--navy)', borderTop: '1px solid var(--mid)', padding: '16px 24px 24px' }}>
          {['Features', 'Industries', 'Pricing', 'About'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setOpen(false)}
              style={{ display: 'block', color: 'var(--light)', fontSize: 16, textDecoration: 'none', padding: '12px 0', borderBottom: '1px solid var(--mid)' }}>{l}</a>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', padding: '11px' }}>Sign in</Link>
            <Link to="/signup" onClick={() => setOpen(false)} className="btn-gold" style={{ flex: 2, textAlign: 'center', textDecoration: 'none', padding: '11px' }}>Get started</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

function StarRating({ count = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={14} fill="var(--gold)" color="var(--gold)" />
      ))}
    </div>
  )
}

function Section({ id, children, style = {} }) {
  return (
    <section id={id} style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto', ...style }}>
      {children}
    </section>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
      <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 500, letterSpacing: 0.5 }}>{children}</span>
    </div>
  )
}

// ── Main component ──
export default function LandingPage() {
  const [activePlan, setActivePlan] = useState(1)

  return (
    <div style={{ background: 'var(--navy)', color: 'var(--white)', overflowX: 'hidden' }}>
      <NavBar />

      {/* ── HERO ── */}
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '120px 24px 80px', textAlign: 'center', position: 'relative',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(76,175,125,0.12)', border: '1px solid rgba(76,175,125,0.3)',
          borderRadius: 20, padding: '5px 14px', marginBottom: 24,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF7D', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 500 }}>Now serving 500+ Nigerian businesses</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.15,
          maxWidth: 800, marginBottom: 24,
        }}>
          The POS built for{' '}
          <span style={{ color: 'var(--gold)', position: 'relative' }}>
            Nigerian retail
          </span>
        </h1>

        <p style={{ fontSize: 'clamp(15px, 2vw, 19px)', color: 'var(--light)', maxWidth: 600, lineHeight: 1.7, marginBottom: 40 }}>
          Sell faster, track stock in real-time, manage debtors, and grow your business — all from one platform that works even without internet.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/signup" style={{
            background: 'var(--gold)', color: 'var(--navy)', fontWeight: 700,
            fontSize: 16, padding: '14px 32px', borderRadius: 8,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            Start for free <ArrowRight size={18} />
          </Link>
          <a href="#features" style={{
            color: 'var(--light)', fontSize: 16, padding: '14px 28px', borderRadius: 8,
            border: '1px solid var(--mid)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'border-color 0.15s',
          }}>
            See how it works
          </a>
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16 }}>
          No credit card required · Free 14-day trial · Cancel anytime
        </p>

        {/* Floating dashboard preview */}
        <div style={{
          marginTop: 64, width: '100%', maxWidth: 860,
          background: 'var(--blue)', border: '1px solid var(--mid)',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}>
          {/* Browser chrome */}
          <div style={{ background: 'var(--navy)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--mid)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#E05555','#E8A838','#4CAF7D'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ flex: 1, background: 'var(--mid)', borderRadius: 4, height: 22, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>app.shopkepa.ng</span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Good morning,</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Ada's Supermarket</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ background: 'var(--gold)', color: 'var(--navy)', fontSize: 11, fontWeight: 600, padding: '6px 14px', borderRadius: 5 }}>New sale</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: "Today's revenue", value: '₦847,500', gold: true },
                { label: 'Transactions',    value: '143',       gold: false },
                { label: 'Customers',       value: '89',        gold: false },
                { label: 'Low stock',       value: '3 items',   gold: false, warn: true },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--navy)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--mid)' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: m.gold ? 'var(--gold)' : m.warn ? 'var(--error)' : 'var(--white)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--navy)', borderRadius: 8, border: '1px solid var(--mid)', padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 10 }}>Recent sales</div>
                {[
                  { name: 'Semovita 1kg ×3', time: '10:14 AM', amt: '₦4,500' },
                  { name: 'Indomie carton',  time: '9:52 AM',  amt: '₦9,800' },
                  { name: 'Peak Milk ×6',    time: '9:30 AM',  amt: '₦3,200' },
                ].map(s => (
                  <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--mid)', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10 }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>{s.time}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 500 }}>{s.amt}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--navy)', borderRadius: 8, border: '1px solid var(--mid)', padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 10 }}>Top products today</div>
                {[
                  { name: 'Semovita', pct: 85, val: '₦18k' },
                  { name: 'Indomie',  pct: 60, val: '₦12k' },
                  { name: 'Peak Milk',pct: 40, val: '₦8k'  },
                ].map(p => (
                  <div key={p.name} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10 }}>{p.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--gold)' }}>{p.val}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--mid)', borderRadius: 2 }}>
                      <div style={{ width: `${p.pct}%`, height: '100%', background: 'var(--gold)', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <a href="#features" style={{ marginTop: 48, color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 12 }}>
          Scroll to explore
          <ChevronDown size={18} style={{ animation: 'bounce 2s infinite' }} />
        </a>
      </div>

      {/* ── STATS BAND ── */}
      <div style={{ background: 'var(--blue)', borderTop: '1px solid var(--mid)', borderBottom: '1px solid var(--mid)', padding: '32px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 24, textAlign: 'center' }}>
          {STATS.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold)' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <Section id="features">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <SectionLabel>Everything you need</SectionLabel>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 700, marginBottom: 14 }}>
            One platform, every tool your shop needs
          </h2>
          <p style={{ fontSize: 16, color: 'var(--light)', maxWidth: 540, margin: '0 auto' }}>
            From the counter to the back office — ShopKepa handles it all, built for how Nigerian retail actually works.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card" style={{ padding: '24px 26px', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--mid)'}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Icon size={20} color="var(--gold)" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 14, color: 'var(--light)', lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── INDUSTRIES ── */}
      <div style={{ background: 'var(--blue)', borderTop: '1px solid var(--mid)', borderBottom: '1px solid var(--mid)', padding: '80px 24px' }} id="industries">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <SectionLabel>Built for your sector</SectionLabel>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700 }}>Works for every retail business</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {INDUSTRIES.map(({ emoji, name, desc }) => (
              <div key={name} style={{
                background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 10,
                padding: '18px 20px', transition: 'border-color 0.2s, transform 0.2s', cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--mid)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── DEVICE SHOWCASE ── */}
      <Section>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }} className="split-section">
          <div>
            <SectionLabel>Mobile-first design</SectionLabel>
            <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 700, marginBottom: 16 }}>
              Manage your shop from your pocket
            </h2>
            <p style={{ fontSize: 15, color: 'var(--light)', lineHeight: 1.7, marginBottom: 28 }}>
              ShopKepa is a Progressive Web App — install it on your Android phone like any app, no Play Store needed. It works on laptops, tablets, and touchscreen POS terminals too.
            </p>
            {[
              { icon: Smartphone, text: 'Install on Android — no app store needed' },
              { icon: Monitor,    text: 'Full desktop dashboard for owners' },
              { icon: Wifi,       text: 'Offline mode — sell without internet' },
              { icon: MapPin,     text: 'Multi-branch from one account' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={15} color="var(--gold)" />
                </div>
                <span style={{ fontSize: 14, color: 'var(--light)' }}>{text}</span>
              </div>
            ))}
            <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: 'var(--navy)', fontWeight: 600, fontSize: 14, padding: '12px 24px', borderRadius: 7, textDecoration: 'none', marginTop: 12 }}>
              Try it free <ArrowRight size={16} />
            </Link>
          </div>

          {/* Phone mockup */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 240, background: 'var(--blue)', borderRadius: 32,
              border: '2px solid var(--mid)', overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
            }}>
              <div style={{ background: 'var(--navy)', padding: '8px 16px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, color: 'var(--gold)' }}>9:41</span>
                <span style={{ fontSize: 9, color: 'var(--gold)' }}>●●● 100%</span>
              </div>
              <div style={{ background: 'var(--navy)', padding: '10px 14px', borderBottom: '1px solid var(--mid)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>ShopKepa</span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>POS</span>
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ background: 'var(--navy)', border: '1px dashed var(--mid)', borderRadius: 8, padding: 10, textAlign: 'center', marginBottom: 10 }}>
                  <ShoppingCart size={18} color="var(--gold)" style={{ display: 'block', margin: '0 auto 4px' }} />
                  <span style={{ fontSize: 9, color: 'var(--muted)' }}>Scan barcode</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 6, letterSpacing: 0.8 }}>CART (3 items)</div>
                {[
                  { name: 'Semovita 1kg', qty: '×3', price: '₦4,500' },
                  { name: 'Indomie',      qty: '×1', price: '₦600' },
                  { name: 'Peak Milk',    qty: '×2', price: '₦3,200' },
                ].map(i => (
                  <div key={i.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--mid)' }}>
                    <span style={{ fontSize: 9 }}>{i.name}</span>
                    <span style={{ fontSize: 9, background: 'var(--mid)', padding: '1px 5px', borderRadius: 3, color: 'var(--gold)' }}>{i.qty}</span>
                    <span style={{ fontSize: 9 }}>{i.price}</span>
                  </div>
                ))}
                <div style={{ background: 'var(--navy)', borderRadius: 6, padding: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>Total</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>₦8,300</span>
                  </div>
                  <div style={{ background: 'var(--gold)', color: 'var(--navy)', fontSize: 10, fontWeight: 600, textAlign: 'center', padding: 7, borderRadius: 5 }}>
                    Collect payment
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── TESTIMONIALS ── */}
      <div style={{ background: 'var(--blue)', borderTop: '1px solid var(--mid)', borderBottom: '1px solid var(--mid)', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <SectionLabel>Loved by business owners</SectionLabel>
            <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 700 }}>What our customers say</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {TESTIMONIALS.map(({ name, role, stars, text }) => (
              <div key={name} className="card" style={{ padding: '24px 26px' }}>
                <StarRating count={stars} />
                <p style={{ fontSize: 14, color: 'var(--light)', lineHeight: 1.7, margin: '14px 0 20px' }}>"{text}"</p>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <Section id="pricing">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <SectionLabel>Simple pricing</SectionLabel>
          <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 700, marginBottom: 10 }}>Affordable plans for every business</h2>
          <p style={{ fontSize: 15, color: 'var(--light)' }}>14-day free trial · No credit card required · Cancel anytime</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, alignItems: 'start' }}>
          {PLANS.map(({ name, price, period, tag, features }, idx) => (
            <div key={name} style={{
              background: idx === 1 ? 'var(--blue)' : 'var(--navy)',
              border: idx === 1 ? '2px solid var(--gold)' : '1px solid var(--mid)',
              borderRadius: 14, padding: '28px 26px', position: 'relative',
            }}>
              {tag && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold)', color: 'var(--navy)', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  {tag}
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold)' }}>{price}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{period}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--mid)', paddingTop: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(76,175,125,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={11} color="#4CAF7D" />
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--light)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/signup" style={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                padding: '11px', borderRadius: 7, fontWeight: 600, fontSize: 14,
                background: idx === 1 ? 'var(--gold)' : 'transparent',
                color: idx === 1 ? 'var(--navy)' : 'var(--gold)',
                border: idx === 1 ? 'none' : '1px solid var(--gold)',
              }}>
                Start free trial
              </Link>
            </div>
          ))}
        </div>
      </Section>

      {/* ── FINAL CTA ── */}
      <div style={{ background: 'var(--blue)', borderTop: '1px solid var(--mid)', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 700, marginBottom: 16 }}>
            Ready to grow your business?
          </h2>
          <p style={{ fontSize: 16, color: 'var(--light)', marginBottom: 36, lineHeight: 1.7 }}>
            Join 500+ Nigerian businesses already using ShopKepa. Start your free 14-day trial today — no credit card required.
          </p>
          <Link to="/signup" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--gold)', color: 'var(--navy)',
            fontWeight: 700, fontSize: 17, padding: '16px 40px', borderRadius: 8,
            textDecoration: 'none',
          }}>
            Get started free <ArrowRight size={20} />
          </Link>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            {['14-day free trial', 'No credit card', 'Cancel anytime', '24/7 support'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
                <Check size={13} color="#4CAF7D" /> {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'var(--navy)', borderTop: '1px solid var(--mid)', padding: '48px 24px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, marginBottom: 40 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>ShopKepa</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                The POS platform built for Nigerian retail by Tech Affairs and Innovative Hub, Ibadan.
              </p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'POS', 'Reports', 'Job Cards'] },
              { title: 'Industries', links: ['Supermarkets', 'Pharmacies', 'Restaurants', 'Electronics', 'Repair shops'] },
              { title: 'Support', links: ['Help center', 'Contact us', 'Privacy policy', 'Terms of service'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--white)' }}>{col.title}</div>
                {col.links.map(l => (
                  <div key={l} style={{ marginBottom: 8 }}>
                    <a href="#" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.target.style.color = 'var(--gold)'}
                      onMouseLeave={e => e.target.style.color = 'var(--muted)'}>{l}</a>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--mid)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>© 2026 Tech Affairs and Innovative Hub. All rights reserved.</span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Made with ♥ in Ibadan, Nigeria 🇳🇬</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
        @media (max-width: 768px) {
          .nav-links   { display: none !important; }
          .nav-hamburger { display: block !important; }
          .split-section { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 769px) {
          .nav-hamburger { display: none !important; }
        }
      `}</style>
    </div>
  )
}
