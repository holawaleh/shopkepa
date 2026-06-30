import { useState, useEffect } from 'react'
import { ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { modulesAPI } from '../../api/client'
import { parseApiError } from '../../utils/format'

const MODULE_ICONS = {
  pos:        '🛒',
  pharmacy:   '💊',
  restaurant: '🍽️',
  repairs:    '🔧',
  fashion:    '👗',
  electronics:'📱',
  grocery:    '🥦',
  salon:      '✂️',
}

function icon(code) {
  return MODULE_ICONS[code?.toLowerCase()] || '📦'
}

export default function SettingsPage() {
  const [allModules, setAllModules]       = useState([])
  const [businessModules, setBusinessModules] = useState([]) // [{id, module, is_active}]
  const [loading, setLoading]             = useState(true)
  const [toggling, setToggling]           = useState({}) // {moduleId: true}
  const [error, setError]                 = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [allRes, activeRes] = await Promise.all([
        modulesAPI.list(),
        modulesAPI.active(),
      ])
      setAllModules(allRes.data)
      setBusinessModules(activeRes.data)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }

  // Find business module record for a given module id
  const getBM = (moduleId) =>
    businessModules.find(bm => bm.module.id === moduleId)

  const isActive = (moduleId) => {
    const bm = getBM(moduleId)
    return bm ? bm.is_active : false
  }

  const handleToggle = async (mod) => {
    const bm = getBM(mod.id)
    setToggling(t => ({ ...t, [mod.id]: true }))
    try {
      if (!bm) {
        // Never activated — activate now
        await modulesAPI.activate([mod.id])
      } else {
        // Toggle existing
        await modulesAPI.toggle(bm.module.id, !bm.is_active)
      }
      await load()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setToggling(t => ({ ...t, [mod.id]: false }))
    }
  }

  const activeCount = businessModules.filter(bm => bm.is_active).length

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)', marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Manage your active modules and business configuration.
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
          borderRadius: 'var(--r-sm)', padding: '10px 14px',
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20,
        }}>
          <AlertCircle size={15} color="var(--error)" />
          <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
        </div>
      )}

      {/* Module management */}
      <div style={{
        background: 'var(--blue)', border: '1px solid var(--mid)',
        borderRadius: 10, padding: '20px 24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--light)', marginBottom: 2 }}>
              Modules
            </h2>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Activate only the modules your business needs.
              {!loading && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>{activeCount} active</span>}
            </p>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading modules…</p>
        ) : allModules.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>No modules available.</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}>
            {allModules.map(mod => {
              const active   = isActive(mod.id)
              const isBusy   = toggling[mod.id]
              return (
                <div
                  key={mod.id}
                  style={{
                    background: active ? 'rgba(201,168,76,0.07)' : 'var(--navy)',
                    border: `1px solid ${active ? 'rgba(201,168,76,0.3)' : 'var(--mid)'}`,
                    borderRadius: 8, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12, transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{ fontSize: 22 }}>{icon(mod.code)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 500,
                        color: active ? 'var(--gold)' : 'var(--light)',
                      }}>
                        {mod.name}
                      </div>
                      {mod.description && (
                        <div style={{
                          fontSize: 11, color: 'var(--muted)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {mod.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(mod)}
                    disabled={isBusy}
                    style={{
                      background: 'none', border: 'none', cursor: isBusy ? 'wait' : 'pointer',
                      flexShrink: 0, padding: 0, opacity: isBusy ? 0.5 : 1,
                      display: 'flex', alignItems: 'center',
                    }}
                    title={active ? 'Deactivate module' : 'Activate module'}
                  >
                    {active
                      ? <ToggleRight size={28} color="var(--gold)" />
                      : <ToggleLeft  size={28} color="var(--muted)" />
                    }
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
