import test from 'node:test'
import assert from 'node:assert/strict'
import { getFinanceSummary } from '../src/features/finance/financeMetrics.ts'
import { getTaxSummary } from '../src/features/tax/taxMetrics.ts'
import { getDemoDashboardSummary } from '../src/lib/data/dashboardMetrics.ts'
import { localDateKey } from '../src/lib/format.ts'

test('dashboard, finance and tax use the same browser calendar day as displayed timestamps', () => {
  const createdAt = '2026-10-11T23:30:00-05:00'
  const day = localDateKey(createdAt)
  const sale = {
    id: 'sale', shopId: 'demo-shop', customerId: null, source: 'pos', sourceOrderId: null,
    invoiceNumber: 'INV-sale', status: 'completed', subtotalPaise: 10_000, taxPaise: 1_800,
    discountPaise: 0, totalPaise: 11_800, idempotencyKey: 'key', createdAt,
  }
  const item = {
    id: 'item', saleId: 'sale', productId: 'p1', productNameSnapshot: 'Item', quantity: 1,
    unitPricePaise: 10_000, taxRateBps: 1800, lineSubtotalPaise: 10_000, lineTaxPaise: 1_800,
    lineTotalPaise: 11_800,
  }

  assert.equal(getFinanceSummary([sale], [], day, day).salesPaise, 11_800)
  assert.equal(getTaxSummary([sale], [item], day, day).salesCount, 1)
  assert.equal(getDemoDashboardSummary([sale], [], [], new Date(createdAt)).metrics.ordersToday, 1)
})
