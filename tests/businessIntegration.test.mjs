import test from 'node:test'
import assert from 'node:assert/strict'
import { getCustomerMetrics } from '../src/features/customers/customerMetrics.ts'
import { getFinanceSummary } from '../src/features/finance/financeMetrics.ts'
import { getLoyaltyRedemptionPreview, getMaximumRedeemablePoints } from '../src/lib/loyaltyRedemption.ts'

const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
}
const storageKey = 'vyapaaros.pos-inventory.v1'
let moduleVersion = 0
async function loadFreshDataSource() {
  return (await import(`../src/lib/data/demoDataSource.ts?integration=${moduleVersion++}`)).demoDataSource
}
const saleInput = (overrides = {}) => ({
  shopId: 'demo-shop', customerId: 'c1', source: 'pos', idempotencyKey: `integration-sale-${moduleVersion}`,
  items: [{ productId: 'p1', quantity: 1 }], redeemPoints: 0, ...overrides,
})

test('completed POS sale updates inventory, movements, customer metrics and ledger once, and survives reload', async () => {
  storage.clear()
  let data = await loadFreshDataSource()
  const startingCustomerPoints = data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints
  data.applyLoyaltyAdjustment({ customerId: 'c1', adjustmentType: 'add', amount: 10, reason: 'Integration test seed' })
  const input = saleInput({ redeemPoints: 10 })
  const result = data.completeSale(input)
  const retry = data.completeSale(input)

  assert.equal(retry.saleId, result.saleId)
  assert.equal(data.getSales().length, 1)
  assert.equal(data.getProducts().find((product) => product.id === 'p1').stockQuantity, 7)
  assert.deepEqual(data.getInventoryMovements().filter((movement) => movement.saleId === result.saleId).map((movement) => movement.quantityDelta), [-1])
  assert.equal(data.getFinancialEntries().filter((entry) => entry.referenceId === result.saleId).length, 1)
  assert.equal(data.getFinancialEntries().find((entry) => entry.referenceId === result.saleId).amountPaise, result.totalPaise)
  assert.equal(result.totalPaise, 68_400)
  assert.equal(data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints, startingCustomerPoints + 6)
  assert.deepEqual(data.getLoyaltyTransactions('c1').filter((transaction) => transaction.saleId === result.saleId).map((transaction) => transaction.pointsDelta), [-10, 6])
  assert.deepEqual(getCustomerMetrics('c1', [...data.getSales(), { ...data.getSales()[0], id: 'duplicate-retry-row' }]), { spendingPaise: result.totalPaise, purchaseCount: 1 })

  data = await loadFreshDataSource()
  assert.equal(data.getProducts().find((product) => product.id === 'p1').stockQuantity, 7)
  assert.equal(data.getSales().length, 1)
  assert.equal(data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints, startingCustomerPoints + 6)
  assert.equal(data.getSaleReceipt(result.saleId).loyaltyTransactions.length, 2)
})

test('100 loyalty points preview as ₹10, clamp to available balance and clear with an empty cart', () => {
  assert.equal(getMaximumRedeemablePoints(108, 68_500), 108)
  assert.deepEqual(getLoyaltyRedemptionPreview(100, 108, 68_500, true, true), { points: 100, discountPaise: 1_000, error: '' })
  assert.equal(getLoyaltyRedemptionPreview(109, 108, 68_500, true, true).error, 'Only 108 loyalty points are available.')
  assert.equal(getLoyaltyRedemptionPreview(100, 108, 999, true, true).error, 'The loyalty discount cannot exceed the bill subtotal.')
  assert.deepEqual(getLoyaltyRedemptionPreview(100, 108, 68_500, true, false), { points: 0, discountPaise: 0, error: '' })
  assert.notEqual(getLoyaltyRedemptionPreview(1.5, 108, 68_500, true, true).error, '')
})

test('100-point redemption is recorded and deducted once after successful checkout; earned points use payable total', async () => {
  storage.clear()
  const data = await loadFreshDataSource()
  data.applyLoyaltyAdjustment({ customerId: 'c1', adjustmentType: 'add', amount: 108, reason: 'Redemption test balance' })
  const input = saleInput({ idempotencyKey: '100-point-redemption', redeemPoints: 100 })
  const result = data.completeSale(input)
  const retry = data.completeSale(input)
  const receipt = data.getSaleReceipt(result.saleId)
  const saleTransactions = receipt.loyaltyTransactions.filter((transaction) => transaction.transactionType === 'sale')
  const redemptions = receipt.loyaltyTransactions.filter((transaction) => transaction.transactionType === 'redemption')

  assert.equal(retry.saleId, result.saleId)
  assert.equal(result.totalPaise, 67_500)
  assert.equal(receipt.sale.discountPaise, 1_000)
  assert.deepEqual(redemptions.map((transaction) => transaction.pointsDelta), [-100])
  assert.deepEqual(saleTransactions.map((transaction) => transaction.pointsDelta), [6])
  assert.equal(data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints, 14)
  assert.equal(data.getSales().length, 1)
  assert.equal(data.getLoyaltyTransactions('c1').filter((transaction) => transaction.saleId === result.saleId).length, 2)
  assert.equal(data.getProducts().find((product) => product.id === 'p1').stockQuantity, 7)
})

