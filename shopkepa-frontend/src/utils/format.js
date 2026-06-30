// Always format money through these — never raw JS floats on currency

export const formatNaira = (amount) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '₦0.00'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export const formatNairaShort = (amount) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '₦0'
  if (num >= 1_000_000) return `₦${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)     return `₦${(num / 1_000).toFixed(1)}k`
  return `₦${num.toFixed(0)}`
}

export const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(dateStr))
}

export const formatTime = (dateStr) => {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-NG', {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  return `${formatDate(dateStr)}, ${formatTime(dateStr)}`
}

export const parseApiError = (error) => {
  if (error?.retryAfter) {
    return `Too many attempts. Try again in ${error.retryAfter} seconds.`
  }
  const data = error?.response?.data
  if (!data) return 'Could not reach the server. Check your connection and try again.'
  if (typeof data === 'string')   return data
  if (data.detail)                return data.detail
  if (data.error)                 return data.error
  if (data.non_field_errors)      return Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors
  const first = Object.values(data)[0]
  if (Array.isArray(first))       return first[0]
  if (typeof first === 'string')  return first
  return 'Something went wrong. Please try again.'
}
