import type { FinancialEntry, Sale } from '../../types/domain'
import { localDateKey } from '../../lib/format'
import { uniqueCompletedSales } from '../../lib/sales'

export interface FinanceTransaction {
  id: string
  type: 'sale' | 'expense'
  date: string
  description: string
  category: string
  amountPaise: number
  paymentMethod: string | null
  status: string
}

export interface FinanceSummary {
  salesPaise: number
  expensesPaise: number
  recordedCashFlowPaise: number
  transactions: FinanceTransaction[]
  trend: Array<{ period: string; label: string; revenuePaise: number; expensesPaise: number }>
}

/** Build finance views only from completed, unique POS/online sales and persisted expenses. */
export function getFinanceSummary(sales: Sale[], entries: FinancialEntry[], from: string, to: string): FinanceSummary {
  if (!from || !to || from > to) return { salesPaise: 0, expensesPaise: 0, recordedCashFlowPaise: 0, transactions: [], trend: [] }
  const periodSales = uniqueCompletedSales(sales).filter((sale) => {
    const day = localDateKey(sale.createdAt)
    return day >= from && day <= to
  })
  const seenExpenses = new Set<string>()
  const periodExpenses = entries.filter((entry) => {
    if (entry.kind !== 'expense' || entry.referenceType !== 'manual' || seenExpenses.has(entry.id)) return false
    seenExpenses.add(entry.id)
    const day = localDateKey(entry.occurredAt)
    return day >= from && day <= to
  })

  const transactions: FinanceTransaction[] = [
    ...periodSales.map((sale) => ({
      id: sale.id, type: 'sale' as const, date: sale.createdAt,
      description: `POS sale · ${sale.invoiceNumber}`, category: sale.source === 'online' ? 'Online sale' : 'POS sale',
      amountPaise: sale.totalPaise, paymentMethod: null, status: sale.status,
    })),
    ...periodExpenses.map((entry) => ({
      id: entry.id, type: 'expense' as const, date: entry.occurredAt,
      description: entry.description || entry.category, category: entry.category,
      amountPaise: entry.amountPaise, paymentMethod: entry.paymentMethod, status: 'Recorded',
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const revenueByPeriod = new Map<string, number>()
  const expensesByPeriod = new Map<string, number>()
  const rangeLength = Math.max(1, Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1)
  const monthly = rangeLength > 120
  for (const sale of periodSales) {
    const day = localDateKey(sale.createdAt)
    const key = monthly ? day.slice(0, 7) : day
    revenueByPeriod.set(key, (revenueByPeriod.get(key) ?? 0) + sale.totalPaise)
  }
  for (const expense of periodExpenses) {
    const day = localDateKey(expense.occurredAt)
    const key = monthly ? day.slice(0, 7) : day
    expensesByPeriod.set(key, (expensesByPeriod.get(key) ?? 0) + expense.amountPaise)
  }
  const keys = [...new Set([...revenueByPeriod.keys(), ...expensesByPeriod.keys()])].sort()
  const trend = keys.map((period) => ({
    period,
    label: monthly ? new Date(`${period}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : new Date(`${period}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    revenuePaise: revenueByPeriod.get(period) ?? 0,
    expensesPaise: expensesByPeriod.get(period) ?? 0,
  }))

  const salesPaise = periodSales.reduce((sum, sale) => sum + sale.totalPaise, 0)
  const expensesPaise = periodExpenses.reduce((sum, entry) => sum + entry.amountPaise, 0)
  return { salesPaise, expensesPaise, recordedCashFlowPaise: salesPaise - expensesPaise, transactions, trend }
}
