import test from 'node:test'
import assert from 'node:assert/strict'
import { getFinanceSummary } from '../src/features/finance/financeMetrics.ts'

const sale = (id, createdAt, totalPaise, status = 'completed') => ({
  id, shopId: 'demo-shop', customerId: null, source: 'pos', sourceOrderId: null,
  invoiceNumber: `INV-${id}`, status, subtotalPaise: totalPaise, taxPaise: 0,
  discountPaise: 0, totalPaise, idempotencyKey: id, createdAt,
})

const expense = (id, occurredAt, amountPaise) => ({
  id, shopId: 'demo-shop', kind: 'expense', category: 'Utilities', amountPaise,
  description: 'Electric bill', paymentMethod: 'upi', referenceType: 'manual',
  referenceId: null, occurredAt,
})

test('summarizes only unique completed sales and dated expenses using integer paise', () => {
  const sales = [
    sale('s1', '2026-10-10T09:00:00.000Z', 68_500),
    sale('s1', '2026-10-10T09:00:00.000Z', 68_500), // Duplicate record must not inflate revenue.
    { ...sale('s1-retry', '2026-10-10T09:00:00.000Z', 68_500), idempotencyKey: 's1' },
    sale('s2', '2026-10-11T09:00:00.000Z', 14_800, 'voided'),
    sale('s3', '2026-09-01T09:00:00.000Z', 92_000),
  ]
  const entries = [expense('e1', '2026-10-10T12:00:00.000Z', 12_350), expense('e2', '2026-09-01T12:00:00.000Z', 5_000)]
  const result = getFinanceSummary(sales, entries, '2026-10-01', '2026-10-31')

  assert.equal(result.salesPaise, 68_500)
  assert.equal(result.expensesPaise, 12_350)
  assert.equal(result.recordedCashFlowPaise, 56_150)
  assert.deepEqual(result.transactions.map((item) => item.id).sort(), ['e1', 's1'])
  assert.equal(result.trend.length, 1)
  assert.equal(result.trend[0].revenuePaise, 68_500)
  assert.equal(result.trend[0].expensesPaise, 12_350)
})

test('returns a useful empty summary when the date range has no recorded transactions', () => {
  const result = getFinanceSummary([], [], '2026-10-01', '2026-10-31')
  assert.equal(result.salesPaise, 0)
  assert.equal(result.expensesPaise, 0)
  assert.equal(result.recordedCashFlowPaise, 0)
  assert.deepEqual(result.trend, [])
  assert.deepEqual(result.transactions, [])
})

test('invalid date range does not widen or misstate the summary', () => {
  const result = getFinanceSummary([sale('s1', '2026-10-10T09:00:00.000Z', 68_500)], [], '2026-10-31', '2026-10-01')
  assert.equal(result.salesPaise, 0)
  assert.deepEqual(result.transactions, [])
})
