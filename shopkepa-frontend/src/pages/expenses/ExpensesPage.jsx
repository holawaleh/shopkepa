import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, AlertCircle, Trash2, Edit2, ReceiptText,
  TrendingDown, TrendingUp, DollarSign, Filter,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { expensesAPI, branchesAPI } from '../../api/client'
import { formatNaira, formatDate, parseApiError } from '../../utils/format'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

function Modal({ title, onClose, children, maxWidth = 460 }) {
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

function StatCard({ label, value, icon: Icon, color = 'var(--gold)' }) {
  return (
    <div style={{
      background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 8,
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--light)' }}>{value}</div>
      </div>
    </div>
  )
}

const TODAY = new Date().toISOString().slice(0, 10)
const MONTH_START = TODAY.slice(0, 8) + '01'

export default function ExpensesPage() {
  const { user } = useAuth()
  const toast    = useToast()

  // ── Data ─────────────────────────────────────────────────────────────────
  const [expenses, setExpenses]     = useState([])
  const [categories, setCategories] = useState([])
  const [branches, setBranches]     = useState([])
  const [summary, setSummary]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // ── Filters ───────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(MONTH_START)
  const [dateTo, setDateTo]     = useState(TODAY)
  const [filterBranch, setFilterBranch] = useState('')
  const [filterCat, setFilterCat]       = useState('')

  // ── Add/Edit modal ────────────────────────────────────────────────────────
  const [modal, setModal]       = useState(null) // 'add' | 'edit' | 'category'
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState({ branch_id: '', category_id: '', amount: '', description: '' })
  const [formErr, setFormErr]   = useState('')
  const [saving, setSaving]     = useState(false)

  // ── Category modal ────────────────────────────────────────────────────────
  const [catName, setCatName]   = useState('')
  const [catSaving, setCatSaving] = useState(false)
  const [catErr, setCatErr]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const params = {
      ...(dateFrom   ? { date_from: dateFrom }     : {}),
      ...(dateTo     ? { date_to: dateTo }         : {}),
      ...(filterBranch ? { branch_id: filterBranch } : {}),
      ...(filterCat    ? { category_id: filterCat }  : {}),
    }
    try {
      const [expRes, catRes, brRes, sumRes] = await Promise.allSettled([
        expensesAPI.list(params),
        expensesAPI.listCategories(),
        branchesAPI.list(),
        expensesAPI.summary(params),
      ])
      if (expRes.status === 'fulfilled') {
        const raw = expRes.value.data
        setExpenses(Array.isArray(raw) ? raw : (raw.results ?? []))
      }
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data)
      if (brRes.status === 'fulfilled') {
        const raw = brRes.value.data
        setBranches(Array.isArray(raw) ? raw : (raw.results ?? []))
      }
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data)
    } catch (err) { setError(parseApiError(err)) }
    finally { setLoading(false) }
  }, [dateFrom, dateTo, filterBranch, filterCat])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setForm({ branch_id: branches.length === 1 ? branches[0].id : '', category_id: '', amount: '', description: '' })
    setFormErr(''); setEditing(null); setModal('add')
  }

  const openEdit = (exp) => {
    setForm({
      branch_id:   exp.branch,
      category_id: exp.category,
      amount:      exp.amount,
      description: exp.description || '',
    })
    setFormErr(''); setEditing(exp); setModal('edit')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.branch_id)   { setFormErr('Select a branch.'); return }
    if (!form.category_id) { setFormErr('Select a category.'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { setFormErr('Enter a valid amount.'); return }
    setSaving(true); setFormErr('')
    try {
      if (modal === 'add') {
        await expensesAPI.create({
          branch_id:   form.branch_id,
          category_id: form.category_id,
          amount:      parseFloat(form.amount),
          description: form.description.trim(),
        })
        toast.success('Expense recorded')
      } else {
        await expensesAPI.update(editing.id, {
          amount:      parseFloat(form.amount),
          description: form.description.trim(),
          category_id: form.category_id,
        })
        toast.success('Expense updated')
      }
      setModal(null); load()
    } catch (err) { setFormErr(parseApiError(err)) }
    finally { setSaving(false) }
  }

  const handleDelete = async (exp) => {
    if (!window.confirm(`Delete this expense of ${formatNaira(exp.amount)}? This cannot be undone.`)) return
    try {
      await expensesAPI.delete(exp.id)
      toast.info('Expense deleted')
      load()
    } catch (err) { toast.error(parseApiError(err)) }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!catName.trim()) { setCatErr('Category name required.'); return }
    setCatSaving(true); setCatErr('')
    try {
      const res = await expensesAPI.createCategory({ name: catName.trim() })
      toast.success(`Category "${res.data.name}" added`)
      setCatName(''); setModal(null); load()
    } catch (err) { setCatErr(parseApiError(err)) }
    finally { setCatSaving(false) }
  }

  const totalExpenses = parseFloat(summary?.total_expenses || 0)
  const totalSales    = parseFloat(summary?.total_sales    || 0)
  const netProfit     = parseFloat(summary?.net_profit     || 0)

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)', marginBottom: 4 }}>Expenses</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Track business costs and monitor profitability.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ fontSize: 13, padding: '7px 14px' }}
            onClick={() => { setCatName(''); setCatErr(''); setModal('category') }}>
            + Category
          </button>
          <button className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Expenses" value={formatNaira(totalExpenses)} icon={TrendingDown} color="var(--error)" />
        <StatCard label="Total Revenue"  value={formatNaira(totalSales)}    icon={TrendingUp}   color="var(--success)" />
        <StatCard label="Net Profit"     value={formatNaira(netProfit)}     icon={DollarSign}   color={netProfit >= 0 ? 'var(--gold)' : 'var(--error)'} />
      </div>

      {/* By category breakdown */}
      {summary?.by_category?.length > 0 && (
        <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Expenses by category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {summary.by_category.map(c => (
              <div key={c.category} style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{c.category}:</span>{' '}
                <span style={{ color: 'var(--light)', fontWeight: 500 }}>{formatNaira(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{
        background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10,
        padding: '12px 16px', marginBottom: 20,
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <Filter size={14} color="var(--muted)" style={{ flexShrink: 0, marginBottom: 6 }} />
        {[
          { label: 'From', val: dateFrom, set: setDateFrom, type: 'date' },
          { label: 'To',   val: dateTo,   set: setDateTo,   type: 'date' },
        ].map(f => (
          <div key={f.label}>
            <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
            <input type={f.type} className="input" style={{ fontSize: 12, padding: '5px 10px' }}
              value={f.val} onChange={e => f.set(e.target.value)} />
          </div>
        ))}
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Branch</label>
          <select className="input" style={{ fontSize: 12, padding: '5px 10px' }}
            value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
            <option value="">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Category</label>
          <select className="input" style={{ fontSize: 12, padding: '5px 10px' }}
            value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <AlertCircle size={14} color="var(--error)" />
          <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
        </div>
      )}

      {/* Expense list */}
      <div style={{ background: 'var(--navy)', border: '1px solid var(--mid)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading…</p>
        ) : expenses.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <ReceiptText size={32} color="var(--mid)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>No expenses recorded for this period.</p>
            <button className="btn-gold" style={{ marginTop: 16 }} onClick={openAdd}>Record first expense</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                {['Date', 'Category', 'Branch', 'Description', 'Amount', 'By', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--mid)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(exp.expense_date)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--light)' }}>{exp.category_name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{exp.branch_name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)', maxWidth: 200 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {exp.description || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--error)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatNaira(exp.amount)}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>{exp.created_by_name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(exp)} className="btn-ghost" style={{ padding: '4px 8px' }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDelete(exp)} className="btn-ghost" style={{ padding: '4px 8px', color: 'var(--error)' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderTop: '2px solid var(--mid)' }}>
                <td colSpan={4} style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12, fontWeight: 500 }}>
                  {expenses.length} expense{expenses.length !== 1 ? 's' : ''} shown
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--error)', fontWeight: 700 }}>
                  {formatNaira(expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Record Expense' : 'Edit Expense'} onClose={() => setModal(null)}>
          {formErr && (
            <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <AlertCircle size={14} color="var(--error)" />
              <span style={{ fontSize: 13, color: 'var(--error)' }}>{formErr}</span>
            </div>
          )}
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {modal === 'add' && (
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Branch *</label>
                <select className="input" value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
                  <option value="">Select branch…</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Category *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="input" style={{ flex: 1 }} value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" className="btn-ghost" style={{ padding: '0 10px', fontSize: 12, whiteSpace: 'nowrap' }}
                  onClick={() => { setCatName(''); setCatErr(''); setModal('category-from-expense') }}>
                  + New
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Amount (₦) *</label>
              <input className="input" type="number" min="1" step="0.01" placeholder="0.00"
                value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Description (optional)</label>
              <input className="input" placeholder="e.g. Bought printer paper"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>
                {saving ? 'Saving…' : modal === 'add' ? 'Record Expense' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Category modal */}
      {(modal === 'category' || modal === 'category-from-expense') && (
        <Modal title="Add Expense Category" onClose={() => setModal(modal === 'category-from-expense' ? 'add' : null)}>
          {catErr && (
            <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <AlertCircle size={14} color="var(--error)" />
              <span style={{ fontSize: 13, color: 'var(--error)' }}>{catErr}</span>
            </div>
          )}
          <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Category name *</label>
              <input className="input" placeholder="e.g. Logistics, Salaries, Utilities"
                value={catName} onChange={e => setCatName(e.target.value)} autoFocus />
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Existing categories: {categories.map(c => c.name).join(', ') || 'None yet'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }}
                onClick={() => setModal(modal === 'category-from-expense' ? 'add' : null)}>
                Cancel
              </button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={catSaving}>
                {catSaving ? 'Adding…' : 'Add Category'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  )
}
