import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, X, AlertCircle, Package, PackagePlus, Tag } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { productsAPI, modulesAPI, branchesAPI } from '../../api/client'
import { formatNaira, parseApiError } from '../../utils/format'
import { useToast } from '../../context/ToastContext'

const EMPTY_FORM = {
  name: '', sku: '', description: '', module_id: '', category_id: '',
  unit_type: '', retail_price: '', wholesale_price: '',
  cost_price: '', reorder_level: '0',
}

const MODULE_PLACEHOLDERS = {
  general_trade:      'e.g. Dangote Sugar 1kg',
  fashion:            "e.g. Men's Slim-Fit Polo Shirt",
  electronics:        'e.g. Samsung 65W USB-C Charger',
  food:               'e.g. Basmati Rice 5kg',
  pharmacy:           'e.g. Paracetamol 500mg',
  building_materials: 'e.g. Dangote Cement 50kg',
  stationery:         'e.g. Bic Ballpoint Pen (Box of 50)',
  technical_services: 'e.g. Phone Screen Replacement',
  hotel:              'e.g. Standard Room (Daily)',
}

const MODULE_SKU_PLACEHOLDERS = {
  general_trade:      'e.g. GEN-SUGAR-DAN-1K',
  fashion:            'e.g. POLO-SLIM-BLK-M',
  electronics:        'e.g. SAM-65W-USBC',
  food:               'e.g. FOOD-RICE-BAS-5K',
  pharmacy:           'e.g. PARA-500-S10',
  building_materials: 'e.g. BLD-CEM-DAN-50',
  stationery:         'e.g. STN-PEN-BIC-BX',
  technical_services: 'e.g. SVC-SCR-REPL',
  hotel:              'e.g. HTL-STD-ROOM-D',
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
        borderRadius: 12, padding: 24, width: '100%', maxWidth: 520,
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

function FormField({ label, children, error }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--error)', marginTop: 3, display: 'block' }}>{error}</span>}
    </div>
  )
}

