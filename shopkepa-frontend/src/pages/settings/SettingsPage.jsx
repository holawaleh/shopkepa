import { useState, useEffect, useCallback } from 'react'
import {
  ToggleLeft, ToggleRight, AlertCircle,
  Plus, X, Trash2, UserCheck, UserX, Eye, EyeOff, Edit2,
  GitBranch, Building2,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { modulesAPI, staffAPI, branchesAPI, businessAPI, authAPI } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
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
  const toast = useToast()
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

  const MAX_MODULES = 2
  const activeCount = businessModules.filter(bm => bm.is_active).length

  const handleToggle = async (mod) => {
    const bm = getBM(mod.id)
    const willActivate = !bm || !bm.is_active

    if (willActivate && activeCount >= MAX_MODULES) {
      setError(`You can only have ${MAX_MODULES} modules active at a time. Deactivate one first.`)
      return
    }

    setError('')
    setToggling(t => ({ ...t, [mod.id]: true }))
    try {
      if (!bm) {
        await modulesAPI.activate([mod.id])
      } else {
        // Pass module.id (Module UUID), not bm.id (BusinessModule UUID)
        await modulesAPI.toggle(mod.id, !bm.is_active)
      }
      await Promise.all([load(), reloadModules()])
      if (willActivate) {
        toast.success(`${mod.name} module activated`)
      } else {
        toast.info(`${mod.name} module deactivated`)
      }
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setToggling(t => ({ ...t, [mod.id]: false }))
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Activate the modules your business needs.{' '}
          <span style={{ color: activeCount >= MAX_MODULES ? 'var(--error)' : 'var(--gold)' }}>
            {!loading && `${activeCount} / ${MAX_MODULES} active`}
          </span>
          {activeCount >= MAX_MODULES && !loading && (
            <span style={{ color: 'var(--muted)', marginLeft: 6 }}>— Deactivate one to switch.</span>
          )}
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
  owner:   { bg: 'rgba(201,168,76,0.15)', text: 'var(--gold)',    label: 'Owner' },
  admin:   { bg: 'rgba(100,120,200,0.15)', text: '#7090e0',       label: 'Admin' },
  manager: { bg: 'rgba(76,175,125,0.15)', text: 'var(--success)', label: 'Manager' },
  cashier: { bg: 'rgba(150,150,150,0.12)', text: 'var(--muted)',  label: 'Cashier / IT Officer / Tech Officer' },
}

const EMPTY_STAFF = {
  full_name: '', username: '', email: '', phone_number: '',
  password: '', role: 'cashier', branch_ids: [],
}

function TeamTab() {
  const { isOwner, user } = useAuth()
  const toast = useToast()
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
    const [staffRes, branchRes] = await Promise.allSettled([
      staffAPI.list(),
      branchesAPI.list(),
    ])
    if (staffRes.status === 'fulfilled') {
      const sr = staffRes.value.data
      setStaff(Array.isArray(sr) ? sr : (sr.results ?? []))
    } else {
      setError(parseApiError(staffRes.reason))
    }
    if (branchRes.status === 'fulfilled') {
      const br = branchRes.value.data
      setBranches(Array.isArray(br) ? br : (br.results ?? []))
    }
    setLoading(false)
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
      toast.success(`${form.full_name.trim()} added to your team as ${ROLE_STYLE[form.role]?.label ?? form.role}`)
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
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: rs.bg, color: rs.text,
                      }}>
                        {rs.label}
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
                  <option value="cashier">Cashier / IT Officer / Tech Officer</option>
                  <option value="manager">Manager</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, display: 'block' }}>
                  {form.role === 'manager' ? 'Can view reports, manage products & customers.' : 'Can process sales, view customers, and manage job cards.'}
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

// ─── Branches tab ──────────────────────────────────────────────────────────

