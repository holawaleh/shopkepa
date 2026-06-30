import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, Check, ShoppingCart, BarChart2, Wifi, Shield } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import { parseApiError } from '../../utils/format'
import { authAPI } from '../../api/client'

// Rotating value propositions for the advert panel
const SLIDES = [
  {
    icon: ShoppingCart,
    headline: 'Sell faster at the counter',
    body: 'Barcode scanning, instant cart updates, and one-tap checkout. Your busiest hour just got easier.',
    stat: '3×', statLabel: 'faster checkout vs manual',
  },
  {
    icon: BarChart2,
    headline: 'Know your numbers daily',
    body: 'Revenue, top products, debtor balances — all on one dashboard. No spreadsheets, no guesswork.',
    stat: '₦0', statLabel: 'extra cost for reports',
  },
  {
    icon: Wifi,
    headline: 'Works even without internet',
    body: 'Power cut or bad network? ShopKepa keeps selling. Your data syncs automatically when you\'re back online.',
    stat: '100%', statLabel: 'uptime regardless of network',
  },
  {
    icon: Shield,
    headline: 'Built for Nigerian retail',
    body: 'Installment payments, loyalty points, job cards for repair shops. Everything your business actually needs.',
    stat: '12+', statLabel: 'modules in one platform',
  },
]

const FEATURES = [
  'POS with barcode scanning',
  'Multi-branch support',
  'Installment & credit sales',
  'Daily revenue reports',
  'Customer loyalty system',
  'Job card management',
]

