import { demoCustomers, demoMetrics, demoProducts, demoReminders, demoSalesSeries } from './demo'
import type {
  Customer, FinancialEntry, InventoryMovement, LoyaltyTransaction, Paise, ProcessSaleInput,
  ProcessSaleResult, Product, Sale, SaleItem,
} from '../../types/domain'

const SHOP_ID = 'demo-shop'
const STORAGE_KEY = 'vyapaaros.pos-inventory.v1'

interface DemoBusinessData {
  products: Product[]
  customers: Customer[]
  sales: Sale[]
  saleItems: SaleItem[]
  inventoryMovements: InventoryMovement[]
  loyaltyTransactions: LoyaltyTransaction[]
  financialEntries: FinancialEntry[]
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

export class DemoDataError extends Error {}

function initialData(): DemoBusinessData {
  return {
    products: demoProducts.map((product) => ({ ...product })),
    customers: demoCustomers.map((customer) => ({ ...customer })),
    sales: [], saleItems: [], inventoryMovements: [], loyaltyTransactions: [], financialEntries: [],
  }
}

function readData(): DemoBusinessData {
  if (typeof window === 'undefined') return initialData()
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialData()
    const parsed = JSON.parse(stored) as Partial<DemoBusinessData>
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.customers) || !Array.isArray(parsed.sales)) return initialData()
    return {
      ...initialData(), ...parsed,
      saleItems: Array.isArray(parsed.saleItems) ? parsed.saleItems : [],
      inventoryMovements: Array.isArray(parsed.inventoryMovements) ? parsed.inventoryMovements : [],
      loyaltyTransactions: Array.isArray(parsed.loyaltyTransactions) ? parsed.loyaltyTransactions : [],
      financialEntries: Array.isArray(parsed.financialEntries) ? parsed.financialEntries : [],
    }
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

/** Demo-only business adapter. It never reads from or writes to Supabase. */
export const demoDataSource = {
  getDashboard() {
    return { metrics: demoMetrics, salesSeries: demoSalesSeries, products: data.products.filter((product) => product.active).map((product) => ({ ...product })), reminders: demoReminders }
  },
  getProducts(): Product[] { return data.products.filter((product) => product.active).map((product) => ({ ...product })) },
  getCustomers(): Customer[] { return data.customers.map((customer) => ({ ...customer })) },
  getSales(): Sale[] { return data.sales.map((sale) => ({ ...sale })) },
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

  /** Local demo equivalent of the future atomic process_sale RPC; this is not a live transaction. */
  completeSale(input: ProcessSaleInput): ProcessSaleResult {
    if (input.shopId !== SHOP_ID || input.source !== 'pos') throw new DemoDataError('This demo checkout only supports the selected shop and POS sales.')
    if (!input.idempotencyKey.trim()) throw new DemoDataError('Checkout reference is missing. Please try again.')
    const existing = data.sales.find((sale) => sale.idempotencyKey === input.idempotencyKey)
    if (existing) return { saleId: existing.id, invoiceNumber: existing.invoiceNumber, subtotalPaise: existing.subtotalPaise, taxPaise: existing.taxPaise, totalPaise: existing.totalPaise }
    if (!input.items.length) throw new DemoDataError('Add at least one product before checkout.')
    if (input.customerId && !data.customers.some((customer) => customer.id === input.customerId)) throw new DemoDataError('Selected customer is not available in this shop.')
    const discountPaise = input.discountPaise ?? 0
    assertPaise(discountPaise, 'Discount')

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
    if (discountPaise > subtotalPaise + taxPaise) throw new DemoDataError('Discount cannot exceed the bill total.')
    const totalPaise = subtotalPaise + taxPaise - discountPaise
    assertPaise(totalPaise, 'Bill total')

    const saleId = makeId('sale')
    const invoiceNumber = `NM-${new Date().getFullYear()}-${String(data.sales.length + 1).padStart(4, '0')}`
    const createdAt = new Date().toISOString()
    const sale: Sale = { id: saleId, shopId: SHOP_ID, customerId: input.customerId, source: 'pos', sourceOrderId: null, invoiceNumber, status: 'completed', subtotalPaise, taxPaise, discountPaise, totalPaise, idempotencyKey: input.idempotencyKey, createdAt }
    const saleLines = lines.map((line) => ({ ...line, saleId }))
    const movements = products.map(({ product, quantity }): InventoryMovement => ({ id: makeId('movement'), shopId: SHOP_ID, productId: product.id, saleId, purchaseId: null, reason: 'sale', quantityDelta: -quantity, createdAt }))
    const points = input.customerId ? Math.floor(totalPaise / 10_000) : 0
    const loyalty = input.customerId && points > 0 ? [{ id: makeId('loyalty'), shopId: SHOP_ID, customerId: input.customerId, saleId, pointsDelta: points, createdAt } satisfies LoyaltyTransaction] : []
    const financialEntry: FinancialEntry = { id: makeId('entry'), shopId: SHOP_ID, kind: 'income', category: 'POS sale', amountPaise: totalPaise, referenceType: 'sale', referenceId: saleId, occurredAt: createdAt }
    const next: DemoBusinessData = {
      ...data,
      products: data.products.map((product) => {
        const line = products.find((entry) => entry.product.id === product.id)
        return line ? { ...product, stockQuantity: product.stockQuantity - line.quantity } : product
      }),
      sales: [...data.sales, sale], saleItems: [...data.saleItems, ...saleLines],
      inventoryMovements: [...data.inventoryMovements, ...movements],
      loyaltyTransactions: [...data.loyaltyTransactions, ...loyalty],
      customers: data.customers.map((customer) => customer.id === input.customerId ? { ...customer, loyaltyPoints: customer.loyaltyPoints + points } : customer),
      financialEntries: [...data.financialEntries, financialEntry],
    }
    persist(next)
    return { saleId, invoiceNumber, subtotalPaise, taxPaise, totalPaise }
  },

  getSaleReceipt(saleId: string) {
    const sale = data.sales.find((item) => item.id === saleId)
    if (!sale) return null
    return { sale: { ...sale }, items: data.saleItems.filter((item) => item.saleId === saleId).map((item) => ({ ...item })), customer: data.customers.find((customer) => customer.id === sale.customerId) ?? null }
  },
}