export default function ProductsPage() {
  const toast = useToast()
  const [products, setProducts]       = useState([])
  const [activeModules, setActiveModules] = useState([])
  const [categories, setCategories]   = useState([])
  const [branches, setBranches]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterModule, setFilterModule] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [modal, setModal]             = useState(null) // null | add | edit | restock | category
  const [editing, setEditing]         = useState(null)
  const [restockTarget, setRestockTarget] = useState(null)
  const [restockForm, setRestockForm] = useState({ branch_id: '', quantity_change: '', reason: '' })
  const [form, setForm]               = useState(EMPTY_FORM)
  const [categoryForm, setCategoryForm] = useState({ module_id: '', name: '' })
  const [categoryReturnModal, setCategoryReturnModal] = useState('add')
  const [categoryError, setCategoryError] = useState('')
  const [formErrors, setFormErrors]   = useState({})
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [deleting, setDeleting]       = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [prodRes, modRes, branchRes, catRes] = await Promise.all([
        productsAPI.list({
          search: search || undefined,
          module_id: filterModule || undefined,
          category_id: filterCategory || undefined,
        }),
        modulesAPI.active(),
        branchesAPI.list(),
        productsAPI.listCategories(),
      ])
      const raw = prodRes.data
      const br = branchRes.data
      const cats = catRes.data
      setProducts(Array.isArray(raw) ? raw : (raw.results ?? []))
      setActiveModules(modRes.data.filter(bm => bm.is_active))
      setBranches(Array.isArray(br) ? br : (br.results ?? []))
      setCategories(Array.isArray(cats) ? cats : (cats.results ?? []))
      setError('')
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setLoading(false)
    }
  }, [search, filterModule, filterCategory])

  useEffect(() => { load() }, [load])

  const categoriesForModule = (moduleId) => categories.filter(c => !moduleId || c.module === moduleId)
  const filterCategories = categoriesForModule(filterModule)
  const formCategories = categoriesForModule(form.module_id)

  const openAdd = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, module_id: filterModule || '' })
    setFormErrors({})
    setError('')
    setModal('add')
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name, sku: p.sku || '', description: p.description || '',
      module_id: p.module || '', category_id: p.category || '',
      unit_type: p.unit_type || '',
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      cost_price: p.cost_price || '',
      reorder_level: String(p.reorder_level ?? 0),
    })
    setFormErrors({})
    setError('')
    setModal('edit')
  }

  const openRestock = (p) => {
    setRestockTarget(p)
    setRestockForm({ branch_id: branches[0]?.id || '', quantity_change: '', reason: '' })
    setError('')
    setModal('restock')
  }

  const openCategoryModal = () => {
    setCategoryForm({ module_id: form.module_id || filterModule || activeModules[0]?.module?.id || '', name: '' })
    setCategoryReturnModal(modal === 'edit' ? 'edit' : 'add')
    setCategoryError('')
    setModal('category')
  }

  const set = (field) => (e) => {
    const value = e.target.value
    setForm(f => ({
      ...f,
      [field]: value,
      ...(field === 'module_id' ? { category_id: '' } : {}),
    }))
    setFormErrors(fe => ({ ...fe, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim())        e.name            = 'Product name is required'
    if (!form.module_id)          e.module_id       = 'Select a module'
    if (!form.retail_price)       e.retail_price    = 'Retail price is required'
    if (!form.wholesale_price)    e.wholesale_price = 'Wholesale price is required'
    if (parseFloat(form.retail_price) <= 0) e.retail_price = 'Must be greater than zero'
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
        name:             form.name.trim(),
        sku:              form.sku.trim(),
        description:      form.description.trim(),
        module_id:        form.module_id,
        category_id:      form.category_id || null,
        unit_type:        form.unit_type.trim(),
        retail_price:     parseFloat(form.retail_price),
        wholesale_price:  parseFloat(form.wholesale_price),
        cost_price:       form.cost_price ? parseFloat(form.cost_price) : undefined,
        reorder_level:    parseInt(form.reorder_level) || 0,
      }
      if (modal === 'add') {
        await productsAPI.create(payload)
        toast.success(`${payload.name} added to catalogue`)
      } else {
        await productsAPI.update(editing.id, payload)
        toast.success(`${payload.name} updated`)
      }
      setModal(null)
      load()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    if (!categoryForm.module_id) { setCategoryError('Select a module first.'); return }
    if (!categoryForm.name.trim()) { setCategoryError('Enter a category name.'); return }
    setSaving(true)
    setCategoryError('')
    try {
      const res = await productsAPI.createCategory({
        module_id: categoryForm.module_id,
        name: categoryForm.name.trim(),
      })
      const created = res.data
      setCategories(cats => [...cats.filter(c => c.id !== created.id), created].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => f.module_id === created.module ? { ...f, category_id: created.id } : f)
      toast.success(`${created.name} category added`)
      setModal(form.module_id ? categoryReturnModal : null)
      load()
    } catch (err) {
      setCategoryError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleRestock = async (e) => {
    e.preventDefault()
    const qty = parseInt(restockForm.quantity_change, 10)
    if (!restockForm.branch_id) { setError('Select a branch.'); return }
    if (!qty || qty === 0) { setError('Enter a non-zero quantity. Use negative to reduce stock.'); return }
    setSaving(true); setError('')
    try {
      await productsAPI.adjustStock(restockTarget.id, {
        branch_id:       restockForm.branch_id,
        adjustment_type: qty > 0 ? 'restock' : 'manual_decrease',
        quantity_change: qty,
        reason:          restockForm.reason.trim() || undefined,
      })
      setModal(null)
      toast.success(`${qty > 0 ? `+${qty}` : qty} units ${qty > 0 ? 'added to' : 'removed from'} ${restockTarget.name}`)
      load()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    setDeleting(p.id)
    try {
      await productsAPI.delete(p.id)
      toast.success(`${p.name} deleted`)
      load()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setDeleting(null)
    }
  }

  const totalStock = (p) => {
    if (Array.isArray(p.stock)) {
      return p.stock.reduce((sum, s) => sum + (s.quantity_in_stock ?? 0), 0)
    }
    return typeof p.stock === 'number' ? p.stock : '-'
  }

  const selectedModule = activeModules.find(bm => bm.module.id === form.module_id)?.module

  return (
    <AppLayout>
      <div className="products-page-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)' }}>Products</h1>
        <button className="btn-gold add-product-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openAdd}>
          <Plus size={15} /> Add Product
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

      <div className="products-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(180px, 1fr) minmax(180px, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            className="input"
            placeholder="Search name, SKU, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        <select className="input" value={filterModule} onChange={e => { setFilterModule(e.target.value); setFilterCategory('') }}>
          <option value="">All modules</option>
          {activeModules.map(bm => <option key={bm.module.id} value={bm.module.id}>{bm.module.name}</option>)}
        </select>
        <select className="input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All categories</option>
          {filterCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 24, color: 'var(--muted)', fontSize: 13 }}>Loading...</p>
        ) : products.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Package size={32} color="var(--muted)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {search || filterModule || filterCategory ? 'No products match your filters.' : 'No products yet. Add your first product.'}
            </p>
          </div>
        ) : (
          <>
          <div className="products-table-wrap">
          <table className="products-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mid)' }}>
                {['Name', 'SKU', 'Module', 'Category', 'Retail Price', 'Stock', 'Status', ''].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: 11,
                    color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--mid)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--light)', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{p.sku || '-'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{p.module_name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{p.category_name || 'Uncategorised'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--gold)', fontWeight: 500 }}>{formatNaira(p.retail_price)}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--light)' }}>{totalStock(p)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20,
                      background: p.is_active ? 'rgba(76,175,125,0.15)' : 'rgba(224,85,85,0.12)',
                      color: p.is_active ? 'var(--success)' : 'var(--error)',
                    }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openRestock(p)} className="btn-ghost" style={{ padding: '4px 8px' }} title="Adjust stock">
                        <PackagePlus size={13} />
                      </button>
                      <button onClick={() => openEdit(p)} className="btn-ghost" style={{ padding: '4px 8px' }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={deleting === p.id}
                        className="btn-ghost"
                        style={{ padding: '4px 8px', color: 'var(--error)' }}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="products-mobile-list">
            {products.map(p => (
              <article key={p.id} className="product-mobile-card">
                <div className="product-mobile-card-head">
                  <div style={{ minWidth: 0 }}>
                    <h2 className="product-mobile-name">{p.name}</h2>
                    <p className="product-mobile-meta">{p.sku || 'No SKU'} - {p.category_name || 'Uncategorised'}</p>
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 20,
                    background: p.is_active ? 'rgba(76,175,125,0.15)' : 'rgba(224,85,85,0.12)',
                    color: p.is_active ? 'var(--success)' : 'var(--error)',
                    flexShrink: 0,
                  }}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="product-mobile-details">
                  <span>Module</span>
                  <strong>{p.module_name || '-'}</strong>
                  <span>Retail price</span>
                  <strong className="gold-value">{formatNaira(p.retail_price)}</strong>
                  <span>Stock</span>
                  <strong>{totalStock(p)}</strong>
                </div>
                <div className="product-mobile-actions">
                  <button onClick={() => openRestock(p)} className="btn-ghost" title="Adjust stock">
                    <PackagePlus size={13} /> Stock
                  </button>
                  <button onClick={() => openEdit(p)} className="btn-ghost" title="Edit">
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={deleting === p.id}
                    className="btn-ghost"
                    style={{ color: 'var(--error)' }}
                    title="Delete"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          </>
        )}
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Add Product' : 'Edit Product'} onClose={() => setModal(null)}>
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
            <FormField label="Module *" error={formErrors.module_id}>
              <select className={`input ${formErrors.module_id ? 'input-error' : ''}`} value={form.module_id} onChange={set('module_id')} disabled={modal === 'edit'}>
                <option value="">Select module...</option>
                {activeModules.map(bm => <option key={bm.module.id} value={bm.module.id}>{bm.module.name}</option>)}
              </select>
              {activeModules.length === 0 && <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'block' }}>Activate at least one module in Settings first.</span>}
            </FormField>

            <FormField label="Category" error={formErrors.category_id}>
              <div className="product-category-row" style={{ display: 'flex', gap: 8 }}>
                <select className="input" value={form.category_id} onChange={set('category_id')} disabled={!form.module_id} style={{ flex: 1 }}>
                  <option value="">Uncategorised</option>
                  {formCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" className="btn-ghost" onClick={openCategoryModal} disabled={!form.module_id} style={{ padding: '0 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Tag size={13} /> New
                </button>
              </div>
              {selectedModule && formCategories.length === 0 && <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'block' }}>No categories yet for {selectedModule.name}. Add one now.</span>}
            </FormField>

            <FormField label="Product name *" error={formErrors.name}>
              {(() => {
                const ph = selectedModule ? (MODULE_PLACEHOLDERS[selectedModule.code?.toLowerCase()] || `e.g. ${selectedModule.name} item`) : 'e.g. Product name'
                return <input className={`input ${formErrors.name ? 'input-error' : ''}`} value={form.name} onChange={set('name')} placeholder={ph} />
              })()}
            </FormField>

            <div className="product-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="SKU" error={formErrors.sku}>
                {(() => {
                  const skuPh = selectedModule ? (MODULE_SKU_PLACEHOLDERS[selectedModule.code?.toLowerCase()] || 'e.g. PRD-001') : 'e.g. PRD-001'
                  return <input className="input" value={form.sku} onChange={set('sku')} placeholder={skuPh} />
                })()}
              </FormField>
              <FormField label="Unit type" error={formErrors.unit_type}>
                <input className="input" value={form.unit_type} onChange={set('unit_type')} placeholder="e.g. pcs, kg, carton" />
              </FormField>
            </div>

            <FormField label="Description" error={formErrors.description}>
              <input className="input" value={form.description} onChange={set('description')} placeholder="Optional notes, size, brand, pack count..." />
            </FormField>

            <div className="product-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Retail price (NGN) *" error={formErrors.retail_price}>
                <input className={`input ${formErrors.retail_price ? 'input-error' : ''}`} type="number" min="0" step="0.01" value={form.retail_price} onChange={set('retail_price')} placeholder="0.00" />
              </FormField>
              <FormField label="Wholesale price (NGN) *" error={formErrors.wholesale_price}>
                <input className={`input ${formErrors.wholesale_price ? 'input-error' : ''}`} type="number" min="0" step="0.01" value={form.wholesale_price} onChange={set('wholesale_price')} placeholder="0.00" />
              </FormField>
            </div>

            <div className="product-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Cost price (NGN)" error={formErrors.cost_price}>
                <input className="input" type="number" min="0" step="0.01" value={form.cost_price} onChange={set('cost_price')} placeholder="0.00" />
              </FormField>
              <FormField label="Reorder level" error={formErrors.reorder_level}>
                <input className="input" type="number" min="0" value={form.reorder_level} onChange={set('reorder_level')} placeholder="0" />
              </FormField>
            </div>

            <div className="product-modal-actions" style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving...' : modal === 'add' ? 'Add Product' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'category' && (
        <Modal title="Add Product Category" onClose={() => setModal(form.module_id ? categoryReturnModal : null)}>
          {categoryError && (
            <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: 'var(--error)', fontSize: 13 }}>
              {categoryError}
            </div>
          )}
          <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Module *">
              <select className="input" value={categoryForm.module_id} onChange={e => { setCategoryForm(f => ({ ...f, module_id: e.target.value })); setCategoryError('') }}>
                <option value="">Select module...</option>
                {activeModules.map(bm => <option key={bm.module.id} value={bm.module.id}>{bm.module.name}</option>)}
              </select>
            </FormField>
            <FormField label="Category name *">
              <input className="input" value={categoryForm.name} onChange={e => { setCategoryForm(f => ({ ...f, name: e.target.value })); setCategoryError('') }} placeholder="e.g. Phone Accessories" />
            </FormField>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
              Defaults are already added for common Nigerian shops. Use this for your own labels like Imported Creams, Fairly Used Phones, Lace Materials, or POS Paper Rolls.
            </div>
            <div className="product-modal-actions" style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(form.module_id ? categoryReturnModal : null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving...' : 'Add Category'}</button>
            </div>
          </form>
        </Modal>
      )}


      <style>{`
        .products-page-head h1 {
          margin: 0;
          min-width: 0;
        }

        .add-product-btn {
          width: auto;
          flex-shrink: 0;
          white-space: nowrap;
        }

        .products-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .products-table th,
        .products-table td {
          white-space: nowrap;
        }

        .products-table td:first-child {
          max-width: 220px;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .products-mobile-list {
          display: none;
        }

        .product-mobile-card {
          padding: 14px;
          border-bottom: 1px solid var(--mid);
        }

        .product-mobile-card:last-child {
          border-bottom: none;
        }

        .product-mobile-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .product-mobile-name {
          color: var(--light);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.35;
          margin: 0 0 3px;
          overflow-wrap: anywhere;
        }

        .product-mobile-meta {
          color: var(--muted);
          font-size: 12px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .product-mobile-details {
          display: grid;
          grid-template-columns: minmax(84px, auto) minmax(0, 1fr);
          gap: 7px 12px;
          align-items: baseline;
          font-size: 12px;
          margin-bottom: 12px;
        }

        .product-mobile-details span {
          color: var(--muted);
        }

        .product-mobile-details strong {
          color: var(--light);
          font-weight: 600;
          text-align: right;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .product-mobile-details .gold-value {
          color: var(--gold);
        }

        .product-mobile-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .product-mobile-actions .btn-ghost {
          width: 100%;
          min-width: 0;
          padding: 8px 6px;
          font-size: 12px;
          gap: 5px;
        }

        @media (max-width: 720px) {
          .products-page-head {
            align-items: stretch !important;
            flex-direction: column;
          }

          .add-product-btn {
            width: 100%;
          }

          .products-filter-grid {
            grid-template-columns: 1fr !important;
          }

          .products-table-wrap {
            display: none;
          }

          .products-mobile-list {
            display: block;
          }

          .product-form-grid {
            grid-template-columns: 1fr !important;
          }

          .product-category-row,
          .product-modal-actions {
            flex-direction: column;
          }

          .product-category-row .btn-ghost,
          .product-modal-actions .btn-ghost,
          .product-modal-actions .btn-gold {
            width: 100%;
          }
        }

        @media (max-width: 380px) {
          .product-mobile-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      {modal === 'restock' && restockTarget && (
        <Modal title={`Adjust Stock - ${restockTarget.name}`} onClose={() => setModal(null)}>
          {error && (
            <div style={{ background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <AlertCircle size={14} color="var(--error)" />
              <span style={{ fontSize: 13, color: 'var(--error)' }}>{error}</span>
            </div>
          )}
          <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
            Current stock: <strong style={{ color: 'var(--light)' }}>{totalStock(restockTarget)} units</strong>
          </div>
          <form onSubmit={handleRestock} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Branch *">
              <select className="input" value={restockForm.branch_id} onChange={e => setRestockForm(f => ({ ...f, branch_id: e.target.value }))}>
                <option value="">Select branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </FormField>
            <FormField label="Quantity change *">
              <input className="input" type="number" step="1" value={restockForm.quantity_change} onChange={e => setRestockForm(f => ({ ...f, quantity_change: e.target.value }))} placeholder="e.g. 50 or -5" />
            </FormField>
            <FormField label="Reason / notes">
              <input className="input" value={restockForm.reason} onChange={e => setRestockForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. New delivery, stock correction" />
            </FormField>
            <div className="product-modal-actions" style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="btn-gold" style={{ flex: 2 }} disabled={saving}>{saving ? 'Saving...' : 'Update Stock'}</button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  )
}