function BranchesTab() {
  const { isOwner } = useAuth()
  const toast = useToast()
  const [branches, setBranches] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(null) // 'add' | 'edit'
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState({ name: '', address: '' })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await branchesAPI.list()
      const raw = res.data
      setBranches(Array.isArray(raw) ? raw : (raw.results ?? []))
    } catch (err) { setError(parseApiError(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm({ name: '', address: '' }); setEditing(null); setError(''); setModal('add')
  }
  const openEdit = (b) => {
    setForm({ name: b.name, address: b.address || '' }); setEditing(b); setError(''); setModal('edit')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Branch name is required.'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'add') {
        await branchesAPI.create({ name: form.name.trim(), address: form.address.trim() })
        toast.success(`Branch "${form.name.trim()}" created`)
      } else {
        await branchesAPI.update(editing.id, { name: form.name.trim(), address: form.address.trim() })
        toast.success(`Branch "${form.name.trim()}" updated`)
      }
      setModal(null); load()
    } catch (err) { setError(parseApiError(err)) }
    finally { setSaving(false) }
  }

  const handleDelete = async (b) => {
    if (b.is_main_branch) { toast.error('Cannot delete the main branch.'); return }
    if (!window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return
    try {
      await branchesAPI.delete(b.id)
      toast.info(`Branch "${b.name}" deleted`)
      load()
    } catch (err) { toast.error(parseApiError(err)) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Manage your business locations and branches.</p>
        {isOwner && (
          <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
            <Plus size={14} /> Add Branch
          </button>
        )}
      </div>
      <ErrorBanner msg={error} />
      <div style={{ background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                {['Branch Name', 'Address', 'Type', ...(isOwner ? [''] : [])].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branches.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--mid)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GitBranch size={14} color="var(--muted)" />
                      <span style={{ color: 'var(--light)', fontWeight: 500 }}>{b.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{b.address || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {b.is_main_branch ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(201,168,76,0.15)', color: 'var(--gold)' }}>Main</span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(150,150,150,0.12)', color: 'var(--muted)' }}>Branch</span>
                    )}
                  </td>
                  {isOwner && (
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openEdit(b)} className="btn-ghost" style={{ padding: '4px 8px' }} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        {!b.is_main_branch && (
                          <button onClick={() => handleDelete(b)} className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--error)' }} title="Delete">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Branch' : 'Edit Branch'} onClose={() => setModal(null)}>
          <ErrorBanner msg={error} />
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Branch name *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ikeja Branch" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Address (optional)</label>
              <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g. 12 Allen Avenue, Ikeja" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>
                {saving ? 'Saving…' : modal === 'add' ? 'Create Branch' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─── Business profile tab ──────────────────────────────────────────────────

function BusinessTab() {
  const { isOwner } = useAuth()
  const toast = useToast()

  const [profile, setProfile]     = useState(null)
  const [settings, setSettings]   = useState(null)
  const [sub, setSub]             = useState(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [savingSet, setSavingSet] = useState(false)
  const [error, setError]         = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [profileForm, setProfileForm] = useState({ name: '', owner_name: '', phone_number: '', email: '', address: '' })
  const [settingsForm, setSettingsForm] = useState({
    custom_pricing_enabled: false,
    low_stock_alert_enabled: true,
    expiry_alert_days: 30,
    receipt_footer_message: '',
    currency_symbol: '₦',
    loyalty_bronze_threshold: '',
    loyalty_silver_threshold: '',
    loyalty_gold_threshold: '',
  })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [pRes, sRes, subRes] = await Promise.allSettled([
        businessAPI.getProfile(),
        businessAPI.getSettings(),
        businessAPI.getSubscription(),
      ])
      if (pRes.status === 'fulfilled') {
        const p = pRes.value.data
        setProfile(p)
        setProfileForm({
          name: p.name || '', owner_name: p.owner_name || '',
          phone_number: p.phone_number || '', email: p.email || '', address: p.address || '',
        })
      }
      if (sRes.status === 'fulfilled') {
        const s = sRes.value.data
        setSettings(s)
        setSettingsForm({
          custom_pricing_enabled:  s.custom_pricing_enabled,
          low_stock_alert_enabled: s.low_stock_alert_enabled,
          expiry_alert_days:       s.expiry_alert_days,
          receipt_footer_message:  s.receipt_footer_message || '',
          currency_symbol:         s.currency_symbol || '₦',
          loyalty_bronze_threshold: s.loyalty_bronze_threshold || '',
          loyalty_silver_threshold: s.loyalty_silver_threshold || '',
          loyalty_gold_threshold:   s.loyalty_gold_threshold   || '',
        })
      }
      if (subRes.status === 'fulfilled') setSub(subRes.value.data)
    } catch (err) { setError(parseApiError(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError(''); setSuccessMsg('')
    try {
      await businessAPI.updateProfile(profileForm)
      toast.success('Business profile updated')
      setSuccessMsg('Profile saved.')
      load()
    } catch (err) { setError(parseApiError(err)) }
    finally { setSaving(false) }
  }

  const handleSettingsSave = async (e) => {
    e.preventDefault()
    setSavingSet(true); setError(''); setSuccessMsg('')
    try {
      const payload = {
        ...settingsForm,
        expiry_alert_days:        parseInt(settingsForm.expiry_alert_days, 10) || 30,
        loyalty_bronze_threshold: settingsForm.loyalty_bronze_threshold || undefined,
        loyalty_silver_threshold: settingsForm.loyalty_silver_threshold || undefined,
        loyalty_gold_threshold:   settingsForm.loyalty_gold_threshold   || undefined,
      }
      await businessAPI.updateSettings(payload)
      toast.success('Business settings updated')
      setSuccessMsg('Settings saved.')
      load()
    } catch (err) { setError(parseApiError(err)) }
    finally { setSavingSet(false) }
  }

  const sp = (field) => (e) => setProfileForm(f => ({ ...f, [field]: e.target.value }))
  const ss = (field) => (e) => setSettingsForm(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  if (loading) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 600 }}>
      <ErrorBanner msg={error} />
      {successMsg && (
        <div style={{ background: 'rgba(76,175,125,0.12)', border: '1px solid rgba(76,175,125,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--success)' }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Subscription badge */}
      {sub && (
        <div style={{ background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Subscription</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--gold)', textTransform: 'capitalize' }}>
              {sub.subscription_tier || 'Free'} Plan
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              AI queries: {sub.ai_queries_used ?? 0} / {sub.ai_queries_limit ?? 0}
            </div>
            {sub.subscription_expires_at && (
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Expires: {formatDate(sub.subscription_expires_at)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Business profile */}
      <div style={{ background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Building2 size={16} color="var(--gold)" />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--light)', margin: 0 }}>Business Profile</h3>
        </div>
        <form onSubmit={handleProfileSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Business name</label>
              <input className="input" value={profileForm.name} onChange={sp('name')} disabled={!isOwner} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Owner name</label>
              <input className="input" value={profileForm.owner_name} onChange={sp('owner_name')} disabled={!isOwner} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Phone number</label>
              <input className="input" value={profileForm.phone_number} onChange={sp('phone_number')} disabled={!isOwner} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Email</label>
              <input className="input" type="email" value={profileForm.email} onChange={sp('email')} disabled={!isOwner} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Address</label>
            <input className="input" value={profileForm.address} onChange={sp('address')} disabled={!isOwner} placeholder="Business address" />
          </div>
          {isOwner && (
            <button type="submit" className="btn-gold" style={{ alignSelf: 'flex-start', padding: '8px 24px' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          )}
        </form>
      </div>

      {/* Business settings */}
      {isOwner && (
        <div style={{ background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 10, padding: '20px 24px' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--light)', marginBottom: 20 }}>Business Settings</h3>
          <form onSubmit={handleSettingsSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Toggles */}
            {[
              { field: 'custom_pricing_enabled',  label: 'Custom pricing (per-sale price editing)' },
              { field: 'low_stock_alert_enabled', label: 'Low stock alerts on dashboard' },
            ].map(({ field, label }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
                <span style={{ fontSize: 13, color: 'var(--light)' }}>{label}</span>
                <input type="checkbox" checked={!!settingsForm[field]} onChange={ss(field)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              </label>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Expiry alert (days before)</label>
                <input className="input" type="number" min="1" max="365"
                  value={settingsForm.expiry_alert_days} onChange={ss('expiry_alert_days')} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Currency symbol</label>
                <input className="input" maxLength={5} value={settingsForm.currency_symbol} onChange={ss('currency_symbol')} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Loyalty thresholds (lifetime spend ₦)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { field: 'loyalty_bronze_threshold', label: '🥉 Bronze' },
                  { field: 'loyalty_silver_threshold', label: '🥈 Silver' },
                  { field: 'loyalty_gold_threshold',   label: '🥇 Gold' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input className="input" type="number" min="0" placeholder="e.g. 50000"
                      value={settingsForm[field]} onChange={ss(field)} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Receipt footer message</label>
              <input className="input" placeholder="e.g. Thank you for shopping with us!"
                value={settingsForm.receipt_footer_message} onChange={ss('receipt_footer_message')} />
            </div>

            <button type="submit" className="btn-gold" style={{ alignSelf: 'flex-start', padding: '8px 24px' }} disabled={savingSet}>
              {savingSet ? 'Saving…' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

const TABS = [
  { id: 'business',  label: 'Business' },
  { id: 'branches',  label: 'Branches' },
  { id: 'modules',   label: 'Modules' },
  { id: 'team',      label: 'Team' },
  { id: 'security',  label: 'Security' },
]

export default function SettingsPage() {
  const [tab, setTab] = useState('business')

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)', marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Manage your business profile, branches, modules, team, and account security.
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

      {tab === 'business'  && <BusinessTab />}
      {tab === 'branches'  && <BranchesTab />}
      {tab === 'modules'   && <ModulesTab />}
      {tab === 'team'      && <TeamTab />}
      {tab === 'security'  && <ChangePasswordTab />}
    </AppLayout>
  )
}
