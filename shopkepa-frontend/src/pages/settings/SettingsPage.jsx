import { useState, useEffect, useCallback } from 'react'
import {
  ToggleLeft, ToggleRight, AlertCircle,
  Plus, X, Trash2, UserCheck, UserX, Eye, EyeOff,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { modulesAPI, staffAPI, branchesAPI, authAPI } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { parseApiError, formatDate } from '../../utils/format'

// ─── Shared helpers ────────────────────────────────────────────────────────

function Modal({ title, onClose, children, maxWidth = 480 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 16,
    }}>
      <div style={{
        background: 'var(--blue)', border: '1px solid var(--mid)',
        borderRadius: 12, padding: 24, width: '100%', maxWidth,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--light)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorBanner({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
      borderRadius: 'var(--r-sm)', padding: '10px 14px',
      display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
    }}>
      <AlertCircle size={14} color="var(--error)" />
      <span style={{ fontSize: 13, color: 'var(--error)' }}>{msg}</span>
    </div>
  )
}

// ─── Module icons ──────────────────────────────────────────────────────────

const MODULE_ICONS = {
  general_trade:      '🛒',
  fashion:            '👗',
  electronics:        '📱',
  food:               '🥦',
  pharmacy:           '💊',
  building_materials: '🧱',
  stationery:         '✏️',
  technical_services: '🔧',
  hotel:              '🏨',
}
function icon(code) { return MODULE_ICONS[code?.toLowerCase()] || '📦' }

// ─── Modules tab ──────────────────────────────────────────────────────────

