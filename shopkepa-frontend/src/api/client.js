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

    return Promise.reject(error)
  }
)

export default api

// ── Typed API helpers ──

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login:   (data) => api.post('/auth/login/', data),
  logout:  ()     => api.post('/auth/logout/'),
  me:      ()     => api.get('/auth/me/'),
  refresh: ()     => api.post('/auth/token/refresh/'),
}

export const productsAPI = {
  list:         (params) => api.get('/products/', { params }),
  get:          (id)     => api.get(`/products/${id}/`),
  create:       (data)   => api.post('/products/', data),
  update:       (id, d)  => api.patch(`/products/${id}/`, d),
  delete:       (id)     => api.delete(`/products/${id}/`),
  stockHistory: (id)     => api.get(`/products/${id}/stock-history/`),
}

export const salesAPI = {
  list:   (params) => api.get('/sales/', { params }),
  create: (data)   => api.post('/sales/', data),
  get:    (id)     => api.get(`/sales/${id}/`),
}

export const customersAPI = {
  list:   (params) => api.get('/customers/', { params }),
  get:    (id)     => api.get(`/customers/${id}/`),
  create: (data)   => api.post('/customers/', data),
  update: (id, d)  => api.patch(`/customers/${id}/`, d),
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
  list:   (params) => api.get('/jobcards/', { params }),
  get:    (id)     => api.get(`/jobcards/${id}/`),
  create: (data)   => api.post('/jobcards/', data),
  update: (id, d)  => api.patch(`/jobcards/${id}/`, d),
  pay:    (id, d)  => api.post(`/jobcards/${id}/payment/`, d),
}

export const branchesAPI = {
  list: () => api.get('/branches/'),
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

