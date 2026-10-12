import test from 'node:test'
import assert from 'node:assert/strict'
import { getDemoDashboardSummary } from '../src/lib/data/dashboardMetrics.ts'

const shopId = 'demo-shop'
const now = new Date('2026-10-12T12:00:00.000Z')
function sale(id, createdAt, totalPaise, overrides = {}) {
  return {
    id, shopId, customerId: null, source: 'pos', sourceOrderId: null, invoiceNumber: `INV-${id}`,
    status: 'completed', subtotalPaise: totalPaise, taxPaise: 0, discountPaise: 0,
    totalPaise, idempotencyKey: id, createdAt, ...overrides,
  }
}
function product(id, stockQuantity, lowStockThreshold, active = true) {
  return { id, shopId, sku: null, name: id, unit: 'each', salePricePaise: 100, costPricePaise: 50, taxRateBps: 0, stockQuantity, lowStockThreshold, active }
}

test('dashboard figures use unique completed records and current inventory', () => {
  const sales = [
    sale('today', '2026-10-12T08:00:00.000Z', 68_500),
    sale('retry', '2026-10-12T08:00:00.000Z', 68_500, { idempotencyKey: 'today' }),
    sale('void', '2026-10-12T09:00:00.000Z', 9_200, { status: 'voided' }),
    sale('last-monday', '2026-10-05T08:00:00.000Z', 20_000),
  ]
  const products = [product('low-a', 0, 2), product('low-b', 2, 2), product('healthy', 9, 2), product('inactive-low', 0, 2, false)]
  const customers = [{ id: 'c1', shopId, name: 'One' }, { id: 'c1', shopId, name: 'Duplicate' }, { id: 'c2', shopId, name: 'Two' }]
  const result = getDemoDashboardSummary(sales, products, customers, now)

  assert.equal(result.metrics.todaySalesPaise, 68_500)
  assert.equal(result.metrics.ordersToday, 1)
  assert.equal(result.metrics.averageOrderPaise, 68_500)
  assert.equal(result.metrics.lowStockCount, 2)
  assert.equal(result.metrics.loyaltyMembers, 2)
  assert.deepEqual(result.lowStockProducts.map((item) => item.id), ['low-a', 'low-b'])
  assert.deepEqual(result.salesSeries.at(-1), { day: 'Mon', current: 68_500, previous: 20_000 })
  assert.equal(result.hasRecentSales, true)
})

test('dashboard does not fabricate activity when there are no completed sales', () => {
  const result = getDemoDashboardSummary([sale('void', '2026-10-12T09:00:00.000Z', 9_200, { status: 'voided' })], [product('healthy', 9, 2)], [], now)
  assert.deepEqual(result.metrics, { todaySalesPaise: 0, ordersToday: 0, averageOrderPaise: 0, lowStockCount: 0, loyaltyMembers: 0 })
  assert.equal(result.hasRecentSales, false)
  assert.equal(result.salesSeries.every((point) => point.current === 0 && point.previous === 0), true)
})
