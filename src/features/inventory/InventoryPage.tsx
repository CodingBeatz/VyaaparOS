import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, CircleAlert, Edit3, PackagePlus, Search, X } from 'lucide-react'
import { DemoNotice } from '../../components/ui/DemoStatus'
import { demoDataSource, DemoDataError, type ProductDraft } from '../../lib/data/demoDataSource'
import { formatINR } from '../../lib/format'
import { parseMoneyToPaise } from '../../lib/validation'
import type { Product } from '../../types/domain'
import '../../features/pos-inventory.css'

type Dialog = { type: 'product'; product: Product | null } | { type: 'stock'; product: Product } | null

export default function InventoryPage() {
  const [products, setProducts] = useState(() => demoDataSource.getProducts())
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState('')
  const visible = useMemo(() => products.filter((product) => `${product.name} ${product.sku ?? ''}`.toLowerCase().includes(query.toLowerCase().trim())), [products, query])
  const lowStock = products.filter((product) => product.stockQuantity <= product.lowStockThreshold).length
  const totalUnits = products.reduce((sum, product) => sum + product.stockQuantity, 0)

  function refresh() { setProducts(demoDataSource.getProducts()) }
  function saveProduct(form: ProductDraft, startingStock: number, productId?: string) {
    try {
      if (productId) demoDataSource.updateProduct(productId, form)
      else demoDataSource.addProduct(form, startingStock)
      refresh()
      setDialog(null)
      setNotice(productId ? 'Product details saved.' : 'Product added to your catalog.')
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not save product.'
    }
    return null
  }
  function saveAdjustment(productId: string, quantityDelta: number) {
    try {
      demoDataSource.adjustStock({ productId, quantityDelta })
      refresh()
      setDialog(null)
      setNotice('Stock adjustment recorded in the demo inventory.')
    } catch (error) {
      return error instanceof DemoDataError ? error.message : 'Could not update stock.'
    }
    return null
  }

  return <div className="feature-page inventory-page">
    <div className="page-heading pos-heading"><div><div className="eyebrow">PRODUCTS & STOCK <span className="eyebrow-dot" /> LIVE DEMO CATALOG</div><h1>Inventory</h1><p>Keep the catalog tidy and know what needs a restock.</p></div><button className="primary-button" onClick={() => setDialog({ type: 'product', product: null })}><PackagePlus size={16} /> Add product</button></div>
    <div className="inventory-stats"><div className="panel inventory-stat"><span className="inventory-stat-icon green"><Boxes size={17} /></span><div><span>Catalog products</span><strong>{products.length}</strong></div><small>active items</small></div><div className="panel inventory-stat"><span className="inventory-stat-icon blue"><ArrowDownToLine size={17} /></span><div><span>Units on hand</span><strong>{totalUnits.toLocaleString('en-IN')}</strong></div><small>across all items</small></div><div className="panel inventory-stat"><span className="inventory-stat-icon amber"><CircleAlert size={17} /></span><div><span>Need attention</span><strong>{lowStock}</strong></div><small>at or below threshold</small></div></div>
    {notice && <div className="inventory-notice" role="status"><span>✓</span>{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={14} /></button></div>}
    <div className="panel inventory-table-panel pos-inventory-panel"><div className="table-toolbar"><div><h2>Product list</h2><span>Catalog and stock for Namma Provision Store</span></div><label className="inventory-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" aria-label="Search inventory" /></label></div><div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Unit price</th><th>Stock</th><th>Stock status</th><th className="inventory-actions-heading">Actions</th></tr></thead><tbody>{visible.map((product) => {
      const low = product.stockQuantity <= product.lowStockThreshold
      return <tr key={product.id}><td><div className="table-product"><div className="product-thumb">{product.name.charAt(0)}</div><div className="inventory-product-copy"><strong>{product.name}</strong><small>Cost {formatINR(product.costPricePaise)} · GST {(product.taxRateBps / 100).toFixed(product.taxRateBps % 100 ? 2 : 0)}%</small></div></div></td><td>{product.sku || <span className="muted">—</span>}</td><td><strong className="table-price">{formatINR(product.salePricePaise)}</strong><small className="table-unit">per {product.unit}</small></td><td><strong>{product.stockQuantity}</strong> <span className="muted">{product.unit}</span></td><td><span className={`status-pill ${low ? 'status-low' : 'status-good'}`}><i />{low ? `Low · min ${product.lowStockThreshold}` : 'In stock'}</span></td><td><div className="inventory-row-actions"><button className="select-button" onClick={() => setDialog({ type: 'stock', product })} title="Adjust stock"><ArrowUpFromLine size={14} /><span>Adjust</span></button><button className="inventory-edit-button" aria-label={`Edit ${product.name}`} title="Edit product" onClick={() => setDialog({ type: 'product', product })}><Edit3 size={15} /></button></div></td></tr>
    })}{visible.length === 0 && <tr><td colSpan={6}><div className="inventory-no-results">No products match “{query}”.</div></td></tr>}</tbody></table></div></div>
    <DemoNotice>Inventory and POS share this browser’s demo catalog. Changes persist in local storage only; they are not saved to a live database.</DemoNotice>
    {dialog?.type === 'product' && <ProductDialog product={dialog.product} onClose={() => setDialog(null)} onSave={saveProduct} />}
    {dialog?.type === 'stock' && <StockDialog product={dialog.product} onClose={() => setDialog(null)} onSave={saveAdjustment} />}
  </div>
}

function ProductDialog({ product, onClose, onSave }: { product: Product | null; onClose: () => void; onSave: (draft: ProductDraft, stock: number, productId?: string) => string | null }) {
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [unit, setUnit] = useState(product?.unit ?? '')
  const [price, setPrice] = useState(product ? (product.salePricePaise / 100).toFixed(2) : '')
  const [cost, setCost] = useState(product ? (product.costPricePaise / 100).toFixed(2) : '')
  const [tax, setTax] = useState(product ? String(product.taxRateBps / 100) : '0')
  const [threshold, setThreshold] = useState(product ? String(product.lowStockThreshold) : '5')
  const [stock, setStock] = useState('0')
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const pricePaise = parseMoneyToPaise(price)
    const costPaise = parseMoneyToPaise(cost)
    const taxRateBps = parseMoneyToPaise(tax)
    const parsedThreshold = Number(threshold)
    const parsedStock = Number(stock)
    if (pricePaise === null || costPaise === null) { setError('Enter valid prices with up to two decimal places.'); return }
    if (taxRateBps === null || taxRateBps > 10_000) { setError('Enter a valid GST rate between 0 and 100%.'); return }
    if (!Number.isInteger(parsedThreshold) || parsedThreshold < 0) { setError('Low-stock threshold must be a whole number of zero or more.'); return }
    if (!product && (!Number.isInteger(parsedStock) || parsedStock < 0)) { setError('Starting stock must be a non-negative whole number.'); return }
    const message = onSave({ name, sku: sku || null, unit, salePricePaise: pricePaise, costPricePaise: costPaise, taxRateBps, lowStockThreshold: parsedThreshold }, product ? product.stockQuantity : parsedStock, product?.id)
    if (message) setError(message)
  }
  return <div className="receipt-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title"><div className="inventory-dialog-head"><div><span className="panel-kicker">CATALOG</span><h2 id="product-dialog-title">{product ? 'Edit product' : 'Add a product'}</h2></div><button className="receipt-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div><form onSubmit={submit}><div className="inventory-form-grid"><label>Product name<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Toor Dal" /></label><label>SKU <span>optional</span><input maxLength={40} value={sku} onChange={(event) => setSku(event.target.value)} placeholder="e.g. DAL-014" /></label><label>Unit<input required maxLength={40} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="e.g. 1 kg pack" /></label><label>Sale price (₹)<input required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></label><label>Cost price (₹)<input required inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="0.00" /></label><label>GST rate (%)<input required inputMode="decimal" value={tax} onChange={(event) => setTax(event.target.value)} placeholder="0" /></label><label>Low-stock alert at<input required inputMode="numeric" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>{!product && <label>Starting stock<input required inputMode="numeric" value={stock} onChange={(event) => setStock(event.target.value)} /></label>}</div>{error && <div className="pos-error" role="alert">{error}</div>}<div className="inventory-dialog-actions"><button type="button" className="select-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{product ? 'Save changes' : 'Add to inventory'}</button></div></form></section></div>
}

