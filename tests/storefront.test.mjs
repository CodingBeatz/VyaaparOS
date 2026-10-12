import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateStoreCart, filterStoreProducts, getListingState, normalizeOnlineListings,
  validateOnlineListing, StorefrontValidationError,
} from '../src/lib/storefront.ts'

const products = [
  { id: 'rice', shopId: 'shop', sku: 'RICE-01', name: 'Sona Masoori Rice', unit: 'bag', salePricePaise: 68500, costPricePaise: 0, taxRateBps: 0, stockQuantity: 8, lowStockThreshold: 2, active: true },
  { id: 'oil', shopId: 'shop', sku: 'OIL-01', name: 'Sunflower Oil', unit: 'bottle', salePricePaise: 14800, costPricePaise: 0, taxRateBps: 500, stockQuantity: 2, lowStockThreshold: 3, active: true },
  { id: 'soap', shopId: 'shop', sku: 'SOAP-01', name: 'Sandal Soap', unit: 'bar', salePricePaise: 4200, costPricePaise: 0, taxRateBps: 1800, stockQuantity: 0, lowStockThreshold: 1, active: true },
]
const listings = [
  { shopId: 'shop', productId: 'rice', published: true, description: 'Local rice', imageUrl: null, updatedAt: '2026-10-12T00:00:00.000Z' },
  { shopId: 'shop', productId: 'oil', published: true, description: 'Cooking oil', imageUrl: null, updatedAt: '2026-10-12T00:00:00.000Z' },
  { shopId: 'shop', productId: 'soap', published: false, description: '', imageUrl: null, updatedAt: '2026-10-12T00:00:00.000Z' },
]

test('listing state keeps unpublished distinct from published out-of-stock items', () => {
  assert.deepEqual(getListingState(products[2], listings[2]), { listing: 'Unpublished', stock: 'Out of stock' })
  assert.deepEqual(getListingState(products[2], { ...listings[2], published: true }), { listing: 'Published', stock: 'Out of stock' })
  assert.deepEqual(getListingState(products[1], listings[1]), { listing: 'Published', stock: 'Low stock' })
})

test('listing metadata validation and local snapshot normalization drop stale and unsafe listing data', () => {
  const valid = validateOnlineListing(products[0], { published: true, description: '  Basmati style  ', imageUrl: 'https://images.example/rice.jpg' })
  assert.equal(valid.description, 'Basmati style')
  assert.equal(valid.imageUrl, 'https://images.example/rice.jpg')
  assert.throws(() => validateOnlineListing(products[0], { published: true, description: '', imageUrl: 'javascript:alert(1)' }), StorefrontValidationError)
  const normalized = normalizeOnlineListings([
    { ...listings[0], imageUrl: 'javascript:alert(1)' },
    { ...listings[0], description: 'duplicate' },
    { ...listings[0], productId: 'removed-product' },
  ], products)
  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].imageUrl, null)
  assert.equal(normalizeOnlineListings(JSON.parse(JSON.stringify(normalized)), products)[0].productId, 'rice')
})

test('search and category filtering uses shared product and online listing data', () => {
  assert.deepEqual(filterStoreProducts(products, listings, 'local', 'All').map((product) => product.id), ['rice'])
  assert.deepEqual(filterStoreProducts(products, listings, '', 'Pantry', true).map((product) => product.id), ['oil'])
  assert.deepEqual(filterStoreProducts(products, listings, '', 'All', true).map((product) => product.id), ['rice', 'oil'])
})

test('cart uses integer paise, estimates tax, and rejects unavailable or over-stock quantities', () => {
  const cart = calculateStoreCart(products, listings, { rice: 1, oil: 2 })
  assert.equal(cart.subtotalPaise, 98_100)
  assert.equal(cart.taxPaise, 1_480)
  assert.equal(cart.totalPaise, 99_580)
  assert.throws(() => calculateStoreCart(products, listings, { oil: 3 }), /only 2 available/i)
  assert.throws(() => calculateStoreCart(products, [...listings, { ...listings[2], published: true }], { soap: 1 }), /out of stock/i)
  assert.throws(() => calculateStoreCart(products, listings, { rice: 1.5 }), /whole numbers/i)
})
