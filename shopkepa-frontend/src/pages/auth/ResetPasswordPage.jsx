import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { authAPI } from '../../api/client'
import { parseApiError } from '../../utils/format'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(token ? '' : 'This password reset link is invalid or incomplete.')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!token) return
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await authAPI.confirmPasswordReset({ token, new_password: password })
      setMessage(response.data.message)
      setPassword('')
      setConfirm('')
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
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Choose a new password</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.5 }}>Your new password must be at least 8 characters.</p>

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

        {!message && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>New password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" required autoComplete="new-password" style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Confirm new password</label>
              <input className="input" type="password" value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="Repeat your password" required autoComplete="new-password" />
            </div>
            <button type="submit" className="btn-gold" disabled={loading || !token}>
              {loading ? 'Updating...' : 'Reset password'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 20 }}>
          <Link to="/login" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