function ModulesTab() {
  const { reloadModules } = useAuth()
  const [allModules, setAllModules]       = useState([])
  const [businessModules, setBusinessModules] = useState([])
  const [loading, setLoading]             = useState(true)
  const [toggling, setToggling]           = useState({})
  const [error, setError]                 = useState('')

  const load = useCallback(async () => {
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
  }, [])

  useEffect(() => { load() }, [load])

  const getBM = (moduleId) => businessModules.find(bm => bm.module.id === moduleId)
  const isActive = (moduleId) => { const bm = getBM(moduleId); return bm ? bm.is_active : false }

  const handleToggle = async (mod) => {
    const bm = getBM(mod.id)
    setToggling(t => ({ ...t, [mod.id]: true }))
    try {
      if (!bm) {
        await modulesAPI.activate([mod.id])
      } else {
        await modulesAPI.toggle(bm.id, !bm.is_active)
      }
      await Promise.all([load(), reloadModules()])
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setToggling(t => ({ ...t, [mod.id]: false }))
    }
  }

  const activeCount = businessModules.filter(bm => bm.is_active).length

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Activate only the modules your business needs.
          {!loading && <span style={{ color: 'var(--gold)', marginLeft: 6 }}>{activeCount} active</span>}
        </p>
      </div>
      <ErrorBanner msg={error} />
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {allModules.map(mod => {
            const active = isActive(mod.id)
            const isBusy = toggling[mod.id]
            return (
              <div key={mod.id} style={{
                background: active ? 'rgba(201,168,76,0.07)' : 'var(--navy)',
                border: `1px solid ${active ? 'rgba(201,168,76,0.3)' : 'var(--mid)'}`,
                borderRadius: 8, padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, transition: 'border-color 0.2s, background 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span style={{ fontSize: 22 }}>{icon(mod.code)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: active ? 'var(--gold)' : 'var(--light)' }}>
                      {mod.name}
                    </div>
                    {mod.description && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mod.description}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => handleToggle(mod)} disabled={isBusy}
                  style={{ background: 'none', border: 'none', cursor: isBusy ? 'wait' : 'pointer', flexShrink: 0, padding: 0, opacity: isBusy ? 0.5 : 1, display: 'flex' }}>
                  {active
                    ? <ToggleRight size={28} color="var(--gold)" />
                    : <ToggleLeft  size={28} color="var(--muted)" />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Team tab ─────────────────────────────────────────────────────────────

const ROLE_STYLE = {
  owner:   { bg: 'rgba(201,168,76,0.15)', text: 'var(--gold)' },
  admin:   { bg: 'rgba(100,120,200,0.15)', text: '#7090e0' },
  manager: { bg: 'rgba(76,175,125,0.15)', text: 'var(--success)' },
  cashier: { bg: 'rgba(150,150,150,0.12)', text: 'var(--muted)' },
}

const EMPTY_STAFF = {
  full_name: '', username: '', email: '', phone_number: '',
  password: '', role: 'cashier', branch_ids: [],
}

function TeamTab() {
  const { isOwner, user } = useAuth()
  const [staff, setStaff]           = useState([])
  const [branches, setBranches]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null)
  const [form, setForm]             = useState(EMPTY_STAFF)
  const [showPw, setShowPw]         = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [staffRes, branchRes] = await Promise.all([
        staffAPI.list(),
        branchesAPI.list(),
      ])
      const sr = staffRes.data
      const br = branchRes.data
      setStaff(Array.isArray(sr) ? sr : (sr.results ?? []))
      setBranches(Array.isArray(br) ? br : (br.results ?? []))
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setFormErrors(fe => ({ ...fe, [field]: '' }))
  }

  const toggleBranch = (id) => {
    setForm(f => ({
      ...f,
      branch_ids: f.branch_ids.includes(id)
        ? f.branch_ids.filter(b => b !== id)
        : [...f.branch_ids, id],
    }))
  }

  const validate = () => {
    const e = {}
    if (!form.full_name.trim())   e.full_name   = 'Full name required'
    if (!form.username.trim())    e.username    = 'Username required'
    if (!form.phone_number.trim()) e.phone_number = 'Phone number required'
    if (!form.password)           e.password    = 'Password required'
    if (form.password.length < 6) e.password    = 'Min. 6 characters'
    if (form.branch_ids.length === 0) e.branch_ids = 'Assign at least one branch'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      await staffAPI.create({
        full_name:    form.full_name.trim(),
        username:     form.username.trim().toLowerCase(),
        email:        form.email.trim(),
        phone_number: form.phone_number.trim(),
        password:     form.password,
        role:         form.role,
        branch_ids:   form.branch_ids,
      })
      setModal(null)
      load()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (member) => {
    if (!isOwner) return
    try {
      await staffAPI.toggle(member.id, !member.is_active)
      load()
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  const handleDelete = async (member) => {
    if (!isOwner) return
    if (!confirm(`Remove ${member.full_name} from your team? This cannot be undone.`)) return
    try {
      await staffAPI.delete(member.id)
      load()
    } catch (err) {
      setError(parseApiError(err))
    }
  }

  const openAdd = () => {
    setForm({ ...EMPTY_STAFF, branch_ids: branches.length === 1 ? [branches[0].id] : [] })
    setFormErrors({})
    setError('')
    setShowPw(false)
    setModal('add')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Manage who can access your ShopKepa account.
        </p>
        {isOwner && (
          <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
            <Plus size={14} /> Add Staff
          </button>
        )}
      </div>

      <ErrorBanner msg={error} />

      <div style={{ background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : staff.length === 0 ? (
          <p style={{ padding: 32, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
            No staff added yet. Only the business owner has access.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                {['Name', 'Username', 'Role', 'Branches', 'Status', 'Added', ...(isOwner ? [''] : [])].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(m => {
                const rs = ROLE_STYLE[m.role] || ROLE_STYLE.cashier
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--mid)', opacity: m.is_active ? 1 : 0.5 }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ color: 'var(--light)', fontWeight: 500 }}>{m.full_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.phone_number}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                      @{m.username}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                        background: rs.bg, color: rs.text,
                      }}>
                        {m.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>
                      {m.branches?.map(b => b.name).join(', ') || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: m.is_active ? 'rgba(76,175,125,0.12)' : 'rgba(224,85,85,0.12)',
                        color: m.is_active ? 'var(--success)' : 'var(--error)',
                      }}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                      {formatDate(m.created_at)}
                    </td>
                    {isOwner && (
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleToggleActive(m)}
                            className="btn-ghost"
                            style={{ padding: '4px 8px' }}
                            title={m.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {m.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>
                          <button
                            onClick={() => handleDelete(m)}
                            className="btn-ghost"
                            style={{ padding: '4px 8px', color: 'var(--error)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal === 'add' && (
        <Modal title="Add Staff Member" onClose={() => setModal(null)}>
          <ErrorBanner msg={error} />
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Full name *</label>
                <input className={`input ${formErrors.full_name ? 'input-error' : ''}`}
                  value={form.full_name} onChange={set('full_name')} placeholder="Full name" />
                {formErrors.full_name && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.full_name}</span>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Username *</label>
                <input className={`input ${formErrors.username ? 'input-error' : ''}`}
                  value={form.username} onChange={set('username')} placeholder="e.g. john_cashier" />
                {formErrors.username && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.username}</span>}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Phone number *</label>
                <input className={`input ${formErrors.phone_number ? 'input-error' : ''}`}
                  type="tel" value={form.phone_number} onChange={set('phone_number')} placeholder="08012345678" />
                {formErrors.phone_number && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.phone_number}</span>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Email</label>
                <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="optional" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Role *</label>
                <select className="input" value={form.role} onChange={set('role')}>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, display: 'block' }}>
                  {form.role === 'manager' ? 'Can view reports, manage products & customers.' : 'Can process sales and view customers.'}
                </span>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className={`input ${formErrors.password ? 'input-error' : ''}`}
                    type={showPw ? 'text' : 'password'}
                    value={form.password} onChange={set('password')}
                    placeholder="Min. 6 characters"
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {formErrors.password && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.password}</span>}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Assign to branch(es) *
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {branches.map(b => {
                  const sel = form.branch_ids.includes(b.id)
                  return (
                    <button key={b.id} type="button" onClick={() => toggleBranch(b.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        border: `1px solid ${sel ? 'rgba(201,168,76,0.4)' : 'var(--mid)'}`,
                        background: sel ? 'var(--gold-dim)' : 'var(--navy)',
                        color: sel ? 'var(--gold)' : 'var(--muted)',
                        fontWeight: sel ? 500 : 400,
                      }}>
                      {b.name}
                    </button>
                  )
                })}
              </div>
              {formErrors.branch_ids && (
                <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 4, display: 'block' }}>{formErrors.branch_ids}</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>
                {saving ? 'Creating…' : 'Add Staff Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Main SettingsPage ─────────────────────────────────────────────────────

// ─── Change Password tab ───────────────────────────────────────────────────

function ChangePasswordTab() {
  const { user } = useAuth()
  const [form, setForm]       = useState({ current_password: '', new_password: '', confirm: '' })
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const set = f => e => { setForm(p => ({ ...p, [f]: e.target.value })); setError(''); setSuccess('') }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.current_password) { setError('Enter your current password.'); return }
    if (form.new_password.length < 8) { setError('New password must be at least 8 characters.'); return }
    if (form.new_password !== form.confirm) { setError('New passwords do not match.'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password })
      setSuccess('Password changed successfully.')
      setForm({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const strength = [
    form.new_password.length >= 8,
    /[A-Z]/.test(form.new_password),
    /[0-9]/.test(form.new_password),
    /[^A-Za-z0-9]/.test(form.new_password),
  ].filter(Boolean).length

  return (
    <div style={{ maxWidth: 440 }}>
      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '16px 20px', marginBottom: 24, fontSize: 13 }}>
        <div style={{ color: 'var(--muted)', marginBottom: 2 }}>Signed in as</div>
        <div style={{ color: 'var(--light)', fontWeight: 500 }}>{user?.first_name} {user?.last_name}</div>
        <div style={{ color: 'var(--muted)', fontSize: 12 }}>{user?.email}</div>
      </div>

      {error && (
        <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <AlertCircle size={14} color="var(--error)" />
          <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(76,175,125,0.12)', border: '1px solid rgba(76,175,125,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--success)', marginBottom: 16 }}>
          ✓ {success}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Current password</label>
          <div style={{ position: 'relative' }}>
            <input type={showCur ? 'text' : 'password'} className="input" value={form.current_password} onChange={set('current_password')} placeholder="••••••••" style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowCur(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
              {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>New password</label>
          <div style={{ position: 'relative' }}>
            <input type={showNew ? 'text' : 'password'} className="input" value={form.new_password} onChange={set('new_password')} placeholder="Min. 8 characters" style={{ paddingRight: 44 }} />
            <button type="button" onClick={() => setShowNew(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {form.new_password && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1,2,3,4].map(n => (
                  <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= strength ? (strength <= 1 ? 'var(--error)' : strength <= 2 ? 'var(--warning)' : 'var(--success)') : 'var(--mid)', transition: 'background 0.2s' }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{['', 'Weak', 'Fair', 'Good', 'Strong'][strength]}</span>
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Confirm new password</label>
          <input type="password" className={`input ${form.confirm && form.confirm !== form.new_password ? 'input-error' : ''}`} value={form.confirm} onChange={set('confirm')} placeholder="Repeat new password" />
          {form.confirm && form.confirm !== form.new_password && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>Passwords do not match</span>}
        </div>

        <button type="submit" className="btn-gold" disabled={saving} style={{ marginTop: 4 }}>
          {saving ? 'Changing password…' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}

const TABS = [
  { id: 'modules',  label: 'Modules' },
  { id: 'team',     label: 'Team' },
  { id: 'security', label: 'Security' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('modules')

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)', marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Manage your modules, team members, and account security.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--mid)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--gold)' : 'var(--muted)',
              borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'color 0.15s, border-color 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'modules'  && <ModulesTab />}
      {tab === 'team'     && <TeamTab />}
      {tab === 'security' && <ChangePasswordTab />}
    </AppLayout>
  )
}
