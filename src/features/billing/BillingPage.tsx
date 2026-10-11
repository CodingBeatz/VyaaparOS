import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Minus, Plus, Printer, Search, ShoppingBag, Trash2, UserRound, X } from 'lucide-react'
import { DemoNotice } from '../../components/ui/DemoStatus'
import { demoDataSource, DemoDataError } from '../../lib/data/demoDataSource'
import { demoShop } from '../../lib/data/demo'
import { formatDate, formatINR } from '../../lib/format'
import type { ProcessSaleInput } from '../../types/domain'
import '../../features/pos-inventory.css'

type Cart = Record<string, number>

function categoryFor(sku: string | null, name: string): string {
  const key = `${sku ?? ''} ${name}`.toLowerCase()
  if (/rice|dal|grain|atta|flour|pulse/.test(key)) return 'Staples'
  if (/oil|coffee|tea|spice|masala|sugar|salt/.test(key)) return 'Pantry'
  if (/soap|shampoo|wash|detergent/.test(key)) return 'Personal care'
  return 'Other'
}

function safeTaxFor(subtotalPaise: number, taxRateBps: number): number {
  return Number((BigInt(subtotalPaise) * BigInt(taxRateBps) + 5_000n) / 10_000n)
}

export default function BillingPage() {
  const [products, setProducts] = useState(() => demoDataSource.getProducts())
  const [customers, setCustomers] = useState(() => demoDataSource.getCustomers())
  const [cart, setCart] = useState<Cart>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [customerId, setCustomerId] = useState('')
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID())

  const categories = useMemo(() => ['All', ...new Set(products.map((product) => categoryFor(product.sku, product.name)))], [products])
  const filteredProducts = products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku ?? ''}`.toLowerCase().includes(query.toLowerCase().trim())
    return product.active && matchesQuery && (category === 'All' || categoryFor(product.sku, product.name) === category)
  })
  const cartLines = Object.entries(cart).flatMap(([productId, quantity]) => {
    const product = products.find((item) => item.id === productId)
    if (!product || quantity <= 0) return []
    const lineSubtotal = product.salePricePaise * quantity
    return [{ product, quantity, subtotal: lineSubtotal, tax: safeTaxFor(lineSubtotal, product.taxRateBps) }]
  })
  const subtotal = cartLines.reduce((sum, line) => sum + line.subtotal, 0)
  const tax = cartLines.reduce((sum, line) => sum + line.tax, 0)
  const total = subtotal + tax

  function refreshCatalog() {
    setProducts(demoDataSource.getProducts())
    setCustomers(demoDataSource.getCustomers())
  }

  function addToCart(productId: string) {
    const product = products.find((item) => item.id === productId)
    if (!product || product.stockQuantity <= 0) return
    const maxQuantity = product.salePricePaise > 0 ? Math.min(product.stockQuantity, Math.floor(Number.MAX_SAFE_INTEGER / product.salePricePaise)) : product.stockQuantity
    if ((cart[productId] ?? 0) >= maxQuantity) {
      setError(`${product.name} is at the maximum safe quantity for this bill.`)
      return
    }
    setError('')
    setCart((current) => ({ ...current, [productId]: (current[productId] ?? 0) + 1 }))
  }

  function changeQuantity(productId: string, delta: number) {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    setCart((current) => {
      const quantity = (current[productId] ?? 0) + delta
      if (quantity <= 0) {
        const next = { ...current }
        delete next[productId]
        return next
      }
      const maxQuantity = product.salePricePaise > 0 ? Math.min(product.stockQuantity, Math.floor(Number.MAX_SAFE_INTEGER / product.salePricePaise)) : product.stockQuantity
      return { ...current, [productId]: Math.min(quantity, maxQuantity) }
    })
  }

  function checkout() {
    if (checkingOut || cartLines.length === 0) return
    setCheckingOut(true)
    setError('')
    try {
      const input: ProcessSaleInput = {
        shopId: 'demo-shop', customerId: customerId || null, source: 'pos', idempotencyKey: checkoutKey,
        items: cartLines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      }
      const result = demoDataSource.completeSale(input)
      refreshCatalog()
      setCart({})
      setCustomerId('')
      setCheckoutKey(crypto.randomUUID())
      setReceiptId(result.saleId)
    } catch (cause) {
      setError(cause instanceof DemoDataError ? cause.message : 'Checkout could not be completed. Please try again.')
      refreshCatalog()
    } finally {
      setCheckingOut(false)
    }
  }

  const receipt = receiptId ? demoDataSource.getSaleReceipt(receiptId) : null

  return <div className="feature-page pos-page">
    <div className="page-heading pos-heading"><div><div className="eyebrow">COUNTER CHECKOUT <span className="eyebrow-dot" /> DEMO REGISTER</div><h1>Billing / POS</h1><p>Build a bill, attach a regular and keep the shelf count in sync.</p></div><div className="register-status"><i /> Register ready</div></div>
    <div className="pos-workspace">
      <section className="pos-catalog panel" aria-label="Product catalog">
        <div className="pos-catalog-head"><div><span className="panel-kicker">Namma Provision Store</span><h2>Choose products</h2></div><span className="catalog-count">{filteredProducts.length} items</span></div>
        <label className="pos-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or SKU" aria-label="Search products" /><kbd>⌘ K</kbd></label>
        <div className="category-tabs" role="tablist" aria-label="Product category">{categories.map((item) => <button key={item} role="tab" aria-selected={category === item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="product-grid">{filteredProducts.map((product) => {
          const inCart = cart[product.id] ?? 0
          const unavailable = product.stockQuantity === 0
          return <button className={`pos-product-card ${unavailable ? 'product-unavailable' : ''}`} key={product.id} disabled={unavailable} onClick={() => addToCart(product.id)}>
            <span className={`catalog-art art-${categoryFor(product.sku, product.name).toLowerCase().replace(' ', '-')}`}>{product.name.slice(0, 1)}</span>
            <span className="catalog-product-copy"><strong>{product.name}</strong><small>{product.unit} · {product.stockQuantity} available</small><b>{formatINR(product.salePricePaise)}</b></span>
            <span className="product-add"><Plus size={15} /></span>{inCart > 0 && <span className="in-cart-count">{inCart}</span>}
          </button>
        })}{filteredProducts.length === 0 && <div className="catalog-empty"><ShoppingBag size={24} /><strong>No products found</strong><span>Try another search or category.</span></div>}</div>
      </section>

      <aside className="pos-cart panel" aria-label="Current bill">
        <div className="cart-heading"><div><span className="panel-kicker">CURRENT SALE</span><h2>New bill <span className="cart-count">{cartLines.reduce((sum, line) => sum + line.quantity, 0)}</span></h2></div><button className="text-button" onClick={() => { setCart({}); setError('') }} disabled={!cartLines.length}>Clear</button></div>
        <label className="customer-select"><UserRound size={16} /><select aria-label="Select customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Walk-in customer</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} · {customer.loyaltyPoints} pts</option>)}</select></label>
        <div className="cart-lines">{cartLines.map(({ product, quantity, subtotal: lineSubtotal }) => <div className="cart-line" key={product.id}><span className="cart-line-icon">{product.name.charAt(0)}</span><div className="cart-line-copy"><strong>{product.name}</strong><small>{formatINR(product.salePricePaise)} / {product.unit}</small><div className="quantity-stepper"><button aria-label={`Decrease ${product.name}`} onClick={() => changeQuantity(product.id, -1)}><Minus size={12} /></button><span>{quantity}</span><button aria-label={`Increase ${product.name}`} onClick={() => changeQuantity(product.id, 1)} disabled={quantity >= (product.salePricePaise > 0 ? Math.min(product.stockQuantity, Math.floor(Number.MAX_SAFE_INTEGER / product.salePricePaise)) : product.stockQuantity)}><Plus size={12} /></button></div></div><div className="cart-line-total"><strong>{formatINR(lineSubtotal)}</strong><button aria-label={`Remove ${product.name}`} onClick={() => changeQuantity(product.id, -quantity)}><Trash2 size={14} /></button></div></div>)}{!cartLines.length && <div className="cart-empty"><span className="empty-bag"><ShoppingBag size={20} /></span><strong>Your bill is empty</strong><small>Choose an item to get started.</small></div>}</div>
        {error && <div className="pos-error" role="alert">{error}</div>}
        <div className="bill-totals"><div><span>Subtotal</span><strong>{formatINR(subtotal)}</strong></div><div><span>Estimated tax</span><strong>{formatINR(tax)}</strong></div><div className="bill-grand-total"><span>Total due</span><strong>{formatINR(total)}</strong></div></div>
        <button className="checkout-button" disabled={!cartLines.length || checkingOut} onClick={checkout}>{checkingOut ? 'Completing sale…' : <>Complete sale <span>{formatINR(total)} <ArrowLeft className="checkout-arrow" size={15} /></span></>}</button>
        <p className="checkout-caption">Demo checkout · no payment is collected</p>
      </aside>
    </div>
    <DemoNotice>Demo sale only. This browser records the bill and stock movement locally; no live payment or database transaction is connected.</DemoNotice>
    {receipt && <div className="receipt-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReceiptId(null) }}><section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><button className="receipt-close" aria-label="Close receipt" onClick={() => setReceiptId(null)}><X size={18} /></button><div className="receipt-success"><span><Check size={21} /></span></div><div className="receipt-title"><span className="panel-kicker">SALE COMPLETE</span><h2 id="receipt-title">Bill is ready</h2><p>Stock has been updated in demo mode.</p></div><div className="receipt-paper"><div className="receipt-shop"><strong>{demoShop.name}</strong><span>{demoShop.location}</span></div><div className="receipt-meta"><span>{receipt.sale.invoiceNumber}</span><span>{formatDate(receipt.sale.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></div>{receipt.customer && <div className="receipt-customer">Customer <strong>{receipt.customer.name}</strong></div>}{receipt.items.map((item) => <div className="receipt-item" key={item.id}><span>{item.quantity} × {item.productNameSnapshot}</span><strong>{formatINR(item.lineSubtotalPaise)}</strong></div>)}<div className="receipt-item"><span>Subtotal</span><strong>{formatINR(receipt.sale.subtotalPaise)}</strong></div><div className="receipt-item"><span>Estimated tax</span><strong>{formatINR(receipt.sale.taxPaise)}</strong></div>{receipt.sale.discountPaise > 0 && <div className="receipt-item"><span>Discount</span><strong>−{formatINR(receipt.sale.discountPaise)}</strong></div>}<div className="receipt-total"><span>Total due</span><strong>{formatINR(receipt.sale.totalPaise)}</strong></div><div className="receipt-payment-note">Recorded as a demo sale · no payment provider</div></div><div className="receipt-actions"><button className="select-button" onClick={() => window.print()}><Printer size={15} /> Print receipt</button><button className="primary-button" onClick={() => setReceiptId(null)}>New bill</button></div></section></div>}
  </div>
}
