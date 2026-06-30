import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider, useToast } from './context/ToastContext'
import { ProtectedRoute, GuestRoute } from './components/ui/ProtectedRoute'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import LandingPage from './pages/landing/LandingPage'
import DashboardPage from './pages/dashboard/DashboardPage'

const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'))
const POSPage        = lazy(() => import('./pages/pos/POSPage'))
const ProductsPage   = lazy(() => import('./pages/products/ProductsPage'))
const CustomersPage  = lazy(() => import('./pages/customers/CustomersPage'))
const ReportsPage    = lazy(() => import('./pages/reports/ReportsPage'))
const JobCardsPage   = lazy(() => import('./pages/jobcards/JobCardsPage'))
const SettingsPage   = lazy(() => import('./pages/settings/SettingsPage'))
const HotelPage      = lazy(() => import('./pages/hotel/HotelPage'))

function PageLoader() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--mid)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// Listens for axios-dispatched network/server errors and shows a toast
function GlobalApiErrorListener() {
  const { error: toastError, info } = useToast()

  useEffect(() => {
    let lastNetworkToast = 0

    const onNetworkError = () => {
      // Debounce: only show once per 5 seconds to avoid toast storm
      const now = Date.now()
      if (now - lastNetworkToast < 5000) return
      lastNetworkToast = now
      toastError('Could not reach the server. Check your internet connection.')
    }

    const onServerError = (e) => {
      const status = e.detail?.status
      toastError(status === 503
        ? 'Server is temporarily unavailable. Please try again shortly.'
        : 'A server error occurred. Please try again.')
    }

    window.addEventListener('api:network-error', onNetworkError)
    window.addEventListener('api:server-error',  onServerError)
    return () => {
      window.removeEventListener('api:network-error', onNetworkError)
      window.removeEventListener('api:server-error',  onServerError)
    }
  }, [toastError])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <GlobalApiErrorListener />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login"       element={<GuestRoute><LoginPage /></GuestRoute>} />
              <Route path="/signup"      element={<GuestRoute><SignupPage /></GuestRoute>} />
              <Route path="/onboarding"  element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
              <Route path="/dashboard"   element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/pos"         element={<ProtectedRoute><POSPage /></ProtectedRoute>} />
              <Route path="/products"    element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
              <Route path="/customers"   element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
              <Route path="/reports"     element={<ProtectedRoute roles={['owner','admin','manager']}><ReportsPage /></ProtectedRoute>} />
              <Route path="/jobcards"    element={<ProtectedRoute><JobCardsPage /></ProtectedRoute>} />
              <Route path="/hotel"       element={<ProtectedRoute><HotelPage /></ProtectedRoute>} />
              <Route path="/settings"    element={<ProtectedRoute roles={['owner','admin']}><SettingsPage /></ProtectedRoute>} />
              <Route path="/"            element={<LandingPage />} />
              <Route path="*"            element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
