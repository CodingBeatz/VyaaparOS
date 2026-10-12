import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowRight, Check, Eye, EyeOff, Image as ImageIcon, Minus, Package, Plus, Search, ShoppingBag, Store, X } from 'lucide-react'
import { DemoNotice } from '../../components/ui/DemoStatus'
import { demoDataSource } from '../../lib/data/demoDataSource'
import { formatINR } from '../../lib/format'
import type { OnlineListing, Product } from '../../types/domain'
import { calculateStoreCart, filterStoreProducts, getListingState, getProductCategory, type OnlineListingDraft, type StoreCartSummary } from '../../lib/storefront'
import './store.css'

type StoreView = 'manage' | 'preview'
type ListingDialogState = { product: Product; listing?: OnlineListing } | null

export default function StorePage() {
  const [products, setProducts] = useState(() => demoDataSource.getProducts())
  const [listings, setListings] = useState(() => demoDataSource.getOnlineListings())
  const [view, setView] = useState<StoreView>('manage')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [dialog, setDialog] = useState<ListingDialogState>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const listingByProduct = useMemo(() => new Map(listings.map((listing) => [listing.productId, listing])), [listings])
  const categories = useMemo(() => ['All', ...new Set(products.map(getProductCategory))], [products])
  const visibleProducts = filterStoreProducts(products, listings, query, category, view === 'preview')
  const publishedCount = listings.filter((listing) => listing.published && products.some((product) => product.id === listing.productId && product.active)).length
  const hiddenCount = products.filter((product) => !listingByProduct.get(product.id)?.published).length
  const outOfStockCount = products.filter((product) => listingByProduct.get(product.id)?.published && product.stockQuantity <= 0).length
  const lowStockCount = products.filter((product) => product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold).length
  const cartResult = useMemo(() => {
    try { return { summary: calculateStoreCart(products, listings, cart), error: '' } }
    catch (cause) { return { summary: null, error: cause instanceof Error ? cause.message : 'Cart availability could not be checked.' } }
  }, [products, listings, cart])

  function refresh() {
    setProducts(demoDataSource.getProducts())
    setListings(demoDataSource.getOnlineListings())
  }

  function changeListing(product: Product, draft: OnlineListingDraft, success: string) {
    try {
      demoDataSource.setOnlineListing(product.id, draft)
      refresh()
      if (!draft.published) setCart((current) => { const next = { ...current }; delete next[product.id]; return next })
      setDialog(null)
      setError('')
      setNotice(success)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this online listing.')
      throw cause
    }
  }

  function toggleListing(product: Product) {
    const current = listingByProduct.get(product.id)
    const published = !(current?.published ?? false)
    try {
      changeListing(product, { published, description: current?.description ?? '', imageUrl: current?.imageUrl ?? '' }, published ? `${product.name} is published to the demo storefront.` : `${product.name} is hidden from the demo storefront.`)
    } catch { /* The form remains available and the page-level error explains why. */ }
  }

  function saveListing(product: Product, draft: OnlineListingDraft) {
    try {
      changeListing(product, draft, draft.published ? 'Online listing saved and published.' : 'Online listing details saved as unpublished.')
      return null
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'Could not save this listing.'
    }
  }

  function updateCart(productId: string, nextQuantity: number) {
    const next = { ...cart }
    if (nextQuantity <= 0) delete next[productId]
    else next[productId] = nextQuantity
    try {
      calculateStoreCart(products, listings, next)
      setCart(next)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This product is not available in the requested quantity.')
    }
  }

  function addToCart(product: Product) {
    updateCart(product.id, (cart[product.id] ?? 0) + 1)
  }

  const cartSummary: StoreCartSummary = cartResult.summary ?? { lines: [], subtotalPaise: 0, taxPaise: 0, totalPaise: 0 }

  return <div className="feature-page store-page">
    <div className="page-heading store-heading"><div><div className="eyebrow">YOUR SHOP, ONLINE <span className="eyebrow-dot" /> DEMO STOREFRONT</div><h1>Online Store</h1><p>Choose which inventory products appear in your customer-facing preview.</p></div><div className="store-status-pill"><span /> Preview only · not public</div></div>

    <section className="store-overview" aria-label="Store listing overview">
      <OverviewCard label="Published online" value={publishedCount} detail="Listings visible in preview" icon={Eye} tone="green" />
      <OverviewCard label="Not published" value={hiddenCount} detail="Hidden from the preview" icon={EyeOff} tone="gray" />
      <OverviewCard label="Out of stock" value={outOfStockCount} detail="Published but unavailable" icon={Package} tone="amber" />
      <OverviewCard label="Low stock" value={lowStockCount} detail="Based on Inventory thresholds" icon={ArrowDownRight} tone="blue" />
    </section>

    <div className="store-view-tabs" role="tablist" aria-label="Online store view"><button role="tab" aria-selected={view === 'manage'} className={view === 'manage' ? 'active' : ''} onClick={() => { setView('manage'); setError('') }}><Package size={15} /> Manage listings</button><button role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'active' : ''} onClick={() => { setView('preview'); setError('') }}><Eye size={15} /> Store preview <span>DEMO</span></button></div>
    {notice && <div className="store-notice" role="status">{notice}<button aria-label="Dismiss" onClick={() => setNotice('')}><X size={14} /></button></div>}
    {error && <div className="store-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={14} /></button></div>}

    {view === 'manage' ? <section className="store-manage panel">
      <div className="store-section-head"><div><span className="panel-kicker">SHARED INVENTORY CATALOG</span><h2>Product listings</h2><p>Product names, prices, and quantities come from Inventory. Listing edits won’t change them.</p></div><span className="store-product-count">{products.length} {products.length === 1 ? 'product' : 'products'}</span></div>
      <CatalogFilters query={query} setQuery={setQuery} category={category} setCategory={setCategory} categories={categories} />
      {visibleProducts.length ? <div className="store-product-table-wrap"><table className="store-product-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Online listing</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleProducts.map((product) => {
        const listing = listingByProduct.get(product.id)
        const state = getListingState(product, listing)
        return <tr key={product.id}><td><div className="store-product-cell"><ProductThumb product={product} listing={listing} /><span><strong>{product.name}</strong><small>{product.sku || 'No SKU'}</small></span></div></td><td>{getProductCategory(product)}</td><td className="store-price">{Number.isSafeInteger(product.salePricePaise) && product.salePricePaise >= 0 ? formatINR(product.salePricePaise) : 'Price unavailable'}</td><td><span className={`store-stock-label ${state.stock.toLowerCase().replaceAll(' ', '-')}`}>{product.stockQuantity} · {state.stock}</span></td><td><span className={`store-listing-label ${listing?.published ? 'published' : 'unpublished'}`}><i />{state.listing}{listing?.published && state.stock === 'Out of stock' ? ' · out of stock' : ''}</span></td><td><div className="store-row-actions"><button className="store-edit-action" onClick={() => { setError(''); setDialog({ product, listing }) }}>Edit details</button><button className={`store-toggle-action ${listing?.published ? 'is-published' : ''}`} onClick={() => toggleListing(product)}>{listing?.published ? 'Unpublish' : 'Publish'}</button></div></td></tr>
      })}</tbody></table></div> : <CatalogEmpty query={query} category={category} preview={false} />}
    </section> : <section className="store-preview-shell">
      <div className="store-preview-banner"><div className="store-preview-mark"><Store size={19} /></div><div><span>DEMO STOREFRONT PREVIEW</span><h2>Namma Provision Store</h2><p>Indiranagar, Bengaluru <i /> Shopping preview · no orders are placed</p></div><span className="preview-not-public">Private preview</span></div>
      <div className="store-preview-layout"><div className="store-browse">
        <div className="store-browse-heading"><div><span className="panel-kicker">SHOP OUR PICKS</span><h3>Everyday essentials</h3></div><span>{visibleProducts.length} {visibleProducts.length === 1 ? 'item' : 'items'}</span></div>
        <CatalogFilters query={query} setQuery={setQuery} category={category} setCategory={setCategory} categories={categories} preview />
        {visibleProducts.length ? <div className="storefront-product-grid">{visibleProducts.map((product) => {
          const listing = listingByProduct.get(product.id)!
          const quantity = cart[product.id] ?? 0
          const validPrice = Number.isSafeInteger(product.salePricePaise) && product.salePricePaise > 0
          const inStock = product.stockQuantity > 0
          return <article className="storefront-product-card" key={product.id}><ProductImage product={product} listing={listing} /><div className="storefront-product-details"><span className="storefront-category">{getProductCategory(product)}</span><h4>{product.name}</h4><p>{listing.description || <span className="storefront-no-description">No description added yet.</span>}</p><div className="storefront-stock-price"><span className={`storefront-stock ${inStock ? product.stockQuantity <= product.lowStockThreshold ? 'low' : 'available' : 'unavailable'}`}>{inStock ? product.stockQuantity <= product.lowStockThreshold ? `Only ${product.stockQuantity} left` : 'In stock' : 'Out of stock'}</span><strong>{validPrice ? formatINR(product.salePricePaise) : 'Price unavailable'}</strong></div><button className="storefront-add-button" disabled={!inStock || !validPrice || quantity >= product.stockQuantity} onClick={() => addToCart(product)}>{!inStock ? 'Out of stock' : quantity >= product.stockQuantity ? 'Stock limit reached' : <><Plus size={14} /> Add to cart</>}</button>{quantity > 0 && <div className="storefront-in-cart"><button aria-label={`Remove one ${product.name}`} onClick={() => updateCart(product.id, quantity - 1)}><Minus size={13} /></button><span>{quantity} in cart</span><button aria-label={`Add one ${product.name}`} disabled={quantity >= product.stockQuantity} onClick={() => updateCart(product.id, quantity + 1)}><Plus size={13} /></button></div>}</div></article>
        })}</div> : <CatalogEmpty query={query} category={category} preview />}
      </div>
      <aside className="store-cart panel"><div className="store-cart-heading"><div><span className="panel-kicker">DEMO CART</span><h3>Your basket</h3></div><span className="store-cart-count">{cartSummary.lines.reduce((sum, line) => sum + line.quantity, 0)}</span></div>
        {cartResult.error && <p className="store-cart-error" role="alert">{cartResult.error}</p>}
        {cartSummary.lines.length ? <><div className="store-cart-lines">{cartSummary.lines.map((line) => <div className="store-cart-line" key={line.product.id}><span className="store-cart-item"><strong>{line.product.name}</strong><small>{line.quantity} × {formatINR(line.product.salePricePaise)}</small></span><span className="store-cart-line-total">{formatINR(line.subtotalPaise)}<button aria-label={`Remove ${line.product.name} from cart`} onClick={() => updateCart(line.product.id, 0)}><X size={13} /></button></span><div className="store-cart-stepper"><button aria-label={`Decrease ${line.product.name}`} onClick={() => updateCart(line.product.id, line.quantity - 1)}><Minus size={12} /></button><span>{line.quantity}</span><button aria-label={`Increase ${line.product.name}`} disabled={line.quantity >= line.product.stockQuantity} onClick={() => updateCart(line.product.id, line.quantity + 1)}><Plus size={12} /></button></div></div>)}</div><div className="store-cart-totals"><div><span>Subtotal</span><strong>{formatINR(cartSummary.subtotalPaise)}</strong></div><div><span>Estimated tax</span><strong>{formatINR(cartSummary.taxPaise)}</strong></div><div className="store-cart-total"><span>Estimated total</span><strong>{formatINR(cartSummary.totalPaise)}</strong></div></div></> : <div className="store-cart-empty"><span><ShoppingBag size={19} /></span><strong>Your basket is empty</strong><small>Add an in-stock published item to preview a basket.</small></div>}
        <button className="store-demo-checkout" disabled><span>Demo checkout unavailable</span><ArrowRight size={15} /></button><p className="store-cart-caption">Preview only. No payment or order is collected.</p>
      </aside></div>
    </section>}

    <DemoNotice>Demo storefront only. Product listings are private to this browser preview. Cart totals are estimates, and checkout does not place an order or collect payment.</DemoNotice>
    {dialog && <ListingDialog product={dialog.product} listing={dialog.listing} onClose={() => setDialog(null)} onSave={saveListing} />}
  </div>
}

