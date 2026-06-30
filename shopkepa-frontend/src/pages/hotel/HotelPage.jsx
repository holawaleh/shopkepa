import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, X, AlertCircle, Hotel, BedDouble, Calendar, LogIn, LogOut, CreditCard } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { hotelAPI } from '../../api/client'
import { formatNaira, parseApiError } from '../../utils/format'
import { useToast } from '../../context/ToastContext'

// ─── Shared ────────────────────────────────────────────────────────────────

const ROOM_TYPES = ['single', 'double', 'twin', 'suite', 'family', 'deluxe']
const ROOM_TYPE_LABELS = { single: 'Single', double: 'Double', twin: 'Twin', suite: 'Suite', family: 'Family', deluxe: 'Deluxe' }

const STATUS_STYLE = {
  available:   { bg: 'rgba(76,175,125,0.12)',  text: 'var(--success)' },
  occupied:    { bg: 'rgba(224,85,85,0.12)',   text: 'var(--error)' },
  maintenance: { bg: 'rgba(255,165,0,0.12)',   text: 'orange' },
}

const BOOKING_STATUS_STYLE = {
  pending:     { bg: 'rgba(100,120,200,0.15)', text: '#7090e0' },
  confirmed:   { bg: 'rgba(76,175,125,0.12)',  text: 'var(--success)' },
  checked_in:  { bg: 'rgba(201,168,76,0.12)',  text: 'var(--gold)' },
  checked_out: { bg: 'rgba(100,100,100,0.12)', text: 'var(--muted)' },
  cancelled:   { bg: 'rgba(224,85,85,0.12)',   text: 'var(--error)' },
}

const PAYMENT_STYLE = {
  unpaid:  { bg: 'rgba(224,85,85,0.12)',   text: 'var(--error)' },
  partial: { bg: 'rgba(255,165,0,0.12)',   text: 'orange' },
  paid:    { bg: 'rgba(76,175,125,0.12)',  text: 'var(--success)' },
}

function Badge({ style, children }) {
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize', ...style }}>
      {children}
    </span>
  )
}

function Modal({ title, onClose, children, maxWidth = 500 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 12, padding: 24, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--light)' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrBanner({ msg }) {
  if (!msg) return null
  return (
    <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
      <AlertCircle size={14} color="var(--error)" />
      <span style={{ fontSize: 13, color: 'var(--error)' }}>{msg}</span>
    </div>
  )
}

function Field({ label, children, error }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{error}</span>}
    </div>
  )
}

// ─── Occupancy strip ───────────────────────────────────────────────────────

