import axios from 'axios'

const RAW_BASE_URL = import.meta.env.VITE_API_URL || 'https://shopkepa-backend.onrender.com/api/v1'
const BACKEND_ROOT = RAW_BASE_URL.replace(/\/+$/, '').replace(/\/api\/v1$/, '')
const BASE_URL = `${BACKEND_ROOT}/api/v1`

// Access token lives ONLY in memory — never localStorage
let _accessToken = null

export const setAccessToken = (token) => { _accessToken = token }
export const getAccessToken = () => _accessToken
export const clearAccessToken = () => { _accessToken = null }

// ── Main API client ──
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends httpOnly refresh cookie automatically
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token and keep request paths relative to BASE_URL.
api.interceptors.request.use((config) => {
  if (typeof config.url === 'string') {
    config.url = config.url.replace(/^\/api\/v1(?=\/)/, '')
  }

  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`
  }
  return config
})

// ── Token refresh logic ──
let _refreshPromise = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // Skip auth endpoints to prevent recursive retry loops
    const isAuthEndpoint = original.url?.includes('/auth/token/refresh/') ||
                           original.url?.includes('/auth/logout/') ||
                           original.url?.includes('/auth/login/')
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true

      // Deduplicate concurrent refresh calls
      if (!_refreshPromise) {
        _refreshPromise = axios
          .post(`${BASE_URL}/auth/token/refresh/`, {}, { withCredentials: true })
          .then((res) => {
            setAccessToken(res.data.access)
            return res.data.access
          })
          .catch((err) => {
            const wasLoggedIn = !!_accessToken
            clearAccessToken()
            if (wasLoggedIn) {
              window.dispatchEvent(new Event('auth:logout'))
            }
            return Promise.reject(err)
          })
          .finally(() => { _refreshPromise = null })
      }

      try {
        const newToken = await _refreshPromise
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        return Promise.reject(error)
      }
    }

    // 429 → rate limited
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || 60
      error.retryAfter = parseInt(retryAfter, 10)
    }

    // Pure network failure (server unreachable / no internet)
    if (!error.response) {
      error._networkError = true
      // Dispatch a custom event so the app-level listener can show a toast
      window.dispatchEvent(new CustomEvent('api:network-error'))
    }

    // 5xx server error — tag it so UI can show a generic message
    if (error.response?.status >= 500) {
      error._serverError = true
      window.dispatchEvent(new CustomEvent('api:server-error', { detail: { status: error.response.status } }))
    }

    return Promise.reject(error)
  }
)

export default api

// ── Typed API helpers ──

export const authAPI = {
  register:       (data) => api.post('/auth/register/', data),
  login:          (data) => api.post('/auth/login/', data),
  logout:         ()     => api.post('/auth/logout/'),
  me:             ()     => api.get('/auth/me/'),
  refresh:        ()     => api.post('/auth/token/refresh/'),
  changePassword: (data) => api.post('/auth/change-password/', data),
  requestPasswordReset: (data) => api.post('/auth/password-reset/request/', data),
  confirmPasswordReset: (data) => api.post('/auth/password-reset/confirm/', data),
}

export const productsAPI = {
  list:           (params) => api.get('/products/', { params }),
  listCategories: (params) => api.get('/products/categories/', { params }),
  createCategory: (data)   => api.post('/products/categories/', data),
  get:          (id)     => api.get(`/products/${id}/`),
  create:         (data)   => api.post('/products/', data),
  update:       (id, d)  => api.patch(`/products/${id}/`, d),
  delete:       (id)     => api.delete(`/products/${id}/`),
  adjustStock:  (id, d)  => api.post(`/products/${id}/adjust-stock/`, d),
  stockHistory: (id)     => api.get(`/products/${id}/stock-history/`),
  inventory:    (id)     => api.get(`/products/${id}/inventory/`),
  lowStock:       (params) => api.get('/products/low-stock/',  { params }),
  expiring:       (params) => api.get('/products/expiring/',   { params }),
}

export const salesAPI = {
  list:       (params) => api.get('/sales/', { params }),
  create:     (data)   => api.post('/sales/', data),
  get:        (id)     => api.get(`/sales/${id}/`),
  addPayment: (id, d)  => api.post(`/sales/${id}/add-payment/`, d),
  void:       (id)     => api.delete(`/sales/${id}/`),
}

export const customersAPI = {
  list:       (params)          => api.get('/customers/', { params }),
  get:        (id)              => api.get(`/customers/${id}/`),
  history:    (id)              => api.get(`/customers/${id}/history/`),
  create:     (data)            => api.post('/customers/', data),
  update:     (id, d)           => api.patch(`/customers/${id}/`, d),
  delete:     (id)              => api.delete(`/customers/${id}/`),
  top:        (params)          => api.get('/customers/top/', { params }),
  addNote:    (id, data)        => api.post(`/customers/${id}/notes/`, data),
  deleteNote: (id, noteId)      => api.delete(`/customers/${id}/notes/${noteId}/`),
}

export const reportsAPI = {
  dailySales:   (params) => api.get('/reports/sales/daily/',   { params }),
  weeklySales:  (params) => api.get('/reports/sales/weekly/',  { params }),
  monthlySales: (params) => api.get('/reports/sales/monthly/', { params }),
  debtors:      (params) => api.get('/reports/debtors/',       { params }),
  inventory:    (params) => api.get('/reports/inventory/',      { params }),
  customers:    (params) => api.get('/reports/customers/',      { params }),
  branches:     (params) => api.get('/reports/branches/',       { params }),
  expenses:     (params) => api.get('/reports/expenses/',       { params }),
}

export const jobCardsAPI = {
  list:         (params)        => api.get('/job-cards/', { params }),
  get:          (id)            => api.get(`/job-cards/${id}/`),
  create:       (data)          => api.post('/job-cards/', data),
  update:       (id, d)         => api.patch(`/job-cards/${id}/`, d),
  delete:       (id)            => api.delete(`/job-cards/${id}/`),
  pay:          (id, d)         => api.post(`/job-cards/${id}/add-payment/`, d),
  addPart:      (id, d)         => api.post(`/job-cards/${id}/parts/`, d),
  deletePart:   (id, partId)    => api.delete(`/job-cards/${id}/parts/${partId}/`),
  listServices: ()              => api.get('/job-cards/services/'),
  createService:(data)          => api.post('/job-cards/services/', data),
  updateService:(id, d)         => api.patch(`/job-cards/services/${id}/`, d),
  deleteService:(id)            => api.delete(`/job-cards/services/${id}/`),
}

export const branchesAPI = {
  list:   ()           => api.get('/branches/'),
  create: (data)       => api.post('/branches/', data),
  get:    (id)         => api.get(`/branches/${id}/`),
  update: (id, data)   => api.patch(`/branches/${id}/`, data),
  delete: (id)         => api.delete(`/branches/${id}/`),
}

export const expensesAPI = {
  listCategories:  ()       => api.get('/expenses/categories/'),
  createCategory:  (data)   => api.post('/expenses/categories/', data),
  list:            (params) => api.get('/expenses/', { params }),
  create:          (data)   => api.post('/expenses/', data),
  get:             (id)     => api.get(`/expenses/${id}/`),
  update:          (id, d)  => api.patch(`/expenses/${id}/`, d),
  delete:          (id)     => api.delete(`/expenses/${id}/`),
  summary:         (params) => api.get('/expenses/summary/', { params }),
}

export const businessAPI = {
  getProfile:     ()     => api.get('/business/profile/'),
  updateProfile:  (data) => api.patch('/business/profile/', data),
  getSettings:    ()     => api.get('/business/settings/'),
  updateSettings: (data) => api.patch('/business/settings/', data),
  getSubscription:()     => api.get('/business/subscription/'),
}

export const hotelAPI = {
  // Rooms
  listRooms:     (params) => api.get('/hotel/rooms/', { params }),
  createRoom:    (data)   => api.post('/hotel/rooms/', data),
  updateRoom:    (id, d)  => api.patch(`/hotel/rooms/${id}/`, d),
  deleteRoom:    (id)     => api.delete(`/hotel/rooms/${id}/`),
  // Bookings
  listBookings:  (params) => api.get('/hotel/bookings/', { params }),
  getBooking:    (id)     => api.get(`/hotel/bookings/${id}/`),
  createBooking: (data)   => api.post('/hotel/bookings/', data),
  updateBooking: (id, d)  => api.patch(`/hotel/bookings/${id}/`, d),
  checkIn:       (id)     => api.post(`/hotel/bookings/${id}/check-in/`),
  checkOut:      (id)     => api.post(`/hotel/bookings/${id}/check-out/`),
  pay:           (id, d)  => api.post(`/hotel/bookings/${id}/payment/`, d),
  // Stats
  occupancy:     ()       => api.get('/hotel/occupancy/'),
}


export const modulesAPI = {
  list:     ()              => api.get('/modules/'),
  active:   ()              => api.get('/modules/active/'),
  activate: (ids)           => api.post('/modules/activate/', { module_ids: ids }),
  toggle:   (id, is_active) => api.patch(`/modules/${id}/toggle/`, { is_active }),
}

export const staffAPI = {
  list:   ()           => api.get('/staff/'),
  create: (data)       => api.post('/staff/', data),
  update: (id, data)   => api.patch(`/staff/${id}/`, data),
  toggle: (id, active) => api.patch(`/staff/${id}/toggle-active/`, { is_active: active }),
  delete: (id)         => api.delete(`/staff/${id}/`),
}