test('canceling redemption before checkout does not change the customer balance or sale ledger', async () => {
  storage.clear()
  const data = await loadFreshDataSource()
  data.applyLoyaltyAdjustment({ customerId: 'c1', adjustmentType: 'add', amount: 108, reason: 'Cancellation test balance' })
  const pointsBefore = data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints
  assert.equal(getLoyaltyRedemptionPreview(100, pointsBefore, 68_500, true, true).discountPaise, 1_000)
  assert.deepEqual(getLoyaltyRedemptionPreview(0, pointsBefore, 0, true, false), { points: 0, discountPaise: 0, error: '' })
  assert.equal(data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints, pointsBefore)
  assert.equal(data.getSales().length, 0)
  assert.equal(data.getLoyaltyTransactions('c1').filter((transaction) => transaction.transactionType === 'redemption').length, 0)
})

test('insufficient balance or failed checkout leaves points, sales and stock unchanged', async () => {
  storage.clear()
  const data = await loadFreshDataSource()
  data.applyLoyaltyAdjustment({ customerId: 'c1', adjustmentType: 'add', amount: 108, reason: 'Redemption validation balance' })
  const pointsBefore = data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints
  assert.throws(() => data.completeSale(saleInput({ redeemPoints: 109, idempotencyKey: 'too-many-points' })), /only 108 loyalty points/i)
  assert.throws(() => data.completeSale(saleInput({ redeemPoints: 100, items: [{ productId: 'p1', quantity: 99 }], idempotencyKey: 'failed-redemption-sale' })), /only 8 .* available/i)
  assert.equal(data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints, pointsBefore)
  assert.equal(data.getSales().length, 0)
  assert.equal(data.getProducts().find((product) => product.id === 'p1').stockQuantity, 8)
  assert.equal(data.getLoyaltyTransactions('c1').filter((transaction) => transaction.transactionType === 'redemption').length, 0)
})

test('insufficient stock and anonymous sales do not corrupt customer or loyalty metrics', async () => {
  storage.clear()
  let data = await loadFreshDataSource()
  const beforePoints = data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints
  assert.throws(() => data.completeSale(saleInput({ items: [{ productId: 'p1', quantity: 99 }] })), /only 8 .* available/i)
  assert.equal(data.getProducts().find((product) => product.id === 'p1').stockQuantity, 8)
  assert.equal(data.getSales().length, 0)
  assert.equal(data.getLoyaltyTransactions('c1').length, 0)

  const result = data.completeSale(saleInput({ customerId: null, items: [{ productId: 'p2', quantity: 1 }], redeemPoints: 0, idempotencyKey: 'anonymous' }))
  assert.equal(data.getProducts().find((product) => product.id === 'p2').stockQuantity, 5)
  assert.equal(data.getCustomers().find((customer) => customer.id === 'c1').loyaltyPoints, beforePoints)
  assert.deepEqual(getCustomerMetrics('c1', data.getSales()), { spendingPaise: 0, purchaseCount: 0 })
  assert.equal(data.getSaleReceipt(result.saleId).sale.customerId, null)
  assert.equal(data.getLoyaltyTransactions('c1').length, 0)
})

test('malformed localStorage snapshot falls back to demo defaults without throwing', async () => {
  storage.clear()
  storage.set(storageKey, '{not valid json')
  const data = await loadFreshDataSource()
  assert.equal(data.getProducts().length, 4)
  assert.equal(data.getCustomers().length, 2)
  assert.deepEqual(data.getSales(), [])
})

test('expense create, edit and delete are reflected in finance period totals and persist', async () => {
  storage.clear()
  let data = await loadFreshDataSource()
  const entry = data.addExpense({ description: 'Electricity', category: 'Utilities', amountPaise: 12_345, occurredOn: '2026-10-10', paymentMethod: 'upi' })
  let summary = getFinanceSummary(data.getSales(), data.getFinancialEntries(), '2026-10-10', '2026-10-10')
  assert.equal(summary.expensesPaise, 12_345)
  assert.equal(summary.recordedCashFlowPaise, -12_345)

  data.updateExpense(entry.id, { description: 'Electricity bill', category: 'Utilities', amountPaise: 5_000, occurredOn: '2026-10-11', paymentMethod: 'bank_transfer' })
  data = await loadFreshDataSource()
  assert.equal(getFinanceSummary(data.getSales(), data.getFinancialEntries(), '2026-10-10', '2026-10-10').expensesPaise, 0)
  summary = getFinanceSummary(data.getSales(), data.getFinancialEntries(), '2026-10-11', '2026-10-11')
  assert.equal(summary.expensesPaise, 5_000)

  data.deleteExpense(entry.id)
  assert.equal(getFinanceSummary(data.getSales(), data.getFinancialEntries(), '2026-10-01', '2026-10-31').expensesPaise, 0)
})
