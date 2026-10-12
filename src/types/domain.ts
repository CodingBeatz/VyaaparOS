/** Shared business contract. Monetary values are integer paise, never rupees/floats. */
export type UUID = string
export type Paise = number
export type ISODateTime = string

export type ShopRole = 'owner' | 'manager' | 'staff'
export type SaleSource = 'pos' | 'online'
export type SaleStatus = 'completed' | 'voided' | 'refunded'
export type InventoryMovementReason = 'sale' | 'purchase' | 'adjustment' | 'return'
export type FinancialEntryKind = 'income' | 'expense'
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
export type LoyaltyTransactionType = 'sale' | 'redemption' | 'adjustment_add' | 'adjustment_deduct'

export interface Shop {
  id: UUID
  name: string
  timezone: string
  currency: 'INR'
  createdAt: ISODateTime
}

export interface ShopMember {
  shopId: UUID
  userId: UUID
  role: ShopRole
  createdAt: ISODateTime
}

export interface Product {
  id: UUID
  shopId: UUID
  sku: string | null
  name: string
  unit: string
  salePricePaise: Paise
  costPricePaise: Paise
  taxRateBps: number
  stockQuantity: number
  lowStockThreshold: number
  active: boolean
}

/** Online-only presentation metadata; stock and prices remain authoritative on Product. */
export interface OnlineListing {
  shopId: UUID
  productId: UUID
  published: boolean
  description: string
  imageUrl: string | null
  updatedAt: ISODateTime
}

export interface Customer {
  id: UUID
  shopId: UUID
  name: string
  phone: string | null
  email: string | null
  loyaltyPoints: number
  createdAt: ISODateTime
}

export interface Sale {
  id: UUID
  shopId: UUID
  customerId: UUID | null
  source: SaleSource
  sourceOrderId: UUID | null
  invoiceNumber: string
  status: SaleStatus
  subtotalPaise: Paise
  taxPaise: Paise
  discountPaise: Paise
  totalPaise: Paise
  idempotencyKey: string
  createdAt: ISODateTime
}

export interface SaleItem {
  id: UUID
  saleId: UUID
  productId: UUID
  productNameSnapshot: string
  quantity: number
  unitPricePaise: Paise
  taxRateBps: number
  lineSubtotalPaise: Paise
  lineTaxPaise: Paise
  lineTotalPaise: Paise
}

export interface InventoryMovement {
  id: UUID
  shopId: UUID
  productId: UUID
  saleId: UUID | null
  purchaseId: UUID | null
  reason: InventoryMovementReason
  quantityDelta: number
  createdAt: ISODateTime
}

export interface LoyaltyTransaction {
  id: UUID
  shopId: UUID
  customerId: UUID
  saleId: UUID | null
  pointsDelta: number
  /** Sale rewards and manual adjustments are shown separately in customer history. */
  transactionType: LoyaltyTransactionType
  reason: string | null
  createdAt: ISODateTime
}

export interface OnlineOrder {
  id: UUID
  shopId: UUID
  customerId: UUID | null
  status: 'pending' | 'accepted' | 'completed' | 'cancelled'
  totalPaise: Paise
  saleId: UUID | null
  createdAt: ISODateTime
}

export interface Purchase {
  id: UUID
  shopId: UUID
  supplierName: string | null
  totalPaise: Paise
  status: 'draft' | 'received' | 'cancelled'
  purchasedAt: ISODateTime
}

export interface FinancialEntry {
  id: UUID
  shopId: UUID
  kind: FinancialEntryKind
  category: string
  amountPaise: Paise
  description: string | null
  paymentMethod: PaymentMethod | null
  referenceType: 'sale' | 'purchase' | 'manual' | null
  referenceId: UUID | null
  occurredAt: ISODateTime
}

export interface TaxReminder {
  id: UUID
  shopId: UUID
  title: string
  dueDate: string
  status: 'upcoming' | 'completed'
  note: string | null
}

export interface ProcessSaleInput {
  shopId: UUID
  customerId: UUID | null
  source: SaleSource
  sourceOrderId?: UUID | null
  idempotencyKey: string
  items: Array<{ productId: UUID; quantity: number }>
  discountPaise?: Paise
  /** Whole loyalty points to redeem; each point is worth 10 paise in demo mode. */
  redeemPoints?: number
}

export interface ProcessSaleResult {
  saleId: UUID
  invoiceNumber: string
  subtotalPaise: Paise
  taxPaise: Paise
  totalPaise: Paise
}
