import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI, modulesAPI, setAccessToken, clearAccessToken } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                 = useState(null)
  const [activeModules, setActiveModules] = useState([])
  const [loading, setLoading]           = useState(true) // covers auth + modules

  const loadModules = useCallback(async () => {
    try {
      const res = await modulesAPI.active()
      const arr = Array.isArray(res.data) ? res.data : (res.data.results ?? [])
      setActiveModules(arr.filter(bm => bm.is_active))
    } catch {
      setActiveModules([])
    }
  }, [])

  // On mount: restore session
  useEffect(() => {
    const restore = async () => {
      try {
        const res = await authAPI.refresh()
        setAccessToken(res.data.access)
        const [me] = await Promise.all([authAPI.me(), loadModules()])
        setUser(me.data)
      } catch {
        // No valid session — stay logged out
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [loadModules])

  useEffect(() => {
    const handle = () => {
      sessionStorage.setItem('sk_session_expired', '1')
      logout()
    }
    window.addEventListener('auth:logout', handle)
    return () => window.removeEventListener('auth:logout', handle)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login({ email, password })
    setAccessToken(res.data.access)
    const me = await authAPI.me()
    setUser(me.data)
    await loadModules()
    return me.data
  }, [loadModules])

  const reloadUser = useCallback(async () => {
    try {
      const me = await authAPI.me()
      setUser(me.data)
      return me.data
    } catch {
      return null
    }
  }, [])

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch { /* best effort */ }
    clearAccessToken()
    setUser(null)
    setActiveModules([])
    sessionStorage.removeItem('shopkepa_pos_setup')
  }, [])

  // Role helpers
  const isOwner   = user?.role === 'owner'   || user?.role === 'admin'
  const isCashier = user?.role === 'cashier'
  const isManager = user?.role === 'manager'

  // Active module codes for quick lookup
  const activeCodes = new Set(activeModules.map(bm => bm.module?.code).filter(Boolean))
  const hasModules  = activeModules.length > 0

  // Platform owner (Django superuser). Without a business of their own they
  // only use the platform admin area, never business onboarding.
  const isPlatformAdmin = !!user?.is_superuser

  // `u` lets callers pass the user just returned by login(), before the
  // state update above has re-rendered this context.
  const defaultRoute = (u = user) => {
    if (u?.is_superuser && !u?.business_id) return '/platform'
    if (!hasModules) return '/onboarding'
    if (isOwner || isManager) return '/dashboard'
    if (isCashier)            return '/pos'
    return '/dashboard'
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout,
      isOwner, isCashier, isManager, isPlatformAdmin,
      activeModules, activeCodes, hasModules,
      reloadModules: loadModules,
      reloadUser,
      defaultRoute,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
