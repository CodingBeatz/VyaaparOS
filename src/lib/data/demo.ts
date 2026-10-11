import type { Customer, Product, TaxReminder } from '../../types/domain'

/** Explicit demo-only data; it is not fetched from or written to Supabase. */
export const demoShop = { name: 'Namma Provision Store', location: 'Indiranagar, Bengaluru' }

export const demoMetrics = {
  todaySalesPaise: 48_265_00,
  salesChangePercent: 12.8,
  ordersToday: 38,
  averageOrderPaise: 1_270_00,
  lowStockCount: 4,
  loyaltyMembers: 186,
}

export const demoSalesSeries = [
  { day: 'Mon', current: 32_400, previous: 28_100 },
  { day: 'Tue', current: 38_700, previous: 31_600 },
  { day: 'Wed', current: 35_900, previous: 34_200 },
  { day: 'Thu', current: 44_100, previous: 36_500 },
  { day: 'Fri', current: 40_800, previous: 33_800 },
  { day: 'Sat', current: 52_300, previous: 43_100 },
  { day: 'Sun', current: 48_265, previous: 38_900 },
]

export const demoProducts: Product[] = [
  { id: 'p1', shopId: 'demo-shop', sku: 'RICE-001', name: 'Sona Masoori Rice', unit: '5 kg bag', salePricePaise: 68500, costPricePaise: 59200, taxRateBps: 0, stockQuantity: 8, lowStockThreshold: 10, active: true },
  { id: 'p2', shopId: 'demo-shop', sku: 'OIL-003', name: 'Sunflower Oil', unit: '1 L bottle', salePricePaise: 14800, costPricePaise: 12700, taxRateBps: 500, stockQuantity: 6, lowStockThreshold: 12, active: true },
  { id: 'p3', shopId: 'demo-shop', sku: 'COFFEE-02', name: 'Filter Coffee Blend', unit: '200 g pack', salePricePaise: 9200, costPricePaise: 7300, taxRateBps: 500, stockQuantity: 24, lowStockThreshold: 8, active: true },
  { id: 'p4', shopId: 'demo-shop', sku: 'SOAP-008', name: 'Mysore Sandal Soap', unit: '150 g bar', salePricePaise: 4200, costPricePaise: 3500, taxRateBps: 1800, stockQuantity: 5, lowStockThreshold: 10, active: true },
]

export const demoCustomers: Customer[] = [
  { id: 'c1', shopId: 'demo-shop', name: 'Ananya Rao', phone: '+91 98765 43210', email: null, loyaltyPoints: 420, createdAt: '2026-09-12T10:00:00Z' },
  { id: 'c2', shopId: 'demo-shop', name: 'Rohit Menon', phone: '+91 98450 12345', email: null, loyaltyPoints: 285, createdAt: '2026-09-20T10:00:00Z' },
]

export const demoReminders: TaxReminder[] = [
  { id: 't1', shopId: 'demo-shop', title: 'Review September sales summary', dueDate: '2026-10-20', status: 'upcoming', note: 'Preparation reminder only; confirm applicable filing dates with your tax professional.' },
]
