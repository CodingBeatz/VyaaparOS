import type { Sale } from '../types/domain'

/** Remove duplicate completed records by sale ID and checkout idempotency key. */
export function uniqueCompletedSales(sales: Sale[]): Sale[] {
  const seenIds = new Set<string>()
  const seenCheckoutKeys = new Set<string>()
  return sales.filter((sale) => {
    if (sale.status !== 'completed' || !sale.id || seenIds.has(sale.id)) return false
    const checkoutKey = sale.idempotencyKey?.trim() ? `${sale.shopId}:${sale.idempotencyKey}` : ''
    if (checkoutKey && seenCheckoutKeys.has(checkoutKey)) return false
    seenIds.add(sale.id)
    if (checkoutKey) seenCheckoutKeys.add(checkoutKey)
    return true
  })
}
