/** Demo redemption rate: one point is worth 10 paise (100 points = ₹10). */
export const PaisePerLoyaltyPoint = 10

export interface LoyaltyRedemptionPreview {
  points: number
  discountPaise: number
  error: string
}

export function getMaximumRedeemablePoints(availablePoints: number, eligibleSubtotalPaise: number): number {
  if (!Number.isSafeInteger(availablePoints) || availablePoints <= 0) return 0
  if (!Number.isSafeInteger(eligibleSubtotalPaise) || eligibleSubtotalPaise <= 0) return 0
  return Math.min(availablePoints, Math.floor(eligibleSubtotalPaise / PaisePerLoyaltyPoint))
}

export function getLoyaltyRedemptionError(
  points: number,
  availablePoints: number,
  eligibleSubtotalPaise: number,
  customerSelected: boolean,
): string {
  if (!Number.isSafeInteger(points) || points < 0) return 'Enter a whole number of loyalty points.'
  if (points > 0 && !customerSelected) return 'Select a customer before redeeming points.'
  if (!Number.isSafeInteger(availablePoints) || availablePoints < 0 || points > availablePoints) {
    return `Only ${Math.max(0, availablePoints)} loyalty points are available.`
  }
  if (!Number.isSafeInteger(eligibleSubtotalPaise) || eligibleSubtotalPaise < 0) {
    return 'The bill subtotal is not a valid amount.'
  }
  if (points > getMaximumRedeemablePoints(availablePoints, eligibleSubtotalPaise)) {
    return 'The loyalty discount cannot exceed the bill subtotal.'
  }
  return ''
}

export function getLoyaltyRedemptionPreview(
  points: number,
  availablePoints: number,
  eligibleSubtotalPaise: number,
  customerSelected: boolean,
  cartHasItems: boolean,
): LoyaltyRedemptionPreview {
  if (!cartHasItems) return { points: 0, discountPaise: 0, error: '' }
  const error = getLoyaltyRedemptionError(points, availablePoints, eligibleSubtotalPaise, customerSelected)
  if (error) return { points, discountPaise: 0, error }
  const discount = BigInt(points) * BigInt(PaisePerLoyaltyPoint)
  if (discount > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { points, discountPaise: 0, error: 'The loyalty discount is too large to calculate safely.' }
  }
  return { points, discountPaise: Number(discount), error: '' }
}
