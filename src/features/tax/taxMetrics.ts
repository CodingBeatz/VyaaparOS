import type { Sale, SaleItem } from '../../types/domain'
import { localDateKey } from '../../lib/format'
import { uniqueCompletedSales } from '../../lib/sales'

export interface TaxTransaction {
  sale: Sale
  taxableValuePaise: number | null
  taxPaise: number | null
  itemCount: number
}

export interface TaxSummary {
  salesCount: number
  grossSalesPaise: number
  verifiedSalesCount: number
  unavailableSalesCount: number
  taxableValuePaise: number
  recordedTaxPaise: number
  transactions: TaxTransaction[]
}

function safeMoney(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

/** A tax split is unavailable, but sale-level amounts are shown when item snapshots reconcile. */
export function getTaxSummary(sales: Sale[], items: SaleItem[], from: string, to: string): TaxSummary {
  const empty: TaxSummary = { salesCount: 0, grossSalesPaise: 0, verifiedSalesCount: 0, unavailableSalesCount: 0, taxableValuePaise: 0, recordedTaxPaise: 0, transactions: [] }
  if (!from || !to || from > to) return empty

  const periodSales = uniqueCompletedSales(sales).filter((sale) => {
    const day = localDateKey(sale.createdAt)
    return day >= from && day <= to
  })

  const transactions: TaxTransaction[] = periodSales.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((sale) => {
    const lines = items.filter((item) => item.saleId === sale.id)
    const uniqueLines = new Map(lines.map((item) => [item.id, item]))
    const lineList = [...uniqueLines.values()]
    const lineSubtotal = lineList.reduce((sum, item) => sum + item.lineSubtotalPaise, 0)
    const lineTax = lineList.reduce((sum, item) => sum + item.lineTaxPaise, 0)
    const itemsAreValid = lineList.length > 0 && lineList.every((item) => {
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !safeMoney(item.lineSubtotalPaise) ||
        !safeMoney(item.lineTaxPaise) || !safeMoney(item.lineTotalPaise) || !Number.isInteger(item.taxRateBps) || item.taxRateBps < 0 || item.taxRateBps > 100_00) return false
      const expectedTax = Number((BigInt(item.lineSubtotalPaise) * BigInt(item.taxRateBps) + 5_000n) / 10_000n)
      return Number.isSafeInteger(expectedTax) && item.lineTaxPaise === expectedTax && item.lineTotalPaise === item.lineSubtotalPaise + item.lineTaxPaise
    })
    const reconciles = itemsAreValid && safeMoney(sale.subtotalPaise) && safeMoney(sale.taxPaise) && safeMoney(sale.discountPaise) && safeMoney(sale.totalPaise) &&
      lineSubtotal === sale.subtotalPaise && lineTax === sale.taxPaise && sale.subtotalPaise + sale.taxPaise - sale.discountPaise === sale.totalPaise
    return reconciles
      ? { sale, taxableValuePaise: lineSubtotal, taxPaise: lineTax, itemCount: lineList.length }
      : { sale, taxableValuePaise: null, taxPaise: null, itemCount: lineList.length }
  })

  const verified = transactions.filter((transaction) => transaction.taxableValuePaise !== null)
  const grossSalesPaise = transactions.reduce((sum, transaction) => sum + (safeMoney(transaction.sale.totalPaise) ? transaction.sale.totalPaise : 0), 0)
  return {
    salesCount: transactions.length,
    grossSalesPaise,
    verifiedSalesCount: verified.length,
    unavailableSalesCount: transactions.length - verified.length,
    taxableValuePaise: verified.reduce((sum, transaction) => sum + transaction.taxableValuePaise!, 0),
    recordedTaxPaise: verified.reduce((sum, transaction) => sum + transaction.taxPaise!, 0),
    transactions,
  }
}

/** Calculate a rounded GST estimate using only integer-paise / BigInt arithmetic. */
export function calculateGstEstimate(amountPaise: number, rateBps: number, includesGst: boolean) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error('Enter a valid positive amount in rupees.')
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 100_00) throw new Error('Choose a valid GST rate.')
  const amount = BigInt(amountPaise)
  const rate = BigInt(rateBps)
  let taxableValuePaise: bigint
  let gstPaise: bigint
  if (includesGst) {
    taxableValuePaise = (amount * 10_000n + (10_000n + rate) / 2n) / (10_000n + rate)
    gstPaise = amount - taxableValuePaise
  } else {
    taxableValuePaise = amount
    gstPaise = (amount * rate + 5_000n) / 10_000n
  }
  const totalPaise = includesGst ? amount : taxableValuePaise + gstPaise
  const result = { taxableValuePaise: Number(taxableValuePaise), gstPaise: Number(gstPaise), totalPaise: Number(totalPaise) }
  if (Object.values(result).some((value) => !Number.isSafeInteger(value))) throw new Error('This amount is too large to calculate safely.')
  return result
}
