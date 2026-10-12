import { demoCustomers, demoProducts, demoReminders } from './demo'
import { getDemoDashboardSummary } from './dashboardMetrics'
import type {
  Customer, FinancialEntry, InventoryMovement, LoyaltyTransaction, Paise, PaymentMethod, ProcessSaleInput,
  ProcessSaleResult, Product, Sale, SaleItem, OnlineListing,
} from '../../types/domain'
import { isValidIndianMobile } from '../validation'
import { getLoyaltyRedemptionPreview } from '../loyaltyRedemption'
import { normalizeOnlineListings, validateOnlineListing, type OnlineListingDraft } from '../storefront'

const SHOP_ID = 'demo-shop'
const STORAGE_KEY = 'vyapaaros.pos-inventory.v1'

interface DemoBusinessData {
  products: Product[]
  onlineListings: OnlineListing[]
  customers: Customer[]
  sales: Sale[]
  saleItems: SaleItem[]
  inventoryMovements: InventoryMovement[]
  loyaltyTransactions: LoyaltyTransaction[]
  financialEntries: FinancialEntry[]
  /** One-time cleanup of the original, unexplained sample balances. */
  loyaltySeedMigrationVersion: number
}

export interface LoyaltyAdjustmentDraft {
  customerId: string
  adjustmentType: 'add' | 'deduct'
  amount: number
  reason: string
}

export interface ProductDraft {
  sku: string | null
  name: string
  unit: string
  salePricePaise: Paise
  costPricePaise: Paise
  taxRateBps: number
  lowStockThreshold: number
}

export interface StockAdjustment {
  productId: string
  quantityDelta: number
}

export interface CustomerDraft {
  name: string
  phone: string
  email: string
}

export interface ExpenseDraft {
  description: string
  category: string
  amountPaise: Paise
  occurredOn: string
  paymentMethod: PaymentMethod
}

export class DemoDataError extends Error {}

function initialData(): DemoBusinessData {
  return {
    products: demoProducts.map((product) => ({ ...product })), onlineListings: [],
    customers: demoCustomers.map((customer) => ({ ...customer })),
    sales: [], saleItems: [], inventoryMovements: [], loyaltyTransactions: [], financialEntries: [], loyaltySeedMigrationVersion: 1,
  }
}

function normalizeLoyaltyTransactions(value: unknown): LoyaltyTransaction[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const transaction = entry as Partial<LoyaltyTransaction>
    const transactionType = transaction.transactionType ?? (transaction.saleId ? 'sale' : (transaction.pointsDelta ?? 0) < 0 ? 'adjustment_deduct' : 'adjustment_add')
    return { ...transaction, transactionType, reason: transaction.reason ?? null } as LoyaltyTransaction
  })
}

function migrateLegacySeedPoints(snapshot: DemoBusinessData, migrationVersion: number): DemoBusinessData {
  if (migrationVersion >= 1) return snapshot
  const knownSeedBalances = new Map([['c1', 420], ['c2', 285]])
  const customers = snapshot.customers.map((customer) => {
    const seedBalance = knownSeedBalances.get(customer.id)
    if (seedBalance === undefined) return customer
    const customerTransactions = snapshot.loyaltyTransactions.filter((transaction) => transaction.customerId === customer.id)
    const ledgerDelta = customerTransactions.reduce((sum, transaction) => sum + transaction.pointsDelta, 0)
    const hasCompletedSale = snapshot.sales.some((sale) => sale.customerId === customer.id && sale.status === 'completed')
    // The old demo balances were fixed seed values. Remove only that baseline when the
    // stored total is exactly explained by it plus the existing transaction ledger.
    if (customer.loyaltyPoints === seedBalance + ledgerDelta && (customerTransactions.length > 0 || hasCompletedSale)) {
      return { ...customer, loyaltyPoints: Math.max(0, ledgerDelta) }
    }
    if (customer.loyaltyPoints === seedBalance && !customerTransactions.length && !hasCompletedSale) {
      return { ...customer, loyaltyPoints: 0 }
    }
    return customer
  })
  return { ...snapshot, customers, loyaltySeedMigrationVersion: 1 }
}