function StockDialog({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (productId: string, delta: number) => string | null }) {
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [quantity, setQuantity] = useState('1')
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const count = Number(quantity)
    if (!Number.isInteger(count) || count <= 0) { setError('Enter a positive whole-number quantity.'); return }
    const message = onSave(product.id, direction === 'in' ? count : -count)
    if (message) setError(message)
  }
  return <div className="receipt-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="inventory-dialog stock-dialog" role="dialog" aria-modal="true" aria-labelledby="stock-dialog-title"><div className="inventory-dialog-head"><div><span className="panel-kicker">STOCK ADJUSTMENT</span><h2 id="stock-dialog-title">{product.name}</h2><p>Current stock: <strong>{product.stockQuantity} {product.unit}</strong></p></div><button className="receipt-close" onClick={onClose} aria-label="Close"><X size={18} /></button></div><form onSubmit={submit}><div className="stock-direction" role="group" aria-label="Adjustment direction"><button type="button" className={direction === 'in' ? 'selected' : ''} onClick={() => setDirection('in')}><ArrowDownToLine size={15} /> Add stock</button><button type="button" className={direction === 'out' ? 'selected' : ''} onClick={() => setDirection('out')}><ArrowUpFromLine size={15} /> Remove stock</button></div><label className="dialog-field">Quantity<input autoFocus inputMode="numeric" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>{error && <div className="pos-error" role="alert">{error}</div>}<div className="inventory-dialog-actions"><button type="button" className="select-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Record adjustment</button></div></form></section></div>
}
