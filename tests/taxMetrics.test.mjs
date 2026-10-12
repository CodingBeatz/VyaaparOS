import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGstEstimate, getTaxSummary } from '../src/features/tax/taxMetrics.ts'

function sale(overrides = {}) {
  return {
    id: 'sale-1', shopId: 'shop', customerId: null, source: 'pos', sourceOrderId: null,
    invoiceNumber: 'NM-2026-0001', status: 'completed', subtotalPaise: 10_000,
    taxPaise: 1_800, discountPaise: 0, totalPaise: 11_800, idempotencyKey: 'key-1',
    createdAt: '2026-10-11T12:00:00.000Z', ...overrides,
  }
}

function item(overrides = {}) {
  return {
    id: 'item-1', saleId: 'sale-1', productId: 'p1', productNameSnapshot: 'Product',
    quantity: 1, unitPricePaise: 10_000, taxRateBps: 1800, lineSubtotalPaise: 10_000,
    lineTaxPaise: 1_800, lineTotalPaise: 11_800, ...overrides,
  }
}

test('GST-exclusive amount returns taxable value, rounded tax, and total', () => {
  assert.deepEqual(calculateGstEstimate(10_000, 1800, false), { taxableValuePaise: 10_000, gstPaise: 1_800, totalPaise: 11_800 })
})

test('GST-inclusive amount extracts tax from the entered total', () => {
  assert.deepEqual(calculateGstEstimate(11_800, 1800, true), { taxableValuePaise: 10_000, gstPaise: 1_800, totalPaise: 11_800 })
})

test('GST amounts round consistently to integer paise', () => {
  assert.deepEqual(calculateGstEstimate(101, 500, false), { taxableValuePaise: 101, gstPaise: 5, totalPaise: 106 })
  assert.deepEqual(calculateGstEstimate(105, 500, true), { taxableValuePaise: 100, gstPaise: 5, totalPaise: 105 })
})

test('invalid calculator inputs are rejected', () => {
  assert.throws(() => calculateGstEstimate(0, 1800, false), /positive amount/)
  assert.throws(() => calculateGstEstimate(100, -1, false), /valid GST rate/)
  assert.throws(() => calculateGstEstimate(Number.MAX_SAFE_INTEGER + 1, 1800, false), /positive amount/)
})

test('tax data is unavailable when item snapshots are absent or inconsistent', () => {
  const summary = getTaxSummary([sale(), sale(), sale({ id: 'retry-copy' })], [], '2026-10-01', '2026-10-31')
  assert.equal(summary.salesCount, 1, 'duplicate IDs and checkout idempotency keys count only once')
  assert.equal(summary.grossSalesPaise, 11_800)
  assert.equal(summary.verifiedSalesCount, 0)
  assert.equal(summary.unavailableSalesCount, 1)
  assert.equal(summary.transactions[0].taxPaise, null)
})

test('only completed sales with reconciled item tax details contribute tax summary', () => {
  const summary = getTaxSummary([sale(), sale({ id: 'void', status: 'voided' }), sale({ id: 'different-day', createdAt: '2026-09-01T12:00:00.000Z' })], [item()], '2026-10-01', '2026-10-31')
  assert.equal(summary.salesCount, 1)
  assert.equal(summary.verifiedSalesCount, 1)
  assert.equal(summary.taxableValuePaise, 10_000)
  assert.equal(summary.recordedTaxPaise, 1_800)
})

test('sale discount is reconciled while recorded tax remains clearly pre-discount', () => {
  const discounted = sale({ discountPaise: 1_000, totalPaise: 10_800 })
  const summary = getTaxSummary([discounted], [item()], '2026-10-01', '2026-10-31')
  assert.equal(summary.verifiedSalesCount, 1)
  assert.equal(summary.taxableValuePaise, 10_000)
  assert.equal(summary.recordedTaxPaise, 1_800)
  assert.equal(summary.grossSalesPaise, 10_800)
})
