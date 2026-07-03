// Always format money through these helpers. Do not use raw JS floats for currency.

export const formatNaira = (amount) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return 'NGN 0.00'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export const formatNairaShort = (amount) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return 'NGN 0'
  if (num >= 1_000_000) return `NGN ${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `NGN ${(num / 1_000).toFixed(1)}k`
  return `NGN ${num.toFixed(0)}`
}

export const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr))
}

export const formatTime = (dateStr) => {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('en-NG', {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  return `${formatDate(dateStr)}, ${formatTime(dateStr)}`
}

const HTTP_STATUS_MESSAGES = {
  400: 'Invalid request. Please check your input.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'The requested item was not found.',
  409: 'A conflict occurred. This item may already exist.',
  422: 'The submitted data is invalid. Please check the form.',
  500: 'A server error occurred. Please try again later.',
  502: 'The server is temporarily unreachable. Please try again.',
  503: 'Service unavailable. Please try again shortly.',
}

export const parseApiError = (error) => {
  if (error?.retryAfter) {
    return `Too many attempts. Try again in ${error.retryAfter} seconds.`
  }

  const status = error?.response?.status
  const data   = error?.response?.data

  // No response at all means a network failure.
  if (!data && !status) return 'Could not reach the server. Check your connection and try again.'

  // Try to get a meaningful message from the response body first.
  if (data) {
    if (typeof data === 'string')  return data
    if (data.detail)               return data.detail
    if (data.error)                return data.error
    if (data.message)              return data.message
    if (data.non_field_errors)     return Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors
    const first = Object.values(data)[0]
    if (Array.isArray(first) && first.length > 0 && typeof first[0] === 'string') return first[0]
    if (typeof first === 'string') return first
  }

  // Fall back to HTTP status message.
  if (status && HTTP_STATUS_MESSAGES[status]) return HTTP_STATUS_MESSAGES[status]

  return 'Something went wrong. Please try again.'
}
