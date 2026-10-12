import type { Paise } from '../types/domain'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function formatINR(amountPaise: Paise): string {
  if (!Number.isSafeInteger(amountPaise)) throw new Error('Money must be an integer number of paise.')
  return inr.format(amountPaise / 100)
}

export function formatCompactINR(amountPaise: Paise): string {
  const rupees = amountPaise / 100
  if (Math.abs(rupees) >= 100_000) return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(rupees / 100_000)}L`
  if (Math.abs(rupees) >= 1_000) return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(rupees / 1_000)}k`
  return formatINR(amountPaise)
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', options ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

/** Calendar day matching formatDate and date inputs in the current browser locale. */
export function localDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
