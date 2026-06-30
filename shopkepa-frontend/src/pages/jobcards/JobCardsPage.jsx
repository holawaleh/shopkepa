import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, X, AlertCircle, Wrench, Printer, Trash2, Edit2 } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { jobCardsAPI, branchesAPI } from '../../api/client'
import { formatNaira, formatDate, parseApiError } from '../../utils/format'
import { printJobCardReceipt } from '../../utils/printDoc'
import { useAuth } from '../../context/AuthContext'

// ─── Services catalogue helpers (localStorage-backed) ─────────────────────

const DEFAULT_SERVICES = [
  { name: 'Screen Replacement',         device_type: 'Smartphone',     base_price: 15000, est_days: 1 },
  { name: 'Battery Replacement',        device_type: 'Smartphone',     base_price: 5000,  est_days: 1 },
  { name: 'Charging Port Repair',       device_type: 'Smartphone',     base_price: 5000,  est_days: 1 },
  { name: 'Speaker / Earpiece Repair',  device_type: 'Smartphone',     base_price: 4000,  est_days: 1 },
  { name: 'Software Flash / Unlock',    device_type: 'Smartphone',     base_price: 5000,  est_days: 1 },
  { name: 'Water Damage Treatment',     device_type: 'Smartphone',     base_price: 10000, est_days: 2 },
  { name: 'Camera Repair',              device_type: 'Smartphone',     base_price: 8000,  est_days: 1 },
  { name: 'Screen Replacement',         device_type: 'Laptop',         base_price: 35000, est_days: 2 },
  { name: 'Keyboard Replacement',       device_type: 'Laptop',         base_price: 20000, est_days: 1 },
  { name: 'Fan Cleaning & Servicing',   device_type: 'Laptop',         base_price: 8000,  est_days: 1 },
  { name: 'OS Installation',            device_type: 'Laptop',         base_price: 10000, est_days: 1 },
  { name: 'Battery Replacement',        device_type: 'Laptop',         base_price: 25000, est_days: 1 },
  { name: 'Motherboard Repair',         device_type: 'Laptop',         base_price: 50000, est_days: 5 },
  { name: 'Power Supply Repair',        device_type: 'TV',             base_price: 15000, est_days: 2 },
  { name: 'Screen / Panel Repair',      device_type: 'TV',             base_price: 40000, est_days: 3 },
  { name: 'Gas Refill (R22/R410)',      device_type: 'Air Conditioner',base_price: 20000, est_days: 1 },
  { name: 'PCB / Board Repair',         device_type: 'Air Conditioner',base_price: 30000, est_days: 3 },
  { name: 'Compressor Replacement',     device_type: 'Refrigerator',   base_price: 45000, est_days: 3 },
  { name: 'Gas Refill',                 device_type: 'Refrigerator',   base_price: 15000, est_days: 1 },
  { name: 'Full Service / Maintenance', device_type: 'Generator',      base_price: 15000, est_days: 1 },
  { name: 'Carburetor Cleaning',        device_type: 'Generator',      base_price: 8000,  est_days: 1 },
  { name: 'AVR Replacement',            device_type: 'Generator',      base_price: 20000, est_days: 2 },
]

function getServicesKey(userId) { return `sk_services_${userId}` }

