// One key per *logical* action (this checkout, this payment) - generated when
// the form opens and reused for every submit attempt of it, so a double-tap
// or a retry after a dropped connection is recognised server-side as the
// same action and never recorded twice. Make a fresh key once it succeeds.
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for older WebViews without crypto.randomUUID
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export const withIdempotencyKey = (key) => (key ? { headers: { 'Idempotency-Key': key } } : undefined)