function OverviewCard({ label, value, detail, icon: Icon, tone }: { label: string; value: number; detail: string; icon: typeof Store; tone: string }) {
  return <article className="store-overview-card"><div><span>{label}</span><i className={tone}><Icon size={16} /></i></div><strong>{value.toLocaleString('en-IN')}</strong><small>{detail}</small></article>
}

function CatalogFilters({ query, setQuery, category, setCategory, categories, preview = false }: { query: string; setQuery: (value: string) => void; category: string; setCategory: (value: string) => void; categories: string[]; preview?: boolean }) {
  return <div className={`store-catalog-filters ${preview ? 'preview-filters' : ''}`}><label><Search size={15} /><input aria-label="Search online products" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or SKU" /></label><div className="store-category-tabs" aria-label="Product category filters">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
}

function CatalogEmpty({ query, category, preview }: { query: string; category: string; preview: boolean }) {
  return <div className="store-empty"><span><ShoppingBag size={21} /></span><strong>{preview ? 'No published products to show' : 'No products match these filters'}</strong><small>{preview ? 'Publish products from Manage listings to populate your private preview.' : query || category !== 'All' ? 'Try a different search or category.' : 'Add products in Inventory before managing online listings.'}</small></div>
}

function ProductThumb({ product, listing }: { product: Product; listing?: OnlineListing }) {
  return <span className="store-product-thumb"><span>{product.name.slice(0, 1).toUpperCase()}</span>{listing?.imageUrl && <img src={listing.imageUrl} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</span>
}

function ProductImage({ product, listing }: { product: Product; listing: OnlineListing }) {
  const [failed, setFailed] = useState(false)
  return <div className="storefront-product-image">{listing.imageUrl && !failed ? <img src={listing.imageUrl} alt={product.name} loading="lazy" onError={() => setFailed(true)} /> : <div className={`storefront-image-placeholder placeholder-${getProductCategory(product).toLowerCase().replaceAll(' ', '-')}`}><ImageIcon size={24} /><span>{product.name.slice(0, 1).toUpperCase()}</span></div>}<span>{getProductCategory(product)}</span></div>
}

function ListingDialog({ product, listing, onClose, onSave }: { product: Product; listing?: OnlineListing; onClose: () => void; onSave: (product: Product, draft: OnlineListingDraft) => string | null }) {
  const [published, setPublished] = useState(listing?.published ?? false)
  const [description, setDescription] = useState(listing?.description ?? '')
  const [imageUrl, setImageUrl] = useState(listing?.imageUrl ?? '')
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = onSave(product, { published, description, imageUrl })
    if (result) setError(result)
  }

  return <div className="store-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="store-listing-dialog" role="dialog" aria-modal="true" aria-labelledby="listing-dialog-title"><div className="store-dialog-head"><div><span className="panel-kicker">ONLINE LISTING DETAILS</span><h2 id="listing-dialog-title">{product.name}</h2><p>Inventory prices and quantities stay unchanged.</p></div><button aria-label="Close listing details" onClick={onClose}><X size={18} /></button></div><form onSubmit={submit} noValidate><div className="store-dialog-product"><div><span>Current selling price</span><strong>{Number.isSafeInteger(product.salePricePaise) && product.salePricePaise >= 0 ? formatINR(product.salePricePaise) : 'Price unavailable'}</strong></div><div><span>Current inventory</span><strong>{product.stockQuantity} {product.unit}</strong></div></div><label className="store-dialog-field">Product description <span>optional · up to 600 characters</span><textarea rows={4} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe this item for shoppers" /></label><label className="store-dialog-field">Display image URL <span>optional · http or https</span><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/product.jpg" /></label><label className="store-publish-toggle"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span><strong>{published ? 'Published in preview' : 'Keep unpublished'}</strong><small>{published ? 'Visible in the demo storefront. Out-of-stock status still blocks cart additions.' : 'Hidden from the storefront preview.'}</small></span></label>{error && <div className="store-error" role="alert">{error}</div>}<div className="store-dialog-actions"><button type="button" className="store-cancel-button" onClick={onClose}>Cancel</button><button className="store-save-button" type="submit"><Check size={15} /> Save listing</button></div></form></section></div>
}