function loadServices(userId) {
  try {
    const raw = localStorage.getItem(getServicesKey(userId))
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_SERVICES.map((s, i) => ({ ...s, id: `default_${i}` }))
}

function saveServices(userId, services) {
  try { localStorage.setItem(getServicesKey(userId), JSON.stringify(services)) } catch {}
}

// ─── Shared constants ─────────────────────────────────────────────────────

const STATUS_OPTS = [
  { value: '',           label: 'All' },
  { value: 'received',   label: 'Received' },
  { value: 'diagnosing', label: 'Diagnosing' },
  { value: 'repairing',  label: 'Repairing' },
  { value: 'ready',      label: 'Ready' },
  { value: 'collected',  label: 'Collected' },
]

const STATUS_STYLE = {
  received:   { bg: 'rgba(100,120,200,0.15)', text: '#7090e0' },
  diagnosing: { bg: 'rgba(255,165,0,0.15)',   text: 'orange' },
  repairing:  { bg: 'rgba(201,168,76,0.15)',  text: 'var(--gold)' },
  ready:      { bg: 'rgba(76,175,125,0.15)',  text: 'var(--success)' },
  collected:  { bg: 'rgba(100,100,100,0.15)', text: 'var(--muted)' },
}

const PAYMENT_STYLE = {
  unpaid:  { bg: 'rgba(224,85,85,0.12)',   text: 'var(--error)' },
  partial: { bg: 'rgba(255,165,0,0.12)',   text: 'orange' },
  paid:    { bg: 'rgba(76,175,125,0.12)',  text: 'var(--success)' },
}

const DEVICE_TYPES = [
  'Smartphone', 'Laptop', 'TV', 'Air Conditioner', 'Refrigerator',
  'Generator', 'Tablet', 'Desktop PC', 'Printer', 'Other',
]

const EMPTY_JOB = {
  customer_name: '', customer_phone: '', device_description: '',
  customer_complaint: '', labour_charge: '0', branch_id: '', service_id: '',
}

const EMPTY_SVC = { name: '', device_type: 'Smartphone', base_price: '', est_days: '1' }

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

function ErrBanner({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
      borderRadius: 8, padding: '10px 14px',
      display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
    }}>
      <AlertCircle size={14} color="var(--error)" />
      <span style={{ fontSize: 13, color: 'var(--error)' }}>{msg}</span>
    </div>
  )
}

// ─── Services tab ─────────────────────────────────────────────────────────

