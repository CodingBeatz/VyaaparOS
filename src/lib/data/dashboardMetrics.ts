import type { Customer, Product, Sale } from '../../types/domain'
import { localDateKey } from '../format'
import { uniqueCompletedSales } from '../sales'

export interface DemoDashboardSummary {
  metrics: {
    todaySalesPaise: number
    ordersToday: number
    averageOrderPaise: number
    lowStockCount: number
    loyaltyMembers: number
  }
  salesSeries: Array<{ day: string; current: number; previous: number }>
  lowStockProducts: Product[]
  hasRecentSales: boolean
}

/** Build dashboard figures from the same completed sales and catalog used by demo modules. */
export function getDemoDashboardSummary(sales: Sale[], products: Product[], customers: Customer[], now = new Date()): DemoDashboardSummary {
  const completedSales = uniqueCompletedSales(sales).filter((sale) => Number.isSafeInteger(sale.totalPaise) && sale.totalPaise >= 0)

  const today = localDateKey(now)
  const dailyTotals = new Map<string, number>()
  for (const sale of completedSales) {
    const day = localDateKey(sale.createdAt)
    dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + sale.totalPaise)
  }
  const todaySales = completedSales.filter((sale) => localDateKey(sale.createdAt) === today)
  const todaySalesPaise = todaySales.reduce((sum, sale) => sum + sale.totalPaise, 0)
  const lowStockProducts = products.filter((product) => product.active && Number.isInteger(product.stockQuantity) && Number.isInteger(product.lowStockThreshold) && product.stockQuantity <= product.lowStockThreshold)
    .sort((a, b) => a.stockQuantity - b.stockQuantity || a.name.localeCompare(b.name))

  const salesSeries = Array.from({ length: 7 }, (_, index) => {
    const offset = index - 6
    const currentDate = new Date(now)
    currentDate.setDate(currentDate.getDate() + offset)
    const priorDate = new Date(currentDate)
    priorDate.setDate(priorDate.getDate() - 7)
    return {
      day: currentDate.toLocaleDateString('en-IN', { weekday: 'short' }),
      current: dailyTotals.get(localDateKey(currentDate)) ?? 0,
      previous: dailyTotals.get(localDateKey(priorDate)) ?? 0,
    }
  })

  return {
    metrics: {
      todaySalesPaise,
      ordersToday: todaySales.length,
      averageOrderPaise: todaySales.length ? Math.round(todaySalesPaise / todaySales.length) : 0,
      lowStockCount: lowStockProducts.length,
      loyaltyMembers: new Set(customers.map((customer) => customer.id)).size,
    },
    salesSeries,
    lowStockProducts,
    hasRecentSales: salesSeries.some((point) => point.current > 0 || point.previous > 0),
  }
}
