import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { modulesAPI } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { parseApiError } from '../../utils/format'

const MODULE_ICONS = {
  general_trade:      { emoji: '🛒', label: 'General Trade / Provision' },
  fashion:            { emoji: '👗', label: 'Fashion & Clothing' },
  electronics:        { emoji: '📱', label: 'Electronics & Gadgets' },
  food:               { emoji: '🥦', label: 'Food & Groceries' },
  pharmacy:           { emoji: '💊', label: 'Pharmacy / Chemist' },
  building_materials: { emoji: '🧱', label: 'Building Materials' },
  stationery:         { emoji: '✏️', label: 'Stationery & School Supplies' },
  technical_services: { emoji: '🔧', label: 'Technical Services / Repairs' },
  hotel:              { emoji: '🏨', label: 'Hotel & Tourism' },
}

export default function OnboardingPage() {
  const { reloadModules, defaultRoute, user, hasModules } = useAuth()
  const navigate = useNavigate()

  const [allModules, setAllModules]   = useState([])
  const [selected, setSelected]       = useState(new Set())
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  // Navigate away once modules exist — fires both on initial mount (existing user)
  // and after handleStart → reloadModules() flips hasModules to true.
  useEffect(() => {
    if (hasModules) navigate(defaultRoute(), { replace: true })
  }, [hasModules, navigate, defaultRoute])

  useEffect(() => {
    modulesAPI.list()
      .then(res => {
        const raw = res.data
        setAllModules(Array.isArray(raw) ? raw : (raw.results ?? []))
      })
      .catch(() => setError('Could not load modules. Check your connection.'))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id) => {
    setSelected(s => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleStart = async () => {
    if (selected.size === 0) { setError('Please select at least one module to continue.'); return }
    setSaving(true)
    setError('')
    try {
      await modulesAPI.activate([...selected])
      // reloadModules() updates AuthContext state. Once hasModules flips to true,
      // the useEffect above handles the navigation — navigating here would race
      // ProtectedRoute before the state update commits.
      await reloadModules()
    } catch (err) {
      setError(parseApiError(err))
      setSaving(false)
    }
    // setSaving(false) intentionally omitted on success — the component unmounts
    // immediately after navigation so there's no state update on unmounted component.
  }

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--navy)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 16px',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40, maxWidth: 560 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)', letterSpacing: 0.5, marginBottom: 8 }}>
          ShopKepa
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--light)', marginBottom: 10 }}>
          Welcome{user?.first_name ? `, ${user.first_name}` : ''}! What kind of business do you run?
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
          Select one or more modules that match your business. This determines what features appear in your dashboard.
          You can change this anytime in Settings.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
          borderRadius: 8, padding: '10px 16px',
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, maxWidth: 600, width: '100%',
        }}>
          <AlertCircle size={14} color="var(--error)" />
          <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
        </div>
      )}

      {/* Module grid */}
      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading modules…</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12, width: '100%', maxWidth: 760, marginBottom: 32,
        }}>
          {allModules.map(mod => {
            const info = MODULE_ICONS[mod.code] || { emoji: '📦', label: mod.name }
            const isSelected = selected.has(mod.id)
            return (
              <button
                key={mod.id}
                onClick={() => toggle(mod.id)}
                style={{
                  background: isSelected ? 'rgba(201,168,76,0.08)' : 'var(--blue)',
                  border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--mid)'}`,
                  borderRadius: 10, padding: '18px 16px',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.15s, background 0.15s',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <span style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--gold)', color: 'var(--navy)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>✓</span>
                )}
                <div style={{ fontSize: 28, marginBottom: 8 }}>{info.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: isSelected ? 'var(--gold)' : 'var(--light)', marginBottom: 4 }}>
                  {mod.name}
                </div>
                {mod.description && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {mod.description}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleStart}
        disabled={saving || selected.size === 0}
        style={{
          padding: '14px 40px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          background: selected.size > 0 ? 'var(--gold)' : 'var(--mid)',
          color: selected.size > 0 ? 'var(--navy)' : 'var(--muted)',
          border: 'none', transition: 'background 0.2s, color 0.2s',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving
          ? 'Setting up…'
          : selected.size === 0
            ? 'Select at least one module'
            : `Start using ShopKepa with ${selected.size} module${selected.size > 1 ? 's' : ''} →`}
      </button>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 20, textAlign: 'center' }}>
        {selected.size > 0 && (
          <>You can add or remove modules later from <strong style={{ color: 'var(--light)' }}>Settings → Modules</strong>.</>
        )}
      </p>
    </div>
  )
}
