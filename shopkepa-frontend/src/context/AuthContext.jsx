import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI, setAccessToken, clearAccessToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true) // true while checking session

  // On mount: try to restore session via refresh cookie
  useEffect(() => {
    const restore = async () => {
      try {
        const res = await authAPI.refresh()
        setAccessToken(res.data.access)
        const me = await authAPI.me()
        setUser(me.data)
      } catch {
        // No valid session — stay logged out
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [])

  // Listen for forced logout (e.g. from API interceptor)
  useEffect(() => {
    const handle = () => logout()
    window.addEventListener('auth:logout', handle)
    return () => window.removeEventListener('auth:logout', handle)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password })
    setAccessToken(res.data.access)
    const me = await authAPI.me()
    setUser(me.data)
    return me.data
  }, [])

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch { /* best effort */ }
    clearAccessToken()
    setUser(null)
  }, [])

  // Role helpers
  const isOwner   = user?.role === 'owner'   || user?.role === 'admin'
  const isCashier = user?.role === 'cashier'
  const isManager = user?.role === 'manager'

  // Where to send the user after login
  const defaultRoute = () => {
    if (isOwner || isManager) return '/dashboard'
    if (isCashier)            return '/pos'
    return '/dashboard'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isOwner, isCashier, isManager, defaultRoute }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
