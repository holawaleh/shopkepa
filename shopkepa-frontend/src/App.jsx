import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
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