function OccupancyBar() {
  const [data, setData] = useState(null)
  useEffect(() => {
    hotelAPI.occupancy().then(r => setData(r.data)).catch(() => {})
  }, [])
  if (!data) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
      {[
        { label: 'Total Rooms',     value: data.total_rooms,    color: 'var(--light)' },
        { label: 'Occupied',        value: data.occupied,       color: 'var(--error)' },
        { label: 'Available',       value: data.available,      color: 'var(--success)' },
        { label: 'Occupancy Rate',  value: `${data.occupancy_rate}%`, color: 'var(--gold)' },
        { label: 'Check-ins Today', value: data.checkins_today,  color: 'var(--light)' },
        { label: 'Check-outs Today',value: data.checkouts_today, color: 'var(--muted)' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Rooms tab ─────────────────────────────────────────────────────────────

function RoomsTab() {
  const [rooms, setRooms]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState(null) // null | 'add' | 'edit'
  const [editing, setEditing] = useState(null)
  const [form, setForm]     = useState({ room_number: '', room_type: 'double', capacity: '2', price_per_night: '', floor: '', amenities: '', description: '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await hotelAPI.listRooms(statusFilter ? { status: statusFilter } : {})
      setRooms(Array.isArray(res.data) ? res.data : (res.data.results ?? []))
    } catch (e) { setError(parseApiError(e)) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const openAdd  = () => { setForm({ room_number: '', room_type: 'double', capacity: '2', price_per_night: '', floor: '', amenities: '', description: '' }); setEditing(null); setError(''); setModal('room') }
  const openEdit = r  => { setForm({ room_number: r.room_number, room_type: r.room_type, capacity: String(r.capacity), price_per_night: String(r.price_per_night), floor: r.floor || '', amenities: r.amenities || '', description: r.description || '' }); setEditing(r); setError(''); setModal('room') }

  const handleSave = async e => {
    e.preventDefault()
    if (!form.room_number.trim() || !form.price_per_night) { setError('Room number and price are required.'); return }
    setSaving(true); setError('')
    try {
      const payload = { room_number: form.room_number.trim(), room_type: form.room_type, capacity: parseInt(form.capacity) || 2, price_per_night: parseFloat(form.price_per_night), floor: form.floor || null, amenities: form.amenities || null, description: form.description || null }
      if (editing) { await hotelAPI.updateRoom(editing.id, payload) } else { await hotelAPI.createRoom(payload) }
      setModal(null); load()
    } catch (e) { setError(parseApiError(e)) }
    finally { setSaving(false) }
  }

  const handleStatusChange = async (room, newStatus) => {
    try { await hotelAPI.updateRoom(room.id, { status: newStatus }); load() }
    catch (e) { setError(parseApiError(e)) }
  }

  const handleDelete = async room => {
    if (!confirm(`Remove Room ${room.room_number}? This cannot be undone.`)) return
    try { await hotelAPI.deleteRoom(room.id); load() }
    catch (e) { setError(parseApiError(e)) }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['', 'available', 'occupied', 'maintenance'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: statusFilter === s ? 'var(--gold-dim)' : 'var(--blue)', color: statusFilter === s ? 'var(--gold)' : 'var(--muted)', border: `1px solid ${statusFilter === s ? 'rgba(201,168,76,0.3)' : 'var(--mid)'}` }}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
        <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
          <Plus size={14} /> Add Room
        </button>
      </div>

      <ErrBanner msg={!modal ? error : ''} />

      {loading ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p> : rooms.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <BedDouble size={32} color="var(--muted)" style={{ marginBottom: 12 }} />
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>No rooms yet. Add your first room.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {rooms.map(r => {
            const ss = STATUS_STYLE[r.status] || {}
            return (
              <div key={r.id} style={{ background: 'var(--blue)', border: `1px solid ${r.status === 'available' ? 'var(--mid)' : ss.text}`, borderRadius: 10, padding: 16, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--gold)' }}>Room {r.room_number}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{ROOM_TYPE_LABELS[r.room_type]} · {r.capacity} guests{r.floor ? ` · Floor ${r.floor}` : ''}</div>
                  </div>
                  <Badge style={{ background: ss.bg, color: ss.text }}>{r.status_display}</Badge>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--light)', marginBottom: 8 }}>{formatNaira(r.price_per_night)} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>/ night</span></div>
                {r.amenities_list?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {r.amenities_list.map(a => <span key={a} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--navy)', color: 'var(--muted)' }}>{a}</span>)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--mid)', paddingTop: 10, marginTop: 4 }}>
                  {r.status !== 'available'    && <button onClick={() => handleStatusChange(r, 'available')}   className="btn-ghost" style={{ flex: 1, fontSize: 11, padding: '4px 0' }}>Set Available</button>}
                  {r.status !== 'maintenance'  && <button onClick={() => handleStatusChange(r, 'maintenance')} className="btn-ghost" style={{ flex: 1, fontSize: 11, padding: '4px 0' }}>Maintenance</button>}
                  <button onClick={() => openEdit(r)}   className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>Edit</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal === 'room' && (
        <Modal title={editing ? `Edit Room ${editing.room_number}` : 'Add Room'} onClose={() => setModal(null)}>
          <ErrBanner msg={error} />
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Room number *">
                <input className="input" value={form.room_number} onChange={set('room_number')} placeholder="e.g. 101" />
              </Field>
              <Field label="Room type">
                <select className="input" value={form.room_type} onChange={set('room_type')}>
                  {ROOM_TYPES.map(t => <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Capacity (guests)">
                <input className="input" type="number" min="1" value={form.capacity} onChange={set('capacity')} />
              </Field>
              <Field label="Price / night (₦) *">
                <input className="input" type="number" min="0" value={form.price_per_night} onChange={set('price_per_night')} placeholder="0" />
              </Field>
              <Field label="Floor">
                <input className="input" value={form.floor} onChange={set('floor')} placeholder="e.g. 2" />
              </Field>
            </div>
            <Field label="Amenities (comma-separated)">
              <input className="input" value={form.amenities} onChange={set('amenities')} placeholder="AC, WiFi, TV, Hot Water" />
            </Field>
            <Field label="Description">
              <textarea className="input" rows={2} value={form.description} onChange={set('description')} placeholder="Optional description…" style={{ resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Room'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

// ─── Bookings tab ──────────────────────────────────────────────────────────

const EMPTY_BOOKING = { room_id: '', guest_name: '', guest_phone: '', guest_email: '', check_in_date: '', check_out_date: '', notes: '', amount_paid: '0', payment_method: 'cash' }

function BookingsTab() {
  const toast = useToast()
  const [bookings, setBookings]   = useState([])
  const [rooms, setRooms]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal]         = useState(null) // null | 'add' | 'pay' | 'view'
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState(EMPTY_BOOKING)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bRes, rRes] = await Promise.all([
        hotelAPI.listBookings(statusFilter ? { status: statusFilter } : {}),
        hotelAPI.listRooms({ status: 'available' }),
      ])
      setBookings(Array.isArray(bRes.data) ? bRes.data : (bRes.data.results ?? []))
      setRooms(Array.isArray(rRes.data) ? rRes.data : (rRes.data.results ?? []))
    } catch (e) { setError(parseApiError(e)) }
    finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const openAdd = () => { setForm({ ...EMPTY_BOOKING, room_id: rooms[0]?.id || '' }); setError(''); setModal('add') }

  const handleCreate = async e => {
    e.preventDefault()
    if (!form.room_id || !form.guest_name.trim() || !form.check_in_date || !form.check_out_date) { setError('Room, guest name, and dates are required.'); return }
    setSaving(true); setError('')
    try {
      const res = await hotelAPI.createBooking({
        room_id:        form.room_id,
        guest_name:     form.guest_name.trim(),
        guest_phone:    form.guest_phone,
        guest_email:    form.guest_email,
        check_in_date:  form.check_in_date,
        check_out_date: form.check_out_date,
        notes:          form.notes,
        amount_paid:    parseFloat(form.amount_paid) || 0,
        payment_method: form.amount_paid > 0 ? form.payment_method : undefined,
      })
      toast.success(`Booking ${res.data.booking_number ?? ''} created for ${form.guest_name.trim()}`)
      setModal(null); load()
    } catch (e) { setError(parseApiError(e)) }
    finally { setSaving(false) }
  }

  const handleCheckIn = async b => {
    try {
      await hotelAPI.checkIn(b.id)
      toast.success(`${b.guest_name} checked in — Room ${b.room_number}`)
      load()
    } catch (e) { alert(parseApiError(e)) }
  }

  const handleCheckOut = async b => {
    if (!confirm(`Check out ${b.guest_name} from Room ${b.room_number}?`)) return
    try {
      const res = await hotelAPI.checkOut(b.id)
      const balance = parseFloat(res.data?.balance_due ?? 0)
      if (balance > 0) {
        toast.error(`${b.guest_name} checked out with outstanding balance of ${formatNaira(balance)}`)
      } else {
        toast.success(`${b.guest_name} checked out — Room ${b.room_number} is now available`)
      }
      load()
    } catch (e) { alert(parseApiError(e)) }
  }

  const openPay = b => { setSelected(b); setPayAmount(''); setPayMethod('cash'); setError(''); setModal('pay') }

  const handlePay = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) { setError('Enter a valid amount.'); return }
    setSaving(true); setError('')
    try {
      const res = await hotelAPI.pay(selected.id, { amount: parseFloat(payAmount), payment_method: payMethod })
      const remaining = parseFloat(res.data?.balance_due ?? 0)
      if (remaining <= 0) {
        toast.success(`${formatNaira(parseFloat(payAmount))} received — booking fully paid`)
      } else {
        toast.info(`${formatNaira(parseFloat(payAmount))} received — ${formatNaira(remaining)} still outstanding`)
      }
      setModal(null); load()
    } catch (e) { setError(parseApiError(e)) }
    finally { setSaving(false) }
  }

  const STATUS_OPTS = ['', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled']
  const filtered = bookings.filter(b =>
    !search ||
    b.booking_number?.toLowerCase().includes(search.toLowerCase()) ||
    b.guest_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.room_number?.toLowerCase().includes(search.toLowerCase())
  )

  // Compute nights for the create form preview
  const previewNights = (() => {
    if (!form.check_in_date || !form.check_out_date) return 0
    const d = (new Date(form.check_out_date) - new Date(form.check_in_date)) / 86400000
    return d > 0 ? d : 0
  })()
  const previewRoom = rooms.find(r => r.id === form.room_id)
  const previewTotal = previewRoom && previewNights ? (parseFloat(previewRoom.price_per_night) * previewNights) : 0

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: statusFilter === s ? 'var(--gold-dim)' : 'var(--blue)', color: statusFilter === s ? 'var(--gold)' : 'var(--muted)', border: `1px solid ${statusFilter === s ? 'rgba(201,168,76,0.3)' : 'var(--mid)'}` }}>
              {s ? s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'All'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input className="input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30, width: 180 }} />
          </div>
          <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
            <Plus size={14} /> New Booking
          </button>
        </div>
      </div>

      <ErrBanner msg={!modal ? error : ''} />

      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? <p style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Calendar size={32} color="var(--muted)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No bookings found.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                {['Booking #', 'Guest', 'Room', 'Dates', 'Amount', 'Payment', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const bs = BOOKING_STATUS_STYLE[b.status] || {}
                const ps = PAYMENT_STYLE[b.payment_status] || {}
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--mid)' }}>
                    <td style={{ padding: '11px 14px', color: 'var(--gold)', fontWeight: 500, fontFamily: 'monospace' }}>{b.booking_number}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ color: 'var(--light)', fontWeight: 500 }}>{b.guest_name}</div>
                      {b.guest_phone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.guest_phone}</div>}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--light)' }}>
                      <div style={{ fontWeight: 500 }}>Room {b.room_number}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{b.room_type}</div>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>
                      <div>{b.check_in_date}</div>
                      <div>→ {b.check_out_date}</div>
                      <div style={{ color: 'var(--light)' }}>{b.nights} night{b.nights !== 1 ? 's' : ''}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatNaira(b.total_amount)}</div>
                      {parseFloat(b.balance_due) > 0 && <div style={{ fontSize: 11, color: 'var(--error)' }}>Bal: {formatNaira(b.balance_due)}</div>}
                    </td>
                    <td style={{ padding: '11px 14px' }}><Badge style={{ background: ps.bg, color: ps.text }}>{b.payment_status}</Badge></td>
                    <td style={{ padding: '11px 14px' }}><Badge style={{ background: bs.bg, color: bs.text }}>{b.status_display || b.status}</Badge></td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <button onClick={() => handleCheckIn(b)} className="btn-ghost" style={{ padding: '3px 7px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <LogIn size={12} /> In
                          </button>
                        )}
                        {b.status === 'checked_in' && (
                          <button onClick={() => handleCheckOut(b)} className="btn-ghost" style={{ padding: '3px 7px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--warning)' }}>
                            <LogOut size={12} /> Out
                          </button>
                        )}
                        {b.payment_status !== 'paid' && (
                          <button onClick={() => openPay(b)} className="btn-ghost" style={{ padding: '3px 7px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--gold)' }}>
                            <CreditCard size={12} /> Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create booking modal */}
      {modal === 'add' && (
        <Modal title="New Booking" onClose={() => setModal(null)}>
          <ErrBanner msg={error} />
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Room *">
              <select className="input" value={form.room_id} onChange={set('room_id')}>
                <option value="">Select available room…</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>Room {r.room_number} — {ROOM_TYPE_LABELS[r.room_type]} · {formatNaira(r.price_per_night)}/night</option>
                ))}
              </select>
              {rooms.length === 0 && <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'block' }}>No available rooms right now.</span>}
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Guest name *">
                <input className="input" value={form.guest_name} onChange={set('guest_name')} placeholder="Full name" />
              </Field>
              <Field label="Phone">
                <input className="input" type="tel" value={form.guest_phone} onChange={set('guest_phone')} placeholder="08012345678" />
              </Field>
            </div>

            <Field label="Email">
              <input className="input" type="email" value={form.guest_email} onChange={set('guest_email')} placeholder="guest@email.com (optional)" />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Check-in date *">
                <input className="input" type="date" value={form.check_in_date} onChange={set('check_in_date')} />
              </Field>
              <Field label="Check-out date *">
                <input className="input" type="date" value={form.check_out_date} onChange={set('check_out_date')} min={form.check_in_date || undefined} />
              </Field>
            </div>

            {previewTotal > 0 && (
              <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '10px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)' }}>{previewNights} night{previewNights !== 1 ? 's' : ''} × {formatNaira(previewRoom?.price_per_night)}</span>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{formatNaira(previewTotal)}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Initial payment (₦)">
                <input className="input" type="number" min="0" value={form.amount_paid} onChange={set('amount_paid')} placeholder="0" />
              </Field>
              <Field label="Payment method">
                <select className="input" value={form.payment_method} onChange={set('payment_method')}>
                  <option value="cash">Cash</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="pos">POS</option>
                </select>
              </Field>
            </div>

            <Field label="Notes">
              <textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Special requests, purpose of visit…" style={{ resize: 'vertical' }} />
            </Field>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>{saving ? 'Booking…' : 'Create Booking'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Payment modal */}
      {modal === 'pay' && selected && (
        <Modal title={`Record Payment — ${selected.booking_number}`} onClose={() => setModal(null)}>
          <ErrBanner msg={error} />
          <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div style={{ color: 'var(--muted)' }}>Total</div>       <div style={{ color: 'var(--light)', textAlign: 'right' }}>{formatNaira(selected.total_amount)}</div>
            <div style={{ color: 'var(--muted)' }}>Paid</div>        <div style={{ color: 'var(--success)', textAlign: 'right' }}>{formatNaira(selected.amount_paid)}</div>
            <div style={{ color: 'var(--muted)' }}>Balance due</div> <div style={{ color: 'var(--error)', textAlign: 'right', fontWeight: 600 }}>{formatNaira(selected.balance_due)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
            <Field label="Amount (₦)">
              <input className="input" type="number" min="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={`Max ${formatNaira(selected.balance_due)}`} />
            </Field>
            <Field label="Payment method">
              <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="transfer">Bank Transfer</option>
                <option value="pos">POS</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-gold" style={{ flex: 2 }} onClick={handlePay} disabled={saving}>{saving ? 'Recording…' : 'Record Payment'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function HotelPage() {
  const [tab, setTab] = useState('bookings')

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)' }}>Hotel & Tourism</h1>
      </div>

      <OccupancyBar />

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--mid)', marginBottom: 20 }}>
        {[['bookings', '📅 Bookings'], ['rooms', '🛏️ Rooms']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: tab === id ? 600 : 400, color: tab === id ? 'var(--gold)' : 'var(--muted)', borderBottom: `2px solid ${tab === id ? 'var(--gold)' : 'transparent'}`, marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'bookings' && <BookingsTab />}
      {tab === 'rooms'    && <RoomsTab />}
    </AppLayout>
  )
}