function readData(): DemoBusinessData {
  if (typeof window === 'undefined') return initialData()
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialData()
    const parsed = JSON.parse(stored) as Partial<DemoBusinessData>
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.customers) || !Array.isArray(parsed.sales)) return initialData()
    let snapshot: DemoBusinessData = {
      ...initialData(), ...parsed,
      onlineListings: normalizeOnlineListings(parsed.onlineListings, parsed.products as Product[]),
      saleItems: Array.isArray(parsed.saleItems) ? parsed.saleItems : [],
      inventoryMovements: Array.isArray(parsed.inventoryMovements) ? parsed.inventoryMovements : [],
      loyaltyTransactions: normalizeLoyaltyTransactions(parsed.loyaltyTransactions),
      financialEntries: Array.isArray(parsed.financialEntries) ? parsed.financialEntries.map((entry) => {
        const legacy = entry as FinancialEntry
        return { ...legacy, description: legacy.description ?? null, paymentMethod: legacy.paymentMethod ?? null }
      }) : [],
      loyaltySeedMigrationVersion: typeof parsed.loyaltySeedMigrationVersion === 'number' ? parsed.loyaltySeedMigrationVersion : 0,
    }
    snapshot = migrateLegacySeedPoints(snapshot, snapshot.loyaltySeedMigrationVersion)
    if (snapshot.loyaltySeedMigrationVersion !== parsed.loyaltySeedMigrationVersion) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)) } catch { /* Best effort; in-memory state still uses the migrated snapshot. */ }
    }
    return snapshot
  } catch {
    return initialData()
  }
}

let data = readData()

function persist(next: DemoBusinessData) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      throw new DemoDataError('This browser could not save demo changes. Check available local storage and try again.')
    }
  }
  data = next
}

