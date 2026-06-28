import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, color: 'var(--gold)', fontWeight: 600, marginBottom: 12 }}>ShopKepa</div>
          <div style={{ width: 32, height: 32, border: '3px solid var(--mid)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export function GuestRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
