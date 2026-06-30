import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { parseApiError } from '../../utils/format'

export default function LoginPage() {
  const { login, defaultRoute } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || null

  const [form, setForm]         = useState({ email: '', password: '' })
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [countdown, setCountdown] = useState(0) // for 429

  // Countdown timer for rate-limit lockout
  useEffect(() => {
    if (countdown <= 0) return
    const t = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [countdown])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (countdown > 0) return

    setError('')
    setLoading(true)

    try {
      const user = await login(form.email, form.password)
      const dest = from || defaultRoute()
      navigate(dest, { replace: true })
    } catch (err) {
      if (err?.retryAfter) {
        setCountdown(err.retryAfter)
        setError(`Too many attempts. Try again in ${err.retryAfter} seconds.`)
      } else {
        setError(parseApiError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--navy)', padding: '24px 16px',
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold)', letterSpacing: 1 }}>
          ShopKepa
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
          Nigerian Retail Platform by Tech Affairs
        </div>
      </div>

      {/* Card */}
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Welcome back</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
          Sign in to your store
        </p>

        {error && (
          <div style={{
            background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
            borderRadius: 'var(--r-sm)', padding: '10px 14px',
            display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 18,
          }}>
            <AlertCircle size={15} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--error)', lineHeight: 1.4 }}>
              {countdown > 0 ? `Too many attempts. Try again in ${countdown}s.` : error}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              className="input"
              placeholder="user@business.com"
              value={form.email}
              onChange={set('email')}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                required
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                  display: 'flex', padding: 0,
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-gold"
            disabled={loading || countdown > 0}
            style={{ marginTop: 4 }}
          >
            {loading ? 'Signing in…' : countdown > 0 ? `Wait ${countdown}s` : 'Sign in'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            Forgot password? Contact your admin to reset it.
          </span>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
          No account yet?{' '}
          <Link to="/signup" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
            Create one free
          </Link>
        </p>
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 24, textAlign: 'center' }}>
        Tech Affairs and Innovative Hub · Nigeria
      </p>
    </div>
  )
}
