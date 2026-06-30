import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, X, AlertCircle, Users } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { customersAPI } from '../../api/client'
import { formatNaira, formatDate, parseApiError } from '../../utils/format'

const EMPTY_FORM = {
  full_name: '', phone_number: '', email: '',
  address: '', business_name: '', customer_type: 'retail',
}

const LOYALTY_COLORS = {
  bronze:   { bg: 'rgba(205,127,50,0.15)',  text: '#CD7F32' },
  silver:   { bg: 'rgba(192,192,192,0.15)', text: '#C0C0C0' },
  gold:     { bg: 'rgba(201,168,76,0.15)',  text: 'var(--gold)' },
  platinum: { bg: 'rgba(229,228,226,0.15)', text: '#E5E4E2' },
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 16,
    }}>
      <div style={{
        background: 'var(--blue)', border: '1px solid var(--mid)',
        borderRadius: 12, padding: 24, width: '100%', maxWidth: 460,
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

export default function CustomersPage() {
  const [customers, setCustomers]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [modal, setModal]           = useState(null)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await customersAPI.list({ search: search || undefined })
      const raw = res.data
      setCustomers(Array.isArray(raw) ? raw : (raw.results ?? []))
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setError('')
    setModal('add')
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({
      full_name:     c.full_name,
      phone_number:  c.phone_number || '',
      email:         c.email || '',
      address:       c.address || '',
      business_name: c.business_name || '',
      customer_type: c.customer_type || 'retail',
    })
    setFormErrors({})
    setError('')
    setModal('edit')
  }

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
    setFormErrors(fe => ({ ...fe, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Customer name is required'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        full_name:     form.full_name.trim(),
        phone_number:  form.phone_number.trim(),
        email:         form.email.trim(),
        address:       form.address.trim(),
        business_name: form.business_name.trim(),
        customer_type: form.customer_type,
      }
      if (modal === 'add') {
        await customersAPI.create(payload)
      } else {
        await customersAPI.update(editing.id, payload)
      }
      setModal(null)
      load()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)' }}>Customers</h1>
        <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
          <Plus size={15} /> Add Customer
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
          borderRadius: 'var(--r-sm)', padding: '10px 14px',
          display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
        }}>
          <AlertCircle size={15} color="var(--error)" />
          <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 340 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          className="input"
          placeholder="Search name, phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 34 }}
        />
      </div>

      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : customers.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Users size={32} color="var(--muted)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {search ? 'No customers match your search.' : 'No customers yet. Add your first customer.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                {['Name', 'Phone', 'Type', 'Loyalty', 'Lifetime Spend', 'Last Purchase', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const lc = LOYALTY_COLORS[c.loyalty_tag]
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--mid)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ color: 'var(--light)', fontWeight: 500 }}>{c.full_name}</div>
                      {c.business_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.business_name}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{c.phone_number || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: c.customer_type === 'wholesale' ? 'rgba(76,175,125,0.12)' : 'rgba(100,120,200,0.12)',
                        color: c.customer_type === 'wholesale' ? 'var(--success)' : 'var(--muted)',
                        textTransform: 'capitalize',
                      }}>
                        {c.customer_type || 'retail'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {c.loyalty_tag && lc ? (
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20,
                          background: lc.bg, color: lc.text, textTransform: 'capitalize',
                        }}>
                          {c.loyalty_tag}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--gold)', fontWeight: 500 }}>
                      {formatNaira(c.lifetime_spend || 0)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                      {formatDate(c.last_purchase_date)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => openEdit(c)} className="btn-ghost" style={{ padding: '4px 8px' }}>
                        <Edit2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Customer' : 'Edit Customer'} onClose={() => setModal(null)}>
          {error && (
            <div style={{
              background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
              borderRadius: 'var(--r-sm)', padding: '10px 14px',
              display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
            }}>
              <AlertCircle size={14} color="var(--error)" />
              <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
            </div>
          )}
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Full name *</label>
              <input className={`input ${formErrors.full_name ? 'input-error' : ''}`}
                value={form.full_name} onChange={set('full_name')} placeholder="Customer full name" />
              {formErrors.full_name && (
                <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{formErrors.full_name}</span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Phone number</label>
                <input className="input" type="tel" value={form.phone_number} onChange={set('phone_number')} placeholder="08012345678" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Email</label>
                <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="optional" />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Business name</label>
              <input className="input" value={form.business_name} onChange={set('business_name')} placeholder="Company (if wholesale)" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Type</label>
                <select className="input" value={form.customer_type} onChange={set('customer_type')}>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Address</label>
                <input className="input" value={form.address} onChange={set('address')} placeholder="Optional" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>
                {saving ? 'Saving…' : modal === 'add' ? 'Add Customer' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  )
}
