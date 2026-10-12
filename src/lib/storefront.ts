import type { OnlineListing, Product } from '../types/domain'

export interface OnlineListingDraft {
  published: boolean
  description: string
  imageUrl: string
}

export interface StoreCartLine {
  product: Product
  listing: OnlineListing
  quantity: number
  subtotalPaise: number
  taxPaise: number
}

export interface StoreCartSummary {
  lines: StoreCartLine[]
  subtotalPaise: number
  taxPaise: number
  totalPaise: number
}

export class StorefrontValidationError extends Error {}

export function isValidStoreImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

export function normalizeOnlineListings(value: unknown, products: Product[]): OnlineListing[] {
  if (!Array.isArray(value)) return []
  const activeProducts = new Map(products.filter((product) => product && typeof product.id === 'string' && product.active).map((product) => [product.id, product]))
  const seen = new Set<string>()
  const normalized: OnlineListing[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const entry = raw as Partial<OnlineListing>
    if (typeof entry.productId !== 'string' || seen.has(entry.productId) || typeof entry.published !== 'boolean') continue
    const product = activeProducts.get(entry.productId)
    if (!product || entry.shopId !== product.shopId) continue
    const description = typeof entry.description === 'string' ? entry.description.trim().slice(0, 600) : ''
    const rawImage = typeof entry.imageUrl === 'string' ? entry.imageUrl.trim() : ''
    const imageUrl = rawImage && isValidStoreImageUrl(rawImage) ? rawImage : null
    normalized.push({
      shopId: product.shopId,
      productId: product.id,
      published: entry.published && Number.isSafeInteger(product.salePricePaise) && product.salePricePaise > 0,
      description,
      imageUrl,
      updatedAt: typeof entry.updatedAt === 'string' && Number.isFinite(Date.parse(entry.updatedAt)) ? entry.updatedAt : new Date(0).toISOString(),
    })
    seen.add(entry.productId)
  }
  return normalized
}

export function validateOnlineListing(product: Product, draft: OnlineListingDraft): OnlineListing {
  if (!product.active || !product.name.trim()) throw new StorefrontValidationError('This product is not available for online listing.')
  if (draft.published && (!Number.isSafeInteger(product.salePricePaise) || product.salePricePaise <= 0)) {
    throw new StorefrontValidationError('Set a valid selling price in Inventory before publishing this product.')
  }
  const description = draft.description.trim()
  if (description.length > 600) throw new StorefrontValidationError('Description must be 600 characters or fewer.')
  const imageValue = draft.imageUrl.trim()
  if (imageValue && !isValidStoreImageUrl(imageValue)) throw new StorefrontValidationError('Enter a valid http or https image URL.')
  return {
    shopId: product.shopId,
    productId: product.id,
    published: draft.published,
    description,
    imageUrl: imageValue || null,
    updatedAt: new Date().toISOString(),
  }
}

export function getProductCategory(product: Pick<Product, 'sku' | 'name'>): string {
  const key = `${product.sku ?? ''} ${product.name}`.toLowerCase()
  if (/rice|dal|grain|atta|flour|pulse/.test(key)) return 'Staples'
  if (/oil|coffee|tea|spice|masala|sugar|salt/.test(key)) return 'Pantry'
  if (/soap|shampoo|wash|detergent/.test(key)) return 'Personal care'
  return 'Other'
}

export function getListingState(product: Product, listing?: OnlineListing): { listing: 'Published' | 'Unpublished'; stock: 'Out of stock' | 'Low stock' | 'In stock' } {
  const stock = product.stockQuantity <= 0 ? 'Out of stock' : product.stockQuantity <= product.lowStockThreshold ? 'Low stock' : 'In stock'
  return { listing: listing?.published ? 'Published' : 'Unpublished', stock }
}

export function filterStoreProducts(products: Product[], listings: OnlineListing[], query: string, category: string, publishedOnly = false): Product[] {
  const listingByProduct = new Map(listings.map((listing) => [listing.productId, listing]))
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return products.filter((product) => {
    if (!product.active || (publishedOnly && !listingByProduct.get(product.id)?.published)) return false
    const listing = listingByProduct.get(product.id)
    const text = `${product.name} ${product.sku ?? ''} ${listing?.description ?? ''}`.toLocaleLowerCase()
    return (!normalizedQuery || text.includes(normalizedQuery)) && (category === 'All' || getProductCategory(product) === category)
  })
}

function taxFor(subtotalPaise: number, taxRateBps: number): number {
  if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise < 0 || !Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10_000) {
    throw new StorefrontValidationError('Product price or tax information is invalid.')
  }
  const tax = Number((BigInt(subtotalPaise) * BigInt(taxRateBps) + 5_000n) / 10_000n)
  if (!Number.isSafeInteger(tax)) throw new StorefrontValidationError('This cart total is too large to calculate safely.')
  return tax
}

export function calculateStoreCart(products: Product[], listings: OnlineListing[], quantities: Record<string, number>): StoreCartSummary {
  const listingByProduct = new Map(listings.map((listing) => [listing.productId, listing]))
  const lines: StoreCartLine[] = []
  for (const [productId, quantity] of Object.entries(quantities)) {
    if (quantity === 0) continue
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new StorefrontValidationError('Cart quantities must be positive whole numbers.')
    const product = products.find((item) => item.id === productId && item.active)
    const listing = listingByProduct.get(productId)
    if (!product || !listing?.published) throw new StorefrontValidationError('A cart product is no longer published.')
    if (!Number.isSafeInteger(product.stockQuantity) || product.stockQuantity < 0 || product.stockQuantity === 0) {
      throw new StorefrontValidationError(`${product.name} is out of stock and cannot be added.`)
    }
    if (quantity > product.stockQuantity) throw new StorefrontValidationError(`${product.name}: only ${product.stockQuantity} available.`)
    if (!Number.isSafeInteger(product.salePricePaise) || product.salePricePaise <= 0) throw new StorefrontValidationError(`${product.name} does not have a valid selling price.`)
    const subtotalPaise = product.salePricePaise * quantity
    if (!Number.isSafeInteger(subtotalPaise)) throw new StorefrontValidationError('This cart total is too large to calculate safely.')
    const taxPaise = taxFor(subtotalPaise, product.taxRateBps)
    lines.push({ product, listing, quantity, subtotalPaise, taxPaise })
  }
  const subtotalPaise = lines.reduce((sum, line) => sum + line.subtotalPaise, 0)
  const taxPaise = lines.reduce((sum, line) => sum + line.taxPaise, 0)
  const totalPaise = subtotalPaise + taxPaise
  if (![subtotalPaise, taxPaise, totalPaise].every(Number.isSafeInteger)) throw new StorefrontValidationError('This cart total is too large to calculate safely.')
  return { lines, subtotalPaise, taxPaise, totalPaise }
}
