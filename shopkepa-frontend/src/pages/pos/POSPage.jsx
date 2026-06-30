import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Plus, Minus, Trash2, X, AlertCircle, ShoppingCart, Check, Printer } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { productsAPI, salesAPI, modulesAPI, branchesAPI, customersAPI } from '../../api/client'
import { formatNaira, parseApiError } from '../../utils/format'
import { printSaleReceipt } from '../../utils/printDoc'
import { useAuth } from '../../context/AuthContext'

export default function POSPage() {
  // Setup state
  const [branches, setBranches]         = useState([])
  const [activeModules, setActiveModules] = useState([])
  const [branchId, setBranchId]         = useState('')
  const [moduleId, setModuleId]         = useState('')
  const [setupDone, setSetupDone]       = useState(false)
  const [setupError, setSetupError]     = useState('')

  // Product search
  const [query, setQuery]               = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]       = useState(false)
  const searchTimer                     = useRef(null)

  // Cart
  const [cart, setCart]                 = useState([]) // [{product, qty, unit_price, price_type}]

  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [customers, setCustomers]       = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerList, setShowCustomerList] = useState(false)

  // Checkout
  const [modal, setModal]               = useState(false)
  const [payMethod, setPayMethod]       = useState('cash')
  const [amountPaid, setAmountPaid]     = useState('')
  const [notes, setNotes]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [saleError, setSaleError]       = useState('')
  const [success, setSuccess]           = useState(null)

  useEffect(() => {
    Promise.all([branchesAPI.list(), modulesAPI.active()])
      .then(([bRes, mRes]) => {
        const bRaw = bRes.data
        const mRaw = mRes.data
        const bs = Array.isArray(bRaw) ? bRaw : (bRaw.results ?? [])
        const ms = mRaw.filter(bm => bm.is_active)
        setBranches(bs)
        setActiveModules(ms)
        if (bs.length === 1) setBranchId(bs[0].id)
        if (ms.length === 1) setModuleId(ms[0].module.id)
      })
      .catch(() => setSetupError('Could not load branches/modules. Check your connection.'))
  }, [])

  const confirmSetup = () => {
    if (!branchId) { setSetupError('Select a branch'); return }
    if (!moduleId) { setSetupError('Select a module'); return }
    setSetupError('')
    setSetupDone(true)
  }

  // Debounced product search
  useEffect(() => {
    if (!setupDone || !query.trim()) { setSearchResults([]); return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await productsAPI.list({
          search: query.trim(),
          branch_id: branchId,
          is_active: true,
        })
        const raw = res.data
        setSearchResults((Array.isArray(raw) ? raw : (raw.results ?? [])).slice(0, 10))
      } catch { setSearchResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [query, setupDone, branchId])

  const addToCart = (product) => {
    setCart(c => {
      const existing = c.find(i => i.product.id === product.id)
      if (existing) {
        return c.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...c, {
        product,
        qty: 1,
        unit_price: parseFloat(product.retail_price),
        price_type: 'retail',
      }]
    })
    setQuery('')
    setSearchResults([])
  }

  const updateQty = (productId, delta) => {
    setCart(c =>
      c.map(i => i.product.id === productId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    )
  }

  const removeFromCart = (productId) => {
    setCart(c => c.filter(i => i.product.id !== productId))
  }

  const updatePrice = (productId, val) => {
    setCart(c =>
      c.map(i => i.product.id === productId ? { ...i, unit_price: parseFloat(val) || 0, price_type: 'custom' } : i)
    )
  }

  const cartTotal = cart.reduce((sum, i) => sum + i.qty * i.unit_price, 0)

  // Customer search
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

  const openCheckout = () => {
    if (cart.length === 0) return
    setAmountPaid(cartTotal.toFixed(2))
    setPayMethod('cash')
    setNotes('')
    setSaleError('')
    setModal(true)
  }

  const handleCheckout = async () => {
    setSaleError('')
    const paid = parseFloat(amountPaid)
    if (isNaN(paid) || paid < 0) { setSaleError('Enter a valid amount'); return }
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
        notes:           notes,
        discount_amount: 0,
      })
      setSuccess(res.data)
      setCart([])
      setSelectedCustomer(null)
      setModal(false)
    } catch (err) {
      setSaleError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Setup screen ──
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
              borderRadius: 'var(--r-sm)', padding: '10px 14px',
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
                  No active modules. Enable modules in Settings first.
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

  const { user } = useAuth()

  // ── Success banner ──
  const SuccessBanner = success && (
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
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => printSaleReceipt(success, user?.business_name)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)',
            color: 'var(--gold)',
          }}
        >
          <Printer size={13} /> Print Receipt
        </button>
        <button onClick={() => setSuccess(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
          <X size={15} />
        </button>
      </div>
    </div>
  )

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--light)' }}>POS</h1>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setSetupDone(false)}>
          Change Branch/Module
        </button>
      </div>

      {SuccessBanner}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

        {/* Left: Product search */}
        <div>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              className="input"
              placeholder="Search products by name or SKU…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ paddingLeft: 34, fontSize: 15 }}
              autoFocus
            />
          </div>

          {/* Results dropdown */}
          {(searchResults.length > 0 || searching) && (
            <div style={{
              background: 'var(--blue)', border: '1px solid var(--mid)',
              borderRadius: 8, overflow: 'hidden', marginBottom: 12,
            }}>
              {searching ? (
                <p style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 13 }}>Searching…</p>
              ) : (
                searchResults.map(p => {
                  const stock = typeof p.stock === 'number' ? p.stock
                    : Array.isArray(p.stock) ? p.stock.find(s => s.branch?.toString() === branchId)?.quantity_in_stock ?? '?'
                    : '?'
                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      style={{
                        width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                        borderBottom: '1px solid var(--mid)', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, color: 'var(--light)', fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          SKU: {p.sku || '—'} · Stock: {stock}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                        {formatNaira(p.retail_price)}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}

          {/* Customer selector */}
          <div style={{
            background: 'var(--blue)', border: '1px solid var(--mid)',
            borderRadius: 8, padding: '14px 16px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Customer (optional)</div>
            {selectedCustomer ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--light)', fontWeight: 500 }}>{selectedCustomer.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedCustomer.phone_number}</div>
                </div>
                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  placeholder="Search customer…"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  style={{ fontSize: 13 }}
                />
                {showCustomerList && customers.length > 0 && (
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
                        }}>
                        <div style={{ fontSize: 13, color: 'var(--light)' }}>{c.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.phone_number}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div style={{
          background: 'var(--blue)', border: '1px solid var(--mid)',
          borderRadius: 10, padding: 16, position: 'sticky', top: 72,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ShoppingCart size={15} color="var(--gold)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--light)' }}>Cart</span>
            {cart.length > 0 && (
              <span style={{
                background: 'var(--gold)', color: 'var(--navy)',
                fontSize: 11, fontWeight: 700, borderRadius: 10,
                padding: '1px 7px', marginLeft: 'auto',
              }}>{cart.length}</span>
            )}
          </div>

          {cart.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              Search for products to add them here.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', marginBottom: 12 }}>
                {cart.map(item => (
                  <div key={item.product.id} style={{
                    background: 'var(--navy)', borderRadius: 6, padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontSize: 13, color: 'var(--light)', fontWeight: 500, flex: 1, minWidth: 0 }}>
                        {item.product.name}
                      </div>
                      <button onClick={() => removeFromCart(item.product.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => updateQty(item.product.id, -1)}
                          style={{ background: 'var(--mid)', border: 'none', color: 'var(--light)', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Minus size={11} />
                        </button>
                        <span style={{ fontSize: 13, color: 'var(--light)', minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => updateQty(item.product.id, 1)}
                          style={{ background: 'var(--mid)', border: 'none', color: 'var(--light)', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={11} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>₦</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={item.unit_price}
                          onChange={e => updatePrice(item.product.id, e.target.value)}
                          style={{
                            width: 80, padding: '3px 6px', borderRadius: 4, fontSize: 13,
                            background: 'var(--blue)', border: '1px solid var(--mid)',
                            color: 'var(--gold)', fontWeight: 500, textAlign: 'right',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Subtotal: {formatNaira(item.qty * item.unit_price)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total & checkout */}
              <div style={{ borderTop: '1px solid var(--mid)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>Total</span>
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

      {/* Checkout modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: 16,
        }}>
          <div style={{
            background: 'var(--blue)', border: '1px solid var(--mid)',
            borderRadius: 12, padding: 24, width: '100%', maxWidth: 420,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--light)' }}>Complete Sale</h2>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {saleError && (
              <div style={{
                background: 'rgba(224,85,85,0.12)', border: '1px solid rgba(224,85,85,0.3)',
                borderRadius: 'var(--r-sm)', padding: '10px 14px',
                display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16,
              }}>
                <AlertCircle size={14} color="var(--error)" />
                <span style={{ fontSize: 13, color: 'var(--error)' }}>{saleError}</span>
              </div>
            )}

            {/* Items summary */}
            <div style={{
              background: 'var(--navy)', borderRadius: 8, padding: '12px 14px', marginBottom: 16,
              maxHeight: 200, overflowY: 'auto',
            }}>
              {cart.map(item => (
                <div key={item.product.id} style={{
                  display: 'flex', justifyContent: 'space-between', fontSize: 13,
                  padding: '4px 0', borderBottom: '1px solid var(--mid)',
                }}>
                  <span style={{ color: 'var(--light)' }}>{item.product.name} × {item.qty}</span>
                  <span style={{ color: 'var(--gold)' }}>{formatNaira(item.qty * item.unit_price)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                <span style={{ color: 'var(--muted)' }}>Total</span>
                <span style={{ color: 'var(--gold)' }}>{formatNaira(cartTotal)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
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

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Amount paid (₦)</label>
                <input className="input" type="number" min="0" step="0.01"
                  value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                {parseFloat(amountPaid) < cartTotal && parseFloat(amountPaid) >= 0 && (
                  <span style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3, display: 'block' }}>
                    Balance due: {formatNaira(cartTotal - parseFloat(amountPaid || 0))}
                  </span>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>Notes (optional)</label>
                <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Customer discount applied" />
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

      <style>{`
        @media (max-width: 768px) {
          .pos-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AppLayout>
  )
}