function ServicesTab({ userId, isOwner }) {
  const [services, setServices] = useState(() => loadServices(userId))
  const [modal, setModal]       = useState(null) // null | 'add' | 'edit'
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(EMPTY_SVC)

  const persist = (list) => { setServices(list); saveServices(userId, list) }

  const openAdd = () => { setForm(EMPTY_SVC); setEditing(null); setModal('svc') }
  const openEdit = (s) => { setForm({ name: s.name, device_type: s.device_type, base_price: String(s.base_price), est_days: String(s.est_days) }); setEditing(s); setModal('svc') }

  const handleSave = () => {
    if (!form.name.trim()) return
    const price = parseFloat(form.base_price) || 0
    const days  = parseInt(form.est_days, 10) || 1
    if (editing) {
      persist(services.map(s => s.id === editing.id ? { ...s, ...form, base_price: price, est_days: days } : s))
    } else {
      persist([...services, { id: `custom_${Date.now()}`, name: form.name.trim(), device_type: form.device_type, base_price: price, est_days: days }])
    }
    setModal(null)
  }

  const handleDelete = (id) => {
    if (!confirm('Remove this service from the catalogue?')) return
    persist(services.filter(s => s.id !== id))
  }

  // Group by device_type
  const grouped = {}
  services.forEach(s => {
    if (!grouped[s.device_type]) grouped[s.device_type] = []
    grouped[s.device_type].push(s)
  })

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Standard services and base prices for your repair shop. Pick a service when creating a job card to pre-fill the labour charge.
        </p>
        <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 16 }} onClick={openAdd}>
          <Plus size={14} /> Add Service
        </button>
      </div>

      {Object.entries(grouped).map(([deviceType, list]) => (
        <div key={deviceType} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            {deviceType}
          </div>
          <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 8, overflow: 'hidden' }}>
            {list.map((s, idx) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: idx < list.length - 1 ? '1px solid var(--mid)' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--light)', fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    Est. {s.est_days} day{s.est_days !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 600 }}>{formatNaira(s.base_price)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(s)} className="btn-ghost" style={{ padding: '3px 7px' }}><Edit2 size={12} /></button>
                    <button onClick={() => handleDelete(s.id)} className="btn-ghost" style={{ padding: '3px 7px', color: 'var(--error)' }}><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {modal === 'svc' && (
        <Modal title={editing ? 'Edit Service' : 'Add Service'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Service name *</label>
              <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Screen Replacement" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Device type</label>
                <select className="input" value={form.device_type} onChange={set('device_type')}>
                  {DEVICE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Base price (₦)</label>
                <input className="input" type="number" min="0" value={form.base_price} onChange={set('base_price')} placeholder="0" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Estimated turnaround (days)</label>
              <input className="input" type="number" min="1" value={form.est_days} onChange={set('est_days')} placeholder="1" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-gold" style={{ flex: 2 }} onClick={handleSave}>
                {editing ? 'Save Changes' : 'Add Service'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Job Cards tab ────────────────────────────────────────────────────────

function JobCardsTab({ branches, userId }) {
  const { user } = useAuth()
  const [jobs, setJobs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal]           = useState(null)
  const [selected, setSelected]     = useState(null)
  const [form, setForm]             = useState(EMPTY_JOB)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [newStatus, setNewStatus]   = useState('')
  const [payAmount, setPayAmount]   = useState('')
  const [payMethod, setPayMethod]   = useState('cash')

  const services = loadServices(userId)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await jobCardsAPI.list({ status: statusFilter || undefined })
      const raw = res.data
      setJobs(Array.isArray(raw) ? raw : (raw.results ?? []))
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm({ ...EMPTY_JOB, branch_id: branches[0]?.id || '' })
    setFormErrors({})
    setError('')
    setModal('add')
  }

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setFormErrors(fe => ({ ...fe, [field]: '' }))
  }

  // When a service is selected from dropdown, pre-fill device + labour
  const handleServicePick = (svcId) => {
    const svc = services.find(s => s.id === svcId)
    if (!svc) { setForm(f => ({ ...f, service_id: '' })); return }
    setForm(f => ({
      ...f,
      service_id:         svcId,
      device_description: f.device_description || svc.device_type,
      labour_charge:      String(svc.base_price),
    }))
  }

  const validate = () => {
    const e = {}
    if (!form.customer_name.trim())      e.customer_name      = 'Customer name is required'
    if (!form.device_description.trim()) e.device_description = 'Device description is required'
    if (!form.customer_complaint.trim()) e.customer_complaint = 'Describe the complaint'
    if (!form.branch_id)                 e.branch_id          = 'Select a branch'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      await jobCardsAPI.create({
        customer_name:      form.customer_name.trim(),
        customer_phone:     form.customer_phone.trim(),
        device_description: form.device_description.trim(),
        customer_complaint: form.customer_complaint.trim(),
        labour_charge:      parseFloat(form.labour_charge) || 0,
        branch_id:          form.branch_id,
      })
      setModal(null)
      load()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const openStatus = (job) => { setSelected(job); setNewStatus(job.status); setError(''); setModal('status') }

  const handleStatusUpdate = async () => {
    if (!newStatus || newStatus === selected.status) { setModal(null); return }
    setSaving(true); setError('')
    try {
      await jobCardsAPI.update(selected.id, { status: newStatus })
      setModal(null); load()
    } catch (err) { setError(parseApiError(err)) }
    finally { setSaving(false) }
  }

  const openPayment = (job) => { setSelected(job); setPayAmount(''); setPayMethod('cash'); setError(''); setModal('payment') }

  const handlePayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) { setError('Enter a valid payment amount.'); return }
    setSaving(true); setError('')
    try {
      await jobCardsAPI.pay(selected.id, { amount: parseFloat(payAmount), payment_method: payMethod })
      setModal(null); load()
    } catch (err) { setError(parseApiError(err)) }
    finally { setSaving(false) }
  }

  const filtered = jobs.filter(j =>
    !search ||
    j.job_number?.toLowerCase().includes(search.toLowerCase()) ||
    j.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    j.device_description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div />
        <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
          <Plus size={15} /> New Job Card
        </button>
      </div>

      {error && !modal && <ErrBanner msg={error} />}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="input" placeholder="Search job #, customer, device…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_OPTS.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              style={{
                padding: '7px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                background: statusFilter === s.value ? 'var(--gold-dim)' : 'var(--blue)',
                color: statusFilter === s.value ? 'var(--gold)' : 'var(--muted)',
                border: `1px solid ${statusFilter === s.value ? 'rgba(201,168,76,0.3)' : 'var(--mid)'}`,
              }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Wrench size={32} color="var(--muted)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No job cards found.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                {['Job #', 'Device', 'Customer', 'Status', 'Payment', 'Balance', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(j => {
                const ss = STATUS_STYLE[j.status] || {}
                const ps = PAYMENT_STYLE[j.payment_status] || {}
                return (
                  <tr key={j.id} style={{ borderBottom: '1px solid var(--mid)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--gold)', fontWeight: 500, fontFamily: 'monospace' }}>{j.job_number}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--light)' }}>
                      <div style={{ fontWeight: 500 }}>{j.device_description}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{j.customer_complaint?.slice(0, 40)}{j.customer_complaint?.length > 40 ? '…' : ''}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--light)' }}>
                      <div>{j.customer_name}</div>
                      {j.customer_phone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{j.customer_phone}</div>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize', background: ss.bg, color: ss.text }}>{j.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize', background: ps.bg, color: ps.text }}>{j.payment_status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: parseFloat(j.balance_due) > 0 ? 'var(--error)' : 'var(--muted)', fontWeight: 500 }}>{formatNaira(j.balance_due)}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{formatDate(j.created_at)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openStatus(j)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>Status</button>
                        {j.payment_status !== 'paid' && (
                          <button onClick={() => openPayment(j)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--gold)' }}>Pay</button>
                        )}
                        <button
                          onClick={async () => {
                            try { const res = await jobCardsAPI.get(j.id); printJobCardReceipt(res.data, user?.business_name) }
                            catch { printJobCardReceipt(j, user?.business_name) }
                          }}
                          className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} title="Print">
                          <Printer size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {modal === 'add' && (
        <Modal title="New Job Card" onClose={() => setModal(null)}>
          <ErrBanner msg={error} />
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Pick from services catalogue */}
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
                Pick from service catalogue <span style={{ color: 'var(--muted)' }}>(optional)</span>
              </label>
              <select className="input" value={form.service_id} onChange={e => handleServicePick(e.target.value)}>
                <option value="">— Select a standard service —</option>
                {DEVICE_TYPES.map(dt => {
                  const dtSvcs = services.filter(s => s.device_type === dt)
                  if (dtSvcs.length === 0) return null
                  return (
                    <optgroup key={dt} label={dt}>
                      {dtSvcs.map(s => (
                        <option key={s.id} value={s.id}>{s.name} — {formatNaira(s.base_price)}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Customer name *</label>
                <input className={`input ${formErrors.customer_name ? 'input-error' : ''}`}
                  value={form.customer_name} onChange={set('customer_name')} placeholder="Full name" />
                {formErrors.customer_name && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.customer_name}</span>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Phone number</label>
                <input className="input" type="tel" value={form.customer_phone} onChange={set('customer_phone')} placeholder="08012345678" />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Device description *</label>
              <input className={`input ${formErrors.device_description ? 'input-error' : ''}`}
                value={form.device_description} onChange={set('device_description')} placeholder="e.g. Samsung Galaxy A54" />
              {formErrors.device_description && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.device_description}</span>}
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Customer complaint *</label>
              <textarea className={`input ${formErrors.customer_complaint ? 'input-error' : ''}`}
                rows={3} value={form.customer_complaint} onChange={set('customer_complaint')}
                placeholder="Describe the fault or problem…" style={{ resize: 'vertical' }} />
              {formErrors.customer_complaint && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.customer_complaint}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Labour charge (₦)</label>
                <input className="input" type="number" min="0" step="0.01"
                  value={form.labour_charge} onChange={set('labour_charge')} placeholder="0.00" />
                {form.service_id && <span style={{ fontSize: 11, color: 'var(--gold)', marginTop: 3, display: 'block' }}>Pre-filled from service catalogue.</span>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Branch *</label>
                <select className={`input ${formErrors.branch_id ? 'input-error' : ''}`}
                  value={form.branch_id} onChange={set('branch_id')}>
                  <option value="">Select branch…</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {formErrors.branch_id && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.branch_id}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>
                {saving ? 'Creating…' : 'Create Job Card'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Status modal */}
      {modal === 'status' && selected && (
        <Modal title={`Update Status — ${selected.job_number}`} onClose={() => setModal(null)}>
          <ErrBanner msg={error} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {STATUS_OPTS.filter(s => s.value).map(s => {
              const ss = STATUS_STYLE[s.value] || {}
              const active = newStatus === s.value
              return (
                <button key={s.value} onClick={() => setNewStatus(s.value)}
                  style={{
                    padding: '10px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: active ? ss.bg : 'var(--navy)',
                    border: `1px solid ${active ? ss.text : 'var(--mid)'}`,
                    color: active ? ss.text : 'var(--muted)', fontSize: 13, fontWeight: active ? 500 : 400,
                  }}>
                  {s.label}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-gold" style={{ flex: 2 }} onClick={handleStatusUpdate} disabled={saving}>
              {saving ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </Modal>
      )}

      {/* Payment modal */}
      {modal === 'payment' && selected && (
        <Modal title={`Record Payment — ${selected.job_number}`} onClose={() => setModal(null)}>
          <ErrBanner msg={error} />
          <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div style={{ color: 'var(--muted)' }}>Total charge</div>
            <div style={{ color: 'var(--light)', textAlign: 'right' }}>{formatNaira(selected.total_charge)}</div>
            <div style={{ color: 'var(--muted)' }}>Amount paid</div>
            <div style={{ color: 'var(--success)', textAlign: 'right' }}>{formatNaira(selected.amount_paid)}</div>
            <div style={{ color: 'var(--muted)' }}>Balance due</div>
            <div style={{ color: 'var(--error)', textAlign: 'right', fontWeight: 600 }}>{formatNaira(selected.balance_due)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Amount (₦)</label>
              <input className="input" type="number" min="0" step="0.01"
                value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={`Max ₦${selected.balance_due}`} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Payment method</label>
              <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer</option>
                <option value="pos">POS</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-gold" style={{ flex: 2 }} onClick={handlePayment} disabled={saving}>
              {saving ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function JobCardsPage() {
  const { user, isOwner } = useAuth()
  const [branches, setBranches] = useState([])
  const [tab, setTab]           = useState('jobs') // 'jobs' | 'services'

  useEffect(() => {
    branchesAPI.list()
      .then(res => {
        const raw = res.data
        setBranches(Array.isArray(raw) ? raw : (raw.results ?? []))
      })
      .catch(() => {})
  }, [])

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)' }}>Technical Services</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--mid)', marginBottom: 20, paddingBottom: 0 }}>
        {[['jobs', '🔧 Job Cards'], ['services', '📋 Services Catalogue']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{
              padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === id ? 600 : 400,
              color: tab === id ? 'var(--gold)' : 'var(--muted)',
              borderBottom: `2px solid ${tab === id ? 'var(--gold)' : 'transparent'}`,
              marginBottom: -1, transition: 'color 0.15s, border-color 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'jobs'     && <JobCardsTab branches={branches} userId={user?.id} />}
      {tab === 'services' && <ServicesTab userId={user?.id} isOwner={isOwner} />}
    </AppLayout>
  )
}
