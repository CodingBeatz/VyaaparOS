import type { Customer, Product, TaxReminder } from '../../types/domain'

/** Explicit demo-only data; it is not fetched from or written to Supabase. */
export const demoShop = { name: 'Namma Provision Store', location: 'Indiranagar, Bengaluru' }

export const demoProducts: Product[] = [
  { id: 'p1', shopId: 'demo-shop', sku: 'RICE-001', name: 'Sona Masoori Rice', unit: '5 kg bag', salePricePaise: 68500, costPricePaise: 59200, taxRateBps: 0, stockQuantity: 8, lowStockThreshold: 10, active: true },
  { id: 'p2', shopId: 'demo-shop', sku: 'OIL-003', name: 'Sunflower Oil', unit: '1 L bottle', salePricePaise: 14800, costPricePaise: 12700, taxRateBps: 500, stockQuantity: 6, lowStockThreshold: 12, active: true },
  { id: 'p3', shopId: 'demo-shop', sku: 'COFFEE-02', name: 'Filter Coffee Blend', unit: '200 g pack', salePricePaise: 9200, costPricePaise: 7300, taxRateBps: 500, stockQuantity: 24, lowStockThreshold: 8, active: true },
  { id: 'p4', shopId: 'demo-shop', sku: 'SOAP-008', name: 'Mysore Sandal Soap', unit: '150 g bar', salePricePaise: 4200, costPricePaise: 3500, taxRateBps: 1800, stockQuantity: 5, lowStockThreshold: 10, active: true },
]

export const demoCustomers: Customer[] = [
  { id: 'c1', shopId: 'demo-shop', name: 'Ananya Rao', phone: '+91 98765 43210', email: null, loyaltyPoints: 0, createdAt: '2026-09-12T10:00:00Z' },
  { id: 'c2', shopId: 'demo-shop', name: 'Rohit Menon', phone: '+91 98450 12345', email: null, loyaltyPoints: 0, createdAt: '2026-09-20T10:00:00Z' },
]

export const demoReminders: TaxReminder[] = [
  { id: 't1', shopId: 'demo-shop', title: 'Review September sales summary', dueDate: '2026-10-20', status: 'upcoming', note: 'Preparation reminder only; confirm applicable filing dates with your tax professional.' },
]
