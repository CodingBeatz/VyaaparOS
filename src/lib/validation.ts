import type { Paise } from '../types/domain'

export function parseMoneyToPaise(input: string): Paise | null {
  const normalized = input.trim().replace(/,/g, '')
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null
  const [rupees, fraction = ''] = normalized.split('.')
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(paise) ? paise : null
}

export function isPositiveQuantity(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 1_000_000
}

export function isValidIndianMobile(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return /^[6-9]\d{9}$/.test(digits)
}
