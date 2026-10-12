import type { Sale } from '../../types/domain'
import { uniqueCompletedSales } from '../../lib/sales'

export interface CustomerMetrics {
  spendingPaise: number
  purchaseCount: number
}

/** Sum each completed, customer-linked sale once. Anonymous sales stay unassigned. */
export function getCustomerMetrics(customerId: string, sales: Sale[]): CustomerMetrics {
  const purchases = uniqueCompletedSales(sales).filter((sale) => sale.customerId === customerId)
  return { spendingPaise: purchases.reduce((sum, sale) => sum + sale.totalPaise, 0), purchaseCount: purchases.length }
}