export default function SignupPage() {
  const { success, error: toastError } = useToast()
  const navigate = useNavigate()

  const [slide, setSlide] = useState(0)
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    phone: '', business_name: '', password: '', confirm_password: '',
  })
  const [showPw, setShowPw]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState({})
  const [step, setStep]             = useState(1) // 1 = personal, 2 = business + password

  // Auto-rotate slides every 4s
  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 4000)
    return () => clearInterval(t)
  }, [])

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setErrors(er => ({ ...er, [field]: '' }))
  }

  const validateStep1 = () => {
    const e = {}
    if (!form.first_name.trim()) e.first_name = 'Enter your first name'
    if (!form.last_name.trim())  e.last_name  = 'Enter your last name'
    if (!form.email.trim())      e.email      = 'Enter your email'
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.phone.trim())      e.phone      = 'Enter your phone number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e = {}
    if (!form.business_name.trim())   e.business_name    = 'Enter your business name'
    if (!form.password)               e.password         = 'Choose a password'
    if (form.password.length < 8)    e.password         = 'Password must be at least 8 characters'
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = (e) => {
    e.preventDefault()
    if (validateStep1()) setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return
    setLoading(true)
    try {
      await authAPI.register({
        first_name:    form.first_name,
        last_name:     form.last_name,
        email:         form.email,
        phone:         form.phone,
        business_name: form.business_name,
        password:      form.password,
      })
      success('Account created! Sign in to get started.')
      navigate('/login')
    } catch (err) {
      toastError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const currentSlide = SLIDES[slide]
  const SlideIcon = currentSlide.icon

  const FieldError = ({ field }) =>
    errors[field] ? (
      <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 4, display: 'block' }}>
        {errors[field]}
      </span>
    ) : null

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: 'var(--navy)' }}>

      {/* ── LEFT: Advert panel (hidden on mobile) ── */}
      <div style={{
        flex: '0 0 45%', background: 'var(--blue)',
        borderRight: '1px solid var(--mid)',
        display: 'flex', flexDirection: 'column',
        padding: '40px 48px', position: 'relative', overflow: 'hidden',
      }} className="advert-panel">

        {/* Brand */}
        <div style={{ marginBottom: 'auto' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gold)', letterSpacing: 0.5, marginBottom: 6 }}>
            ShopKepa
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            by Tech Affairs and Innovative Hub
          </div>
        </div>

        {/* Slide content */}
        <div style={{ margin: '48px 0' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <SlideIcon size={24} color="var(--gold)" />
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3, marginBottom: 16, color: 'var(--white)' }}>
            {currentSlide.headline}
          </h2>
          <p style={{ fontSize: 15, color: 'var(--light)', lineHeight: 1.7, marginBottom: 28 }}>
            {currentSlide.body}
          </p>

          {/* Stat callout */}
          <div style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 10,
            background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 10, padding: '12px 20px',
          }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold)' }}>
              {currentSlide.stat}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {currentSlide.statLabel}
            </span>
          </div>
        </div>

        {/* Slide dots */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              style={{
                width: i === slide ? 24 : 8, height: 8,
                borderRadius: 4, border: 'none', cursor: 'pointer',
                background: i === slide ? 'var(--gold)' : 'var(--mid)',
                transition: 'width 0.3s, background 0.3s', padding: 0,
              }}
            />
          ))}
        </div>

        {/* Features list */}
        <div style={{
          borderTop: '1px solid var(--mid)', paddingTop: 24,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px',
        }}>
          {FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'rgba(76,175,125,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Check size={11} color="#4CAF7D" />
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Decorative circle */}
        <div style={{
          position: 'absolute', bottom: -80, right: -80,
          width: 280, height: 280, borderRadius: '50%',
          border: '1px solid rgba(201,168,76,0.08)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, right: -40,
          width: 160, height: 160, borderRadius: '50%',
          border: '1px solid rgba(201,168,76,0.12)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── RIGHT: Signup form ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', overflowY: 'auto',
      }}>

        {/* Mobile brand (hidden on desktop) */}
        <div className="mobile-brand" style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)' }}>ShopKepa</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>by Tech Affairs and Innovative Hub</div>
        </div>

        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            {[1, 2].map(n => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600,
                  background: step >= n ? 'var(--gold)' : 'var(--mid)',
                  color: step >= n ? 'var(--navy)' : 'var(--muted)',
                  transition: 'background 0.2s',
                }}>
                  {step > n ? <Check size={13} /> : n}
                </div>
                <span style={{ fontSize: 12, color: step >= n ? 'var(--light)' : 'var(--muted)' }}>
                  {n === 1 ? 'Your details' : 'Business info'}
                </span>
                {n < 2 && <div style={{ width: 32, height: 1, background: step > 1 ? 'var(--gold)' : 'var(--mid)', transition: 'background 0.2s' }} />}
              </div>
            ))}
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
            {step === 1 ? 'Create your account' : 'Set up your business'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
            {step === 1 ? 'Start managing your shop in minutes' : 'Almost done — just a few more details'}
          </p>

          {/* Step 1 */}
          {step === 1 && (
            <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>First name</label>
                  <input className={`input ${errors.first_name ? 'input-error' : ''}`} placeholder=" " value={form.first_name} onChange={set('first_name')} />
                  <FieldError field="first_name" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Last name</label>
                  <input className={`input ${errors.last_name ? 'input-error' : ''}`} placeholder=" " value={form.last_name} onChange={set('last_name')} />
                  <FieldError field="last_name" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Email address</label>
                <input type="email" className={`input ${errors.email ? 'input-error' : ''}`} placeholder="user@businees.com" value={form.email} onChange={set('email')} autoComplete="email" />
                <FieldError field="email" />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Phone number</label>
                <input type="tel" className={`input ${errors.phone ? 'input-error' : ''}`} placeholder="08012345678" value={form.phone} onChange={set('phone')} />
                <FieldError field="phone" />
              </div>

              <button type="submit" className="btn-gold" style={{ marginTop: 6 }}>
                Continue →
              </button>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Business name</label>
                <input className={`input ${errors.business_name ? 'input-error' : ''}`} placeholder=" " value={form.business_name} onChange={set('business_name')} />
                <FieldError field="business_name" />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    className={`input ${errors.password ? 'input-error' : ''}`}
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <FieldError field="password" />
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Confirm password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className={`input ${errors.confirm_password ? 'input-error' : ''}`}
                    placeholder="Repeat password"
                    value={form.confirm_password}
                    onChange={set('confirm_password')}
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <FieldError field="confirm_password" />
              </div>

              {/* Password strength bar */}
              {form.password && (
                <div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1,2,3,4].map(n => {
                      const strength = [
                        form.password.length >= 8,
                        /[A-Z]/.test(form.password),
                        /[0-9]/.test(form.password),
                        /[^A-Za-z0-9]/.test(form.password),
                      ].filter(Boolean).length
                      return (
                        <div key={n} style={{
                          flex: 1, height: 3, borderRadius: 2,
                          background: n <= strength
                            ? strength <= 1 ? 'var(--error)'
                            : strength <= 2 ? 'var(--warning)'
                            : 'var(--success)'
                            : 'var(--mid)',
                          transition: 'background 0.2s',
                        }} />
                      )
                    })}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {(() => {
                      const s = [form.password.length >= 8, /[A-Z]/.test(form.password), /[0-9]/.test(form.password), /[^A-Za-z0-9]/.test(form.password)].filter(Boolean).length
                      return ['', 'Weak', 'Fair', 'Good', 'Strong'][s]
                    })()}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </div>

              <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
                By creating an account you agree to our terms of service and privacy policy.
              </p>
            </form>
          )}

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 24 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .advert-panel { display: none !important; }
          .mobile-brand { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-brand { display: none !important; }
        }
      `}</style>
    </div>
  )
}
