import { useState, useEffect, useRef } from 'react'
import {
  Search, Plus, Minus, Trash2, X, AlertCircle,
  ShoppingCart, Check, Printer, ChevronLeft, ChevronRight,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { productsAPI, salesAPI, modulesAPI, branchesAPI, customersAPI } from '../../api/client'
import { formatNaira, parseApiError } from '../../utils/format'
import { printSaleReceipt } from '../../utils/printDoc'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const PAGE_SIZE = 12

const LOYALTY_COLORS = {
  bronze:   { bg: 'rgba(205,127,50,0.15)',  text: '#CD7F32' },
  silver:   { bg: 'rgba(192,192,192,0.15)', text: '#C0C0C0' },
  gold:     { bg: 'rgba(201,168,76,0.15)',  text: 'var(--gold)' },
  platinum: { bg: 'rgba(229,228,226,0.15)', text: '#E5E4E2' },
  vip:      { bg: 'rgba(120,60,220,0.15)',  text: '#9966FF' },
}

function LoyaltyBadge({ tag }) {
  if (!tag) return null
  const c = LOYALTY_COLORS[tag] || { bg: 'rgba(150,150,150,0.15)', text: 'var(--muted)' }
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 20, textTransform: 'capitalize',
      background: c.bg, color: c.text, fontWeight: 600,
    }}>
      {tag}
    </span>
  )
}

function StockBadge({ remaining }) {
  if (remaining <= 0) return (
    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(224,85,85,0.15)', color: 'var(--error)' }}>
      Out of stock
    </span>
  )
  if (remaining <= 5) return (
    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(201,168,76,0.15)', color: 'var(--warning)' }}>
      {remaining} left
    </span>
  )
  return (
    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(76,175,125,0.12)', color: 'var(--success)' }}>
      {remaining} in stock
    </span>
  )
}

