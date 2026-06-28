import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

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

// Attach access token to every request
api.interceptors.request.use((config) => {
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

    // 401 and not a retry → try refresh
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      // Deduplicate concurrent refresh calls
      if (!_refreshPromise) {
        _refreshPromise = axios
          .post(`${BASE_URL}/api/v1/auth/token/refresh/`, {}, { withCredentials: true })
          .then((res) => {
            setAccessToken(res.data.access)
            return res.data.access
          })
          .catch((err) => {
            clearAccessToken()
            window.dispatchEvent(new Event('auth:logout'))
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
  login:   (data) => api.post('/api/v1/auth/login/', data),
  logout:  ()     => api.post('/api/v1/auth/logout/'),
  me:      ()     => api.get('/api/v1/auth/me/'),
  refresh: ()     => api.post('/api/v1/auth/token/refresh/'),
}

export const productsAPI = {
  list:         (params) => api.get('/api/v1/products/', { params }),
  get:          (id)     => api.get(`/api/v1/products/${id}/`),
  create:       (data)   => api.post('/api/v1/products/', data),
  update:       (id, d)  => api.patch(`/api/v1/products/${id}/`, d),
  delete:       (id)     => api.delete(`/api/v1/products/${id}/`),
  stockHistory: (id)     => api.get(`/api/v1/products/${id}/stock-history/`),
}

export const salesAPI = {
  list:   (params) => api.get('/api/v1/sales/', { params }),
  create: (data)   => api.post('/api/v1/sales/', data),
  get:    (id)     => api.get(`/api/v1/sales/${id}/`),
}

export const customersAPI = {
  list:   (params) => api.get('/api/v1/customers/', { params }),
  get:    (id)     => api.get(`/api/v1/customers/${id}/`),
  create: (data)   => api.post('/api/v1/customers/', data),
  update: (id, d)  => api.patch(`/api/v1/customers/${id}/`, d),
}

export const reportsAPI = {
  dashboard: (params) => api.get('/api/v1/reports/dashboard/', { params }),
  branch:    (params) => api.get('/api/v1/reports/branch/', { params }),
  debtor:    (params) => api.get('/api/v1/reports/debtors/', { params }),
  expense:   (params) => api.get('/api/v1/reports/expenses/', { params }),
}

export const jobCardsAPI = {
  list:   (params) => api.get('/api/v1/job-cards/', { params }),
  get:    (id)     => api.get(`/api/v1/job-cards/${id}/`),
  create: (data)   => api.post('/api/v1/job-cards/', data),
  update: (id, d)  => api.patch(`/api/v1/job-cards/${id}/`, d),
}

export const branchesAPI = {
  list: () => api.get('/api/v1/branches/'),
}

export const healthAPI = {
  ping: () => api.get('/health/', { timeout: 3000 }),
}