function makeId(prefix: string): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${id}`
}

function assertPaise(value: number, label: string, allowZero = true) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new DemoDataError(`${label} must be a valid amount in paise.`)
}

function taxFor(subtotalPaise: number, taxRateBps: number): number {
  const tax = (BigInt(subtotalPaise) * BigInt(taxRateBps) + 5_000n) / 10_000n
  const value = Number(tax)
  if (!Number.isSafeInteger(value)) throw new DemoDataError('This total is too large to calculate safely.')
  return value
}

function ensureProductDraft(draft: ProductDraft) {
  if (!draft.name.trim() || draft.name.trim().length > 100) throw new DemoDataError('Enter a product name (up to 100 characters).')
  if (!draft.unit.trim() || draft.unit.trim().length > 40) throw new DemoDataError('Enter a unit (up to 40 characters).')
  if ((draft.sku?.trim().length ?? 0) > 40) throw new DemoDataError('SKU must be 40 characters or fewer.')
  assertPaise(draft.salePricePaise, 'Sale price')
  assertPaise(draft.costPricePaise, 'Cost price')
  if (!Number.isInteger(draft.taxRateBps) || draft.taxRateBps < 0 || draft.taxRateBps > 100_00) throw new DemoDataError('Enter a valid tax rate.')
  if (!Number.isInteger(draft.lowStockThreshold) || draft.lowStockThreshold < 0 || draft.lowStockThreshold > 1_000_000) throw new DemoDataError('Enter a valid low-stock level.')
}

function normalizeExpenseDraft(draft: ExpenseDraft): ExpenseDraft {
  const description = draft.description.trim()
  const category = draft.category.trim()
  if (!description || description.length > 180) throw new DemoDataError('Enter an expense description (up to 180 characters).')
  if (!category || category.length > 50) throw new DemoDataError('Choose an expense category (up to 50 characters).')
  assertPaise(draft.amountPaise, 'Expense amount', false)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.occurredOn) || new Date(`${draft.occurredOn}T12:00:00.000Z`).toISOString().slice(0, 10) !== draft.occurredOn) {
    throw new DemoDataError('Enter a valid expense date.')
  }
  if (!['cash', 'upi', 'card', 'bank_transfer', 'other'].includes(draft.paymentMethod)) throw new DemoDataError('Choose a valid payment method.')
  return { ...draft, description, category }
}

function normalizeCustomerDraft(draft: CustomerDraft): Pick<Customer, 'name' | 'phone' | 'email'> {
  const name = draft.name.trim()
  if (!name || name.length > 100) throw new DemoDataError('Enter a customer name (up to 100 characters).')

  let phone: string | null = null
  const phoneInput = draft.phone.trim()
  if (phoneInput) {
    const digits = phoneInput.replace(/\D/g, '')
    const mobile = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
    if (!isValidIndianMobile(mobile)) throw new DemoDataError('Enter a valid 10-digit Indian mobile number.')
    phone = `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`
  }

  const emailInput = draft.email.trim()
  if (emailInput.length > 254 || (emailInput && !isValidCustomerEmail(emailInput))) {
    throw new DemoDataError('Enter a valid email address (up to 254 characters).')
  }
  return { name, phone, email: emailInput || null }
}

function isValidCustomerEmail(email: string): boolean {
  const [local, domain, ...extra] = email.split('@')
  if (!local || !domain || extra.length || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') || /\s/.test(email)) return false
  const labels = domain.split('.')
  return labels.length > 1 && labels.at(-1)!.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
}

function assertUniqueCustomerDetails(candidate: Pick<Customer, 'name' | 'phone' | 'email'>, excludeId?: string) {
  const phoneDigits = candidate.phone?.replace(/\D/g, '') ?? null
  const email = candidate.email?.toLocaleLowerCase() ?? null
  const duplicate = data.customers.find((customer) => {
    if (customer.id === excludeId) return false
    const samePhone = phoneDigits && customer.phone?.replace(/\D/g, '') === phoneDigits
    const sameEmail = email && customer.email?.toLocaleLowerCase() === email
    const bothWithoutContact = !phoneDigits && !email && !customer.phone && !customer.email && customer.name.trim().toLocaleLowerCase() === candidate.name.toLocaleLowerCase()
    return Boolean(samePhone || sameEmail || bothWithoutContact)
  })
  if (duplicate) throw new DemoDataError('A customer with matching contact details already exists. Customers without contact details must have a distinct name.')
}

/** Demo-only business adapter. It never reads from or writes to Supabase. */
export const demoDataSource = {
  getDashboard() {
    const summary = getDemoDashboardSummary(data.sales, data.products, data.customers)
    return { ...summary, products: summary.lowStockProducts.map((product) => ({ ...product })), reminders: demoReminders }
  },
  getProducts(): Product[] { return data.products.filter((product) => product.active).map((product) => ({ ...product })) },
  getOnlineListings(): OnlineListing[] { return data.onlineListings.map((listing) => ({ ...listing })) },
  setOnlineListing(productId: string, draft: OnlineListingDraft): OnlineListing {
    const product = data.products.find((item) => item.id === productId && item.active)
    if (!product) throw new DemoDataError('This product is no longer available in Inventory.')
    const listing = validateOnlineListing(product, draft)
    persist({ ...data, onlineListings: [...data.onlineListings.filter((item) => item.productId !== productId), listing] })
    return { ...listing }
  },
  getCustomers(): Customer[] { return data.customers.map((customer) => ({ ...customer })) },
  addCustomer(draft: CustomerDraft): Customer {
    const details = normalizeCustomerDraft(draft)
    assertUniqueCustomerDetails(details)
    const customer: Customer = { ...details, id: makeId('customer'), shopId: SHOP_ID, loyaltyPoints: 0, createdAt: new Date().toISOString() }
    persist({ ...data, customers: [...data.customers, customer] })
    return { ...customer }
  },
  updateCustomer(customerId: string, draft: CustomerDraft): Customer {
    const existing = data.customers.find((customer) => customer.id === customerId)
    if (!existing) throw new DemoDataError('This customer is no longer available.')
    const details = normalizeCustomerDraft(draft)
    assertUniqueCustomerDetails(details, customerId)
    const updated = { ...existing, ...details }
    persist({ ...data, customers: data.customers.map((customer) => customer.id === customerId ? updated : customer) })
    return { ...updated }
  },
  getLoyaltyTransactions(customerId: string): LoyaltyTransaction[] {
    return data.loyaltyTransactions.filter((transaction) => transaction.customerId === customerId).map((transaction) => ({ ...transaction }))
  },
  applyLoyaltyAdjustment(draft: LoyaltyAdjustmentDraft): LoyaltyTransaction {
    if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0) throw new DemoDataError('Enter a positive whole number of points.')
    if (draft.adjustmentType !== 'add' && draft.adjustmentType !== 'deduct') throw new DemoDataError('Choose whether to add or deduct points.')
    const reason = draft.reason.trim()
    if (!reason || reason.length > 240) throw new DemoDataError('Enter a reason (up to 240 characters) for this adjustment.')
    const customer = data.customers.find((item) => item.id === draft.customerId)
    if (!customer) throw new DemoDataError('This customer is no longer available.')
    const deduction = draft.adjustmentType === 'deduct'
    if (deduction && draft.amount > customer.loyaltyPoints) throw new DemoDataError('This customer does not have enough points for that deduction.')
    const pointsDelta = deduction ? -draft.amount : draft.amount
    const loyaltyPoints = customer.loyaltyPoints + pointsDelta
    if (!Number.isSafeInteger(loyaltyPoints)) throw new DemoDataError('The resulting points balance is too large.')
    const transaction: LoyaltyTransaction = {
      id: makeId('loyalty'), shopId: SHOP_ID, customerId: customer.id, saleId: null,
      pointsDelta, transactionType: deduction ? 'adjustment_deduct' : 'adjustment_add', reason, createdAt: new Date().toISOString(),
    }
    persist({
      ...data,
      customers: data.customers.map((item) => item.id === customer.id ? { ...item, loyaltyPoints } : item),
      loyaltyTransactions: [...data.loyaltyTransactions, transaction],
    })
    return { ...transaction }
  },
  getSales(): Sale[] { return data.sales.map((sale) => ({ ...sale })) },
  getFinancialEntries(): FinancialEntry[] { return data.financialEntries.map((entry) => ({ ...entry })) },
  getSaleItems(saleId: string): SaleItem[] { return data.saleItems.filter((item) => item.saleId === saleId).map((item) => ({ ...item })) },
  getInventoryMovements(): InventoryMovement[] { return data.inventoryMovements.map((movement) => ({ ...movement })) },

  addProduct(draft: ProductDraft, startingStock: number): Product {
    ensureProductDraft(draft)
    if (!Number.isInteger(startingStock) || startingStock < 0 || startingStock > 1_000_000) throw new DemoDataError('Starting stock must be a whole number from 0 to 1,000,000.')
    const sku = draft.sku?.trim() || null
    if (sku && data.products.some((product) => product.sku?.toLowerCase() === sku.toLowerCase())) throw new DemoDataError('That SKU is already in use.')
    const product: Product = { ...draft, sku, name: draft.name.trim(), unit: draft.unit.trim(), id: makeId('product'), shopId: SHOP_ID, stockQuantity: startingStock, active: true }
    persist({ ...data, products: [...data.products, product] })
    return { ...product }
  },

  updateProduct(productId: string, draft: ProductDraft): Product {
    ensureProductDraft(draft)
    const existing = data.products.find((product) => product.id === productId && product.active)
    if (!existing) throw new DemoDataError('This product is no longer available.')
    const sku = draft.sku?.trim() || null
    if (sku && data.products.some((product) => product.id !== productId && product.sku?.toLowerCase() === sku.toLowerCase())) throw new DemoDataError('That SKU is already in use.')
    const updated = { ...existing, ...draft, sku, name: draft.name.trim(), unit: draft.unit.trim() }
    persist({ ...data, products: data.products.map((product) => product.id === productId ? updated : product) })
    return { ...updated }
  },

  adjustStock({ productId, quantityDelta }: StockAdjustment): Product {
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0 || Math.abs(quantityDelta) > 1_000_000) throw new DemoDataError('Enter a non-zero whole-number adjustment.')
    const product = data.products.find((item) => item.id === productId && item.active)
    if (!product) throw new DemoDataError('This product is no longer available.')
    const stockQuantity = product.stockQuantity + quantityDelta
    if (stockQuantity < 0) throw new DemoDataError(`Only ${product.stockQuantity} ${product.unit} available. Stock cannot go below zero.`)
    if (stockQuantity > 1_000_000) throw new DemoDataError('Stock cannot exceed 1,000,000 units.')
    const movement: InventoryMovement = { id: makeId('movement'), shopId: SHOP_ID, productId, saleId: null, purchaseId: null, reason: 'adjustment', quantityDelta, createdAt: new Date().toISOString() }
    const updated = { ...product, stockQuantity }
    persist({ ...data, products: data.products.map((item) => item.id === productId ? updated : item), inventoryMovements: [...data.inventoryMovements, movement] })
    return { ...updated }
  },

  addExpense(draft: ExpenseDraft): FinancialEntry {
    const expense = normalizeExpenseDraft(draft)
    const entry: FinancialEntry = {
      id: makeId('entry'), shopId: SHOP_ID, kind: 'expense', category: expense.category,
      amountPaise: expense.amountPaise, description: expense.description, paymentMethod: expense.paymentMethod,
      referenceType: 'manual', referenceId: null, occurredAt: `${expense.occurredOn}T12:00:00.000Z`,
    }
    persist({ ...data, financialEntries: [...data.financialEntries, entry] })
    return { ...entry }
  },

  updateExpense(entryId: string, draft: ExpenseDraft): FinancialEntry {
    const existing = data.financialEntries.find((entry) => entry.id === entryId && entry.kind === 'expense' && entry.referenceType === 'manual')
    if (!existing) throw new DemoDataError('This expense is no longer available.')
    const expense = normalizeExpenseDraft(draft)
    const updated: FinancialEntry = {
      ...existing, category: expense.category, amountPaise: expense.amountPaise,
      description: expense.description, paymentMethod: expense.paymentMethod,
      occurredAt: `${expense.occurredOn}T12:00:00.000Z`,
    }
    persist({ ...data, financialEntries: data.financialEntries.map((entry) => entry.id === entryId ? updated : entry) })
    return { ...updated }
  },

  deleteExpense(entryId: string): void {
    const existing = data.financialEntries.find((entry) => entry.id === entryId && entry.kind === 'expense' && entry.referenceType === 'manual')
    if (!existing) throw new DemoDataError('This expense is no longer available.')
    persist({ ...data, financialEntries: data.financialEntries.filter((entry) => entry.id !== entryId) })
  },

  /** Local demo equivalent of the future atomic process_sale RPC; this is not a live transaction. */
  completeSale(input: ProcessSaleInput): ProcessSaleResult {
    if (input.shopId !== SHOP_ID || input.source !== 'pos') throw new DemoDataError('This demo checkout only supports the selected shop and POS sales.')
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 128) throw new DemoDataError('Checkout reference must be between 1 and 128 characters.')
    const existing = data.sales.find((sale) => sale.idempotencyKey === input.idempotencyKey)
    if (existing) return { saleId: existing.id, invoiceNumber: existing.invoiceNumber, subtotalPaise: existing.subtotalPaise, taxPaise: existing.taxPaise, totalPaise: existing.totalPaise }
    if (!input.items.length) throw new DemoDataError('Add at least one product before checkout.')
    const customer = input.customerId ? data.customers.find((item) => item.id === input.customerId && item.shopId === input.shopId) : null
    if (input.customerId && !customer) throw new DemoDataError('Selected customer is not available in this shop.')
    const discountPaise = input.discountPaise ?? 0
    assertPaise(discountPaise, 'Discount')
    const redeemPoints = input.redeemPoints ?? 0
    if (!Number.isSafeInteger(redeemPoints) || redeemPoints < 0) throw new DemoDataError('Redeem points must be a whole number of zero or more.')
    if (redeemPoints > 0 && !customer) throw new DemoDataError('Select a customer before redeeming loyalty points.')
    if (customer && redeemPoints > customer.loyaltyPoints) throw new DemoDataError(`Only ${customer.loyaltyPoints} loyalty points are available.`)

    const quantities = new Map<string, number>()
    for (const line of input.items) {
      if (!Number.isInteger(line.quantity) || line.quantity <= 0 || line.quantity > 1_000_000) throw new DemoDataError('Cart quantities must be positive whole numbers.')
      quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity)
    }
    const products = [...quantities].map(([productId, quantity]) => {
      const product = data.products.find((item) => item.id === productId && item.active)
      if (!product || product.shopId !== input.shopId) throw new DemoDataError('A product in this cart is no longer available.')
      if (quantity > product.stockQuantity) throw new DemoDataError(`${product.name}: only ${product.stockQuantity} ${product.unit} available.`)
      assertPaise(product.salePricePaise, 'Product price')
      return { product, quantity }
    })

    const lines = products.map(({ product, quantity }): SaleItem => {
      const lineSubtotalPaise = product.salePricePaise * quantity
      assertPaise(lineSubtotalPaise, 'Line total')
      const lineTaxPaise = taxFor(lineSubtotalPaise, product.taxRateBps)
      const lineTotalPaise = lineSubtotalPaise + lineTaxPaise
      assertPaise(lineTotalPaise, 'Line total')
      return { id: makeId('item'), saleId: '', productId: product.id, productNameSnapshot: product.name, quantity, unitPricePaise: product.salePricePaise, taxRateBps: product.taxRateBps, lineSubtotalPaise, lineTaxPaise, lineTotalPaise }
    })
    const subtotalPaise = lines.reduce((sum, line) => sum + line.lineSubtotalPaise, 0)
    const taxPaise = lines.reduce((sum, line) => sum + line.lineTaxPaise, 0)
    assertPaise(subtotalPaise, 'Subtotal')
    assertPaise(taxPaise, 'Tax')
    const grossPaise = subtotalPaise + taxPaise
    assertPaise(grossPaise, 'Bill total before discount')
    const redemption = getLoyaltyRedemptionPreview(redeemPoints, customer?.loyaltyPoints ?? 0, subtotalPaise - discountPaise, Boolean(customer), true)
    if (redemption.error) throw new DemoDataError(redemption.error)
    const loyaltyDiscountPaise = redemption.discountPaise
    assertPaise(loyaltyDiscountPaise, 'Loyalty discount')
    const totalDiscountPaise = discountPaise + loyaltyDiscountPaise
    assertPaise(totalDiscountPaise, 'Total discount')
    if (totalDiscountPaise > subtotalPaise) throw new DemoDataError('Discount cannot exceed the eligible bill subtotal.')
    if (loyaltyDiscountPaise > subtotalPaise - discountPaise) throw new DemoDataError('Loyalty discount cannot exceed the eligible bill subtotal.')
    const totalPaise = grossPaise - totalDiscountPaise
    assertPaise(totalPaise, 'Bill total')

    const saleId = makeId('sale')
    const invoiceNumber = `NM-${new Date().getFullYear()}-${String(data.sales.length + 1).padStart(4, '0')}`
    const createdAt = new Date().toISOString()
    const sale: Sale = { id: saleId, shopId: SHOP_ID, customerId: input.customerId, source: 'pos', sourceOrderId: null, invoiceNumber, status: 'completed', subtotalPaise, taxPaise, discountPaise: totalDiscountPaise, totalPaise, idempotencyKey: input.idempotencyKey, createdAt }
    const saleLines = lines.map((line) => ({ ...line, saleId }))
    const movements = products.map(({ product, quantity }): InventoryMovement => ({ id: makeId('movement'), shopId: SHOP_ID, productId: product.id, saleId, purchaseId: null, reason: 'sale', quantityDelta: -quantity, createdAt }))
    const pointsEarned = customer ? Math.floor(totalPaise / 10_000) : 0
    const loyalty: LoyaltyTransaction[] = []
    if (customer && redeemPoints > 0) loyalty.push({ id: makeId('loyalty'), shopId: SHOP_ID, customerId: customer.id, saleId, pointsDelta: -redeemPoints, transactionType: 'redemption', reason: 'POS checkout redemption', createdAt })
    if (customer && pointsEarned > 0) loyalty.push({ id: makeId('loyalty'), shopId: SHOP_ID, customerId: customer.id, saleId, pointsDelta: pointsEarned, transactionType: 'sale', reason: null, createdAt })
    const financialEntry: FinancialEntry = { id: makeId('entry'), shopId: SHOP_ID, kind: 'income', category: 'POS sale', amountPaise: totalPaise, description: `POS sale ${invoiceNumber}`, paymentMethod: null, referenceType: 'sale', referenceId: saleId, occurredAt: createdAt }
    const next: DemoBusinessData = {
      ...data,
      products: data.products.map((product) => {
        const line = products.find((entry) => entry.product.id === product.id)
        return line ? { ...product, stockQuantity: product.stockQuantity - line.quantity } : product
      }),
      sales: [...data.sales, sale], saleItems: [...data.saleItems, ...saleLines],
      inventoryMovements: [...data.inventoryMovements, ...movements],
      loyaltyTransactions: [...data.loyaltyTransactions, ...loyalty],
      customers: data.customers.map((item) => item.id === customer?.id ? { ...item, loyaltyPoints: item.loyaltyPoints - redeemPoints + pointsEarned } : item),
      financialEntries: [...data.financialEntries, financialEntry],
    }
    persist(next)
    return { saleId, invoiceNumber, subtotalPaise, taxPaise, totalPaise }
  },

  getSaleReceipt(saleId: string) {
    const sale = data.sales.find((item) => item.id === saleId)
    if (!sale) return null
    return {
      sale: { ...sale },
      items: data.saleItems.filter((item) => item.saleId === saleId).map((item) => ({ ...item })),
      customer: data.customers.find((customer) => customer.id === sale.customerId) ?? null,
      loyaltyTransactions: data.loyaltyTransactions.filter((transaction) => transaction.saleId === saleId).map((transaction) => ({ ...transaction })),
    }
  },
}