export default function POSPage() {
  // Keep hooks at the very top — must never be below an early return
  const { user } = useAuth()
  const toast    = useToast()

  // ── Setup ─────────────────────────────────────────────────────────────────
  const [branches, setBranches]           = useState([])
  const [activeModules, setActiveModules] = useState([])
  const [branchId, setBranchId]           = useState('')
  const [moduleId, setModuleId]           = useState('')
  const [setupDone, setSetupDone]         = useState(false)
  const [setupError, setSetupError]       = useState('')

  // ── Products grid ─────────────────────────────────────────────────────────
  const [products, setProducts]               = useState([])
  const [page, setPage]                       = useState(1)
  const [totalCount, setTotalCount]           = useState(0)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [query, setQuery]                     = useState('')
  const searchTimer                           = useRef(null)

  // ── Cart: { product, qty, unit_price, price_type, stock } ─────────────────
  const [cart, setCart] = useState([])

  // ── Customer ──────────────────────────────────────────────────────────────
  const [customerSearch, setCustomerSearch]     = useState('')
  const [customers, setCustomers]               = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerList, setShowCustomerList] = useState(false)
  const [quickAddCustomer, setQuickAddCustomer] = useState(false)
  const [quickForm, setQuickForm]               = useState({ full_name: '', phone_number: '' })
  const [quickSaving, setQuickSaving]           = useState(false)
  const [quickError, setQuickError]             = useState('')

  // ── Checkout ──────────────────────────────────────────────────────────────
  const [modal, setModal]         = useState(false)
  const [payMethod, setPayMethod] = useState('cash')
  const [amountPaid, setAmountPaid] = useState('')
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [saleError, setSaleError] = useState('')
  const [success, setSuccess]     = useState(null)

  // ── Load branches + modules ───────────────────────────────────────────────
  useEffect(() => {
    Promise.all([branchesAPI.list(), modulesAPI.active()])
      .then(([bRes, mRes]) => {
        const allBranches = Array.isArray(bRes.data) ? bRes.data : (bRes.data.results ?? [])
        const ms = (Array.isArray(mRes.data) ? mRes.data : (mRes.data.results ?? [])).filter(bm => bm.is_active)

        // Cashiers are assigned to specific branches — filter to their branches
        const userBranchIds = new Set(user?.branch_ids ?? [])
        const bs = userBranchIds.size > 0
          ? allBranches.filter(b => userBranchIds.has(b.id))
          : allBranches

        setBranches(bs.length > 0 ? bs : allBranches)
        setActiveModules(ms)
        // Auto-select if only one option available
        const visibleBranches = bs.length > 0 ? bs : allBranches
        if (visibleBranches.length === 1) setBranchId(visibleBranches[0].id)
        if (ms.length === 1) setModuleId(ms[0].module.id)
      })
      .catch(() => setSetupError('Could not load branches/modules. Check your connection.'))
  }, [user])

  const confirmSetup = () => {
    if (!branchId) { setSetupError('Please select a branch.'); return }
    if (!moduleId) { setSetupError('Please select a module.'); return }
    setSetupError('')
    setSetupDone(true)
  }

  // ── Load product grid ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!setupDone || !branchId) return
    clearTimeout(searchTimer.current)
    const delay = query ? 300 : 0
    searchTimer.current = setTimeout(async () => {
      setLoadingProducts(true)
      try {
        const res = await productsAPI.list({
          branch_id: branchId, module_id: moduleId, is_active: true,
          page, page_size: PAGE_SIZE,
          ...(query ? { search: query } : {}),
        })
        const raw = res.data
        if (raw && raw.results !== undefined) {
          setProducts(raw.results)
          setTotalCount(raw.count)
        } else {
          const arr = Array.isArray(raw) ? raw : []
          setProducts(arr)
          setTotalCount(arr.length)
        }
      } catch { setProducts([]) }
      finally { setLoadingProducts(false) }
    }, delay)
    return () => clearTimeout(searchTimer.current)
  }, [setupDone, branchId, moduleId, query, page])

  const handleQueryChange = (val) => { setQuery(val); setPage(1) }
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const getStock = (product) => typeof product.stock === 'number' ? product.stock : 9999
  const cartMap  = Object.fromEntries(cart.map(i => [i.product.id, i.qty]))

  const addToCart = (product) => {
    const stock = getStock(product)
    if (stock <= 0) return
    setCart(c => {
      const existing = c.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.qty >= stock) return c
        return c.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...c, { product, qty: 1, unit_price: parseFloat(product.retail_price) || 0, price_type: 'retail', stock }]
    })
  }

  const updateQty = (productId, delta) => {
    setCart(c => c.map(i => {
      if (i.product.id !== productId) return i
      return { ...i, qty: Math.max(1, Math.min(i.qty + delta, i.stock)) }
    }))
  }

  const setQtyDirect = (productId, val) => {
    setCart(c => c.map(i => {
      if (i.product.id !== productId) return i
      const n = parseInt(val, 10)
      if (isNaN(n) || n < 1) return i
      return { ...i, qty: Math.min(n, i.stock) }
    }))
  }

  const setPriceType = (productId, type) => {
    setCart(c => c.map(i => {
      if (i.product.id !== productId) return i
      const prices = {
        retail:    parseFloat(i.product.retail_price)    || 0,
        wholesale: parseFloat(i.product.wholesale_price) || parseFloat(i.product.retail_price) || 0,
        custom:    i.unit_price,
      }
      return { ...i, price_type: type, unit_price: prices[type] }
    }))
  }

  const updatePrice = (productId, val) => {
    setCart(c => c.map(i =>
      i.product.id === productId ? { ...i, unit_price: parseFloat(val) || 0, price_type: 'custom' } : i
    ))
  }

  const removeFromCart = (productId) => setCart(c => c.filter(i => i.product.id !== productId))

  const cartTotal     = cart.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const cartItemCount = cart.reduce((s, i) => s + i.qty, 0)

  // ── Customer search ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomers([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await customersAPI.list({ search: customerSearch.trim() })
        const raw = res.data
        setCustomers((Array.isArray(raw) ? raw : (raw.results ?? [])).slice(0, 6))
        setShowCustomerList(true)
      } catch { setCustomers([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [customerSearch])

  const handleQuickAddCustomer = async () => {
    if (!quickForm.full_name.trim()) { setQuickError('Name is required.'); return }
    setQuickSaving(true); setQuickError('')
    try {
      const res = await customersAPI.create({
        full_name:    quickForm.full_name.trim(),
        phone_number: quickForm.phone_number.trim(),
      })
      setSelectedCustomer(res.data)
      setCustomerSearch('')
      setShowCustomerList(false)
      setQuickAddCustomer(false)
      setQuickForm({ full_name: '', phone_number: '' })
      toast.success(`${res.data.full_name} added as a customer`)
    } catch (err) { setQuickError(parseApiError(err)) }
    finally { setQuickSaving(false) }
  }

  // ── Checkout ──────────────────────────────────────────────────────────────
  const openCheckout = () => {
    if (cart.length === 0) return
    setAmountPaid(cartTotal.toFixed(2))
    setPayMethod('cash')
    setNotes('')
    setSaleError('')
    setModal(true)
  }

  const balanceDue = Math.max(0, cartTotal - parseFloat(amountPaid || 0))
  const change     = Math.max(0, parseFloat(amountPaid || 0) - cartTotal)

  const handleCheckout = async () => {
    setSaleError('')
    const paid = parseFloat(amountPaid)
    if (isNaN(paid) || paid < 0) { setSaleError('Please enter the amount paid by the customer.'); return }
    if (paid < cartTotal && !selectedCustomer) {
      setSaleError('Attach a customer before recording a partial or unpaid sale.')
      return
    }
    setSaving(true)
    try {
      const res = await salesAPI.create({
        branch_id:      branchId,
        module_id:      moduleId,
        customer_id:    selectedCustomer?.id || undefined,
        items: cart.map(i => ({
          product_id:      i.product.id,
          quantity:        i.qty,
          price_type:      i.price_type,
          unit_price:      i.unit_price,
          discount_amount: 0,
        })),
        payment_method:  payMethod,
        amount_paid:     paid,
        notes,
        discount_amount: 0,
      })
      const saleData = res.data
      setSuccess(saleData)
      // Fire success toast
      toast.success(`Sale complete — ${formatNaira(saleData.total ?? saleData.amount ?? cartTotal)}`)
      // Stock-level warnings from sale items
      const saleItems = saleData.items ?? []
      saleItems.forEach(item => {
        const remaining = item.remaining_stock ?? item.stock_after ?? null
        if (remaining === null) return
        if (remaining === 0) {
          toast.error(`${item.product_name ?? item.name ?? 'Item'} is now out of stock`)
        } else if (remaining <= (item.reorder_level ?? 5)) {
          toast.info(`${item.product_name ?? item.name ?? 'Item'} is running low (${remaining} left)`)
        }
      })
      setCart([])
      setSelectedCustomer(null)
      setCustomerSearch('')
      setModal(false)
      // Reload product grid to refresh stock counts
      setPage(1)
      setQuery(q => q)
    } catch (err) {
      setSaleError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 440, margin: '40px auto' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)', marginBottom: 4 }}>Point of Sale</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
            Select your branch and module to start selling.
          </p>
          {setupError && (
            <div style={{
              background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
            }}>
              <AlertCircle size={14} color="var(--error)" />
              <span style={{ fontSize: 13, color: 'var(--error)' }}>{setupError}</span>
            </div>
          )}
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Branch</label>
              <select className="input" value={branchId} onChange={e => setBranchId(e.target.value)}>
                <option value="">Select branch…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Module</label>
              <select className="input" value={moduleId} onChange={e => setModuleId(e.target.value)}>
                <option value="">Select module…</option>
                {activeModules.map(bm => (
                  <option key={bm.module.id} value={bm.module.id}>{bm.module.name}</option>
                ))}
              </select>
              {activeModules.length === 0 && (
                <p style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>
                  No active modules — enable modules in Settings first.
                </p>
              )}
            </div>
            <button className="btn-gold" onClick={confirmSetup} style={{ marginTop: 4 }}>
              Start Selling →
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ── Main POS ──────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)' }}>POS</h1>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setSetupDone(false)}>
          Change Branch/Module
        </button>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{
          background: 'rgba(76,175,125,0.12)', border: '1px solid rgba(76,175,125,0.3)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} color="var(--success)" />
            <span style={{ fontSize: 13, color: 'var(--success)' }}>
              Sale {success.sale_number} recorded — {formatNaira(success.amount_paid)} paid.
            </span>
            {parseFloat(success.balance_due || 0) > 0 && (
              <span style={{ fontSize: 13, color: 'var(--warning)' }}>
                Balance: {formatNaira(success.balance_due)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => printSaleReceipt(success, user?.business_name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)',
              }}
            >
              <Printer size={13} /> Print Receipt
            </button>
            <button onClick={() => setSuccess(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>

        {/* ── Left: Products + Customer ── */}
        <div>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              placeholder="Search products by name or SKU…"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              style={{ paddingLeft: 36 }}
              autoFocus
            />
            {query && (
              <button onClick={() => handleQueryChange('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Customer selector */}
          <div style={{
            background: 'var(--blue)', border: '1px solid var(--mid)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Customer (optional)</div>
            {selectedCustomer ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--light)', fontWeight: 500 }}>{selectedCustomer.full_name}</span>
                    <LoyaltyBadge tag={selectedCustomer.loyalty_tag} />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Spent: {formatNaira(selectedCustomer.lifetime_spend || 0)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{selectedCustomer.phone_number}</div>
                  {parseFloat(selectedCustomer.total_outstanding_debt || 0) > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>
                      ⚠ Outstanding debt: {formatNaira(selectedCustomer.total_outstanding_debt)}
                    </div>
                  )}
                </div>
                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
                  <X size={15} />
                </button>
              </div>
            ) : quickAddCustomer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 2, fontWeight: 500 }}>New customer</div>
                {quickError && <div style={{ fontSize: 12, color: 'var(--error)' }}>{quickError}</div>}
                <input className="input" placeholder="Full name *" style={{ fontSize: 13 }}
                  value={quickForm.full_name} onChange={e => setQuickForm(f => ({ ...f, full_name: e.target.value }))} />
                <input className="input" placeholder="Phone number" style={{ fontSize: 13 }}
                  value={quickForm.phone_number} onChange={e => setQuickForm(f => ({ ...f, phone_number: e.target.value }))} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                    onClick={() => { setQuickAddCustomer(false); setQuickError('') }}>Cancel</button>
                  <button className="btn-gold" style={{ flex: 2, padding: '6px 10px', fontSize: 12 }}
                    onClick={handleQuickAddCustomer} disabled={quickSaving}>
                    {quickSaving ? 'Saving…' : 'Add & Select'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  placeholder="Search customer by name or phone…"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  style={{ fontSize: 13 }}
                />
                {showCustomerList && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'var(--navy)', border: '1px solid var(--mid)',
                    borderRadius: 6, zIndex: 10, overflow: 'hidden', marginTop: 2,
                  }}>
                    {customers.map(c => (
                      <button key={c.id}
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerList(false) }}
                        style={{
                          width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                          borderBottom: '1px solid var(--mid)', cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                        <div>
                          <div style={{ fontSize: 13, color: 'var(--light)' }}>{c.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.phone_number}</div>
                        </div>
                        <LoyaltyBadge tag={c.loyalty_tag} />
                      </button>
                    ))}
                    <button
                      onClick={() => { setQuickAddCustomer(true); setShowCustomerList(false) }}
                      style={{
                        width: '100%', padding: '10px 14px', background: 'rgba(201,168,76,0.06)',
                        border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex',
                        alignItems: 'center', gap: 6,
                      }}>
                      <Plus size={13} color="var(--gold)" />
                      <span style={{ fontSize: 13, color: 'var(--gold)' }}>
                        Add "{customerSearch.trim()}" as new customer
                      </span>
                    </button>
                  </div>
                )}
                {customerSearch.trim() && !showCustomerList && (
                  <button
                    onClick={() => { setQuickForm({ full_name: customerSearch.trim(), phone_number: '' }); setQuickAddCustomer(true) }}
                    style={{ fontSize: 12, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>
                    + Add "{customerSearch.trim()}" as new customer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Product grid */}
          {loadingProducts ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>Loading products…</p>
          ) : products.length === 0 ? (
            <div style={{
              background: 'var(--blue)', border: '1px solid var(--mid)',
              borderRadius: 8, padding: '36px 24px', textAlign: 'center',
            }}>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                {query ? `No products match "${query}".` : 'No products found for this branch. Add products in the Products page.'}
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
                gap: 10,
              }}>
                {products.map(p => {
                  const cartQty   = cartMap[p.id] || 0
                  const stock     = getStock(p)
                  const remaining = stock - cartQty
                  const disabled  = stock <= 0

                  return (
                    <button key={p.id} onClick={() => addToCart(p)} disabled={disabled}
                      style={{
                        background: disabled ? 'rgba(0,0,0,0.15)' : 'var(--blue)',
                        border: `1px solid ${cartQty > 0 ? 'rgba(201,168,76,0.4)' : 'var(--mid)'}`,
                        borderRadius: 8, padding: '12px 12px 10px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left', position: 'relative',
                        opacity: disabled ? 0.5 : 1,
                        transition: 'border-color 0.15s, background 0.15s',
                      }}>
                      {cartQty > 0 && (
                        <span style={{
                          position: 'absolute', top: -7, right: -7,
                          background: 'var(--gold)', color: 'var(--navy)',
                          fontSize: 10, fontWeight: 700, borderRadius: 10,
                          padding: '1px 6px', minWidth: 18, textAlign: 'center',
                        }}>
                          {cartQty}
                        </span>
                      )}
                      <div style={{
                        fontSize: 13, fontWeight: 500, color: 'var(--light)',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        lineHeight: 1.35, minHeight: 36, marginBottom: 8,
                      }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>
                        {formatNaira(p.retail_price)}
                      </div>
                      <StockBadge remaining={remaining} />
                    </button>
                  )
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 12, marginTop: 16,
                }}>
                  <button className="btn-ghost"
                    style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {page} / {totalPages} · {totalCount} products
                  </span>
                  <button className="btn-ghost"
                    style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: Cart ── */}
        <div style={{
          background: 'var(--blue)', border: '1px solid var(--mid)',
          borderRadius: 10, padding: 14, position: 'sticky', top: 72,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ShoppingCart size={15} color="var(--gold)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--light)' }}>Cart</span>
            {cartItemCount > 0 && (
              <span style={{
                background: 'var(--gold)', color: 'var(--navy)',
                fontSize: 10, fontWeight: 700, borderRadius: 10,
                padding: '1px 6px', marginLeft: 'auto',
              }}>
                {cartItemCount} item{cartItemCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '28px 0' }}>
              Tap a product card to add it here.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto', marginBottom: 10 }}>
                {cart.map(item => {
                  const remaining = item.stock - item.qty
                  return (
                    <div key={item.product.id} style={{ background: 'var(--navy)', borderRadius: 6, padding: '10px 10px 8px' }}>
                      {/* Name + delete */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 7 }}>
                        <div style={{ fontSize: 12, color: 'var(--light)', fontWeight: 500, flex: 1, lineHeight: 1.3 }}>
                          {item.product.name}
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Price type toggle */}
                      <div style={{ display: 'flex', gap: 3, marginBottom: 7 }}>
                        {[['retail', 'Retail'], ['wholesale', 'Whsl'], ['custom', 'Custom']].map(([type, label]) => (
                          <button key={type} onClick={() => setPriceType(item.product.id, type)}
                            style={{
                              flex: 1, padding: '3px 0', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                              border: `1px solid ${item.price_type === type ? 'rgba(201,168,76,0.5)' : 'var(--mid)'}`,
                              background: item.price_type === type ? 'var(--gold-dim)' : 'transparent',
                              color: item.price_type === type ? 'var(--gold)' : 'var(--muted)',
                            }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Qty controls + unit price */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <button onClick={() => updateQty(item.product.id, -1)}
                            style={{ background: 'var(--mid)', border: 'none', color: 'var(--light)', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Minus size={10} />
                          </button>
                          <input
                            type="number" min="1" max={item.stock}
                            value={item.qty}
                            onChange={e => setQtyDirect(item.product.id, e.target.value)}
                            style={{
                              width: 38, height: 22, padding: '0 4px', borderRadius: 4,
                              fontSize: 12, textAlign: 'center', MozAppearance: 'textfield',
                              background: 'var(--blue)', border: '1px solid var(--mid)', color: 'var(--light)',
                            }}
                          />
                          <button onClick={() => updateQty(item.product.id, 1)}
                            disabled={item.qty >= item.stock}
                            style={{
                              background: item.qty >= item.stock ? 'rgba(255,255,255,0.04)' : 'var(--mid)',
                              border: 'none', borderRadius: 4, width: 22, height: 22,
                              cursor: item.qty >= item.stock ? 'not-allowed' : 'pointer',
                              color: item.qty >= item.stock ? 'var(--muted)' : 'var(--light)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                            <Plus size={10} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>₦</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={item.unit_price}
                            onChange={e => updatePrice(item.product.id, e.target.value)}
                            style={{
                              width: 72, height: 22, padding: '0 4px', borderRadius: 4,
                              fontSize: 12, textAlign: 'right', MozAppearance: 'textfield',
                              background: 'var(--blue)', border: '1px solid var(--mid)',
                              color: 'var(--gold)', fontWeight: 500,
                            }}
                          />
                        </div>
                      </div>

                      {/* Subtotal + remaining */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                        <span style={{ fontSize: 10, color: remaining <= 3 && item.stock < 9999 ? 'var(--warning)' : 'var(--muted)' }}>
                          {item.stock < 9999 ? `${remaining} remaining` : ''}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                          {formatNaira(item.qty * item.unit_price)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ borderTop: '1px solid var(--mid)', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Total</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{formatNaira(cartTotal)}</span>
                </div>
                <button className="btn-gold" style={{ width: '100%', fontSize: 14 }} onClick={openCheckout}>
                  Checkout →
                </button>
                <button className="btn-ghost" style={{ width: '100%', marginTop: 6, fontSize: 12 }}
                  onClick={() => setCart([])}>
                  Clear cart
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Checkout modal ── */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 16,
        }}>
          <div style={{
            background: 'var(--blue)', border: '1px solid var(--mid)',
            borderRadius: 12, padding: 24, width: '100%', maxWidth: 440,
            maxHeight: '92vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--light)' }}>Complete Sale</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {saleError && (
              <div style={{
                background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
                borderRadius: 8, padding: '10px 14px',
                display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 16,
              }}>
                <AlertCircle size={14} color="var(--error)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: 'var(--error)', lineHeight: 1.4 }}>{saleError}</span>
              </div>
            )}

            {/* Customer summary */}
            {selectedCustomer && (
              <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--light)' }}>{selectedCustomer.full_name}</span>
                  <LoyaltyBadge tag={selectedCustomer.loyalty_tag} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Lifetime spend: {formatNaira(selectedCustomer.lifetime_spend || 0)}
                </div>
                {parseFloat(selectedCustomer.total_outstanding_debt || 0) > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3 }}>
                    ⚠ Existing debt: {formatNaira(selectedCustomer.total_outstanding_debt)}
                  </div>
                )}
              </div>
            )}

            {/* Items summary */}
            <div style={{ background: 'var(--navy)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, maxHeight: 180, overflowY: 'auto' }}>
              {cart.map(item => (
                <div key={item.product.id} style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: 12,
                  padding: '4px 0', borderBottom: '1px solid var(--mid)',
                }}>
                  <span style={{ color: 'var(--light)' }}>
                    {item.product.name} × {item.qty}
                    {item.price_type !== 'retail' && (
                      <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4, textTransform: 'capitalize' }}>
                        ({item.price_type})
                      </span>
                    )}
                  </span>
                  <span style={{ color: 'var(--gold)', flexShrink: 0, marginLeft: 8 }}>
                    {formatNaira(item.qty * item.unit_price)}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                <span style={{ color: 'var(--muted)' }}>Total</span>
                <span style={{ color: 'var(--gold)' }}>{formatNaira(cartTotal)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              {/* Payment method */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Payment method</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['cash', 'Cash'], ['transfer', 'Transfer'], ['pos', 'POS']].map(([val, label]) => (
                    <button key={val} onClick={() => setPayMethod(val)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        border: `1px solid ${payMethod === val ? 'rgba(201,168,76,0.4)' : 'var(--mid)'}`,
                        background: payMethod === val ? 'var(--gold-dim)' : 'var(--navy)',
                        color: payMethod === val ? 'var(--gold)' : 'var(--muted)',
                        fontWeight: payMethod === val ? 500 : 400,
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount paid */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Amount paid (₦)</label>
                <input className="input" type="number" min="0" step="0.01"
                  value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                {balanceDue > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4, lineHeight: 1.5 }}>
                    Balance due: {formatNaira(balanceDue)}
                    {selectedCustomer
                      ? ' — an installment plan will be created for this customer (up to 5 payments).'
                      : ' — sale will be recorded as unpaid. Attach a customer to enable installment tracking.'}
                  </div>
                )}
                {change > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>
                    Change to give back: {formatNaira(change)}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Notes (optional)</label>
                <input className="input" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Customer discount applied" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(false)}>Cancel</button>
              <button className="btn-gold" style={{ flex: 2 }} onClick={handleCheckout} disabled={saving}>
                {saving ? 'Processing…' : `Confirm Sale · ${formatNaira(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
