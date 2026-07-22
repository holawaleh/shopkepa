import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { authAPI } from '../../api/client'
import { parseApiError } from '../../utils/format'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const response = await authAPI.requestPasswordReset({ email })
      setMessage(response.data.message)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold)', letterSpacing: 1 }}>ShopKepa</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>Nigerian Retail Platform by Tech Affairs</div>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 28 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Reset your password</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.5 }}>
          Enter your account email and we will send you a secure reset link.
        </p>

        {message && (
          <div style={{ background: 'rgba(76,175,125,0.12)', border: '1px solid rgba(76,175,125,0.3)', borderRadius: 'var(--r-sm)', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 18 }}>
            <CheckCircle size={15} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--success)', lineHeight: 1.4 }}>{message}</span>
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 'var(--r-sm)', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 18 }}>
            <AlertCircle size={15} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: 'var(--error)', lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Email address</label>
            <input className="input" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="user@business.com" required autoComplete="email" />
          </div>
          <button type="submit" className="btn-gold" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 20 }}>
          <Link to="/login" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
