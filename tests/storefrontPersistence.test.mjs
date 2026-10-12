import test from 'node:test'
import assert from 'node:assert/strict'

const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
}
const snapshotKey = 'vyapaaros.pos-inventory.v1'
let loadCount = 0
async function loadSource() {
  const module = await import(`../src/lib/data/demoDataSource.ts?test-load=${loadCount++}`)
  return module.demoDataSource
}

test('publish state and listing details persist without changing inventory product fields', async () => {
  let source = await loadSource()
  const productBefore = source.getProducts().find((product) => product.id === 'p1')
  const listing = source.setOnlineListing('p1', { published: true, description: 'Fresh local rice', imageUrl: 'https://images.example/rice.jpg' })
  assert.equal(listing.published, true)

  source = await loadSource()
  assert.deepEqual(source.getOnlineListings().map((item) => ({ published: item.published, description: item.description })), [{ published: true, description: 'Fresh local rice' }])
  const productAfter = source.getProducts().find((product) => product.id === 'p1')
  assert.equal(productAfter.salePricePaise, productBefore.salePricePaise)
  assert.equal(productAfter.stockQuantity, productBefore.stockQuantity)
})

test('unpublish and invalid localStorage listing metadata are handled safely', async () => {
  let source = await loadSource()
  source.setOnlineListing('p1', { published: false, description: 'Fresh local rice', imageUrl: 'https://images.example/rice.jpg' })
  assert.throws(() => source.setOnlineListing('p1', { published: true, description: '', imageUrl: 'javascript:alert(1)' }), /valid http or https/i)

  const snapshot = JSON.parse(storage.get(snapshotKey))
  snapshot.onlineListings.push({ ...snapshot.onlineListings[0], productId: 'deleted-product' })
  snapshot.onlineListings[0].imageUrl = 'javascript:alert(1)'
  storage.set(snapshotKey, JSON.stringify(snapshot))

  source = await loadSource()
  assert.equal(source.getOnlineListings().length, 1)
  assert.equal(source.getOnlineListings()[0].published, false)
  assert.equal(source.getOnlineListings()[0].imageUrl, null)
})
