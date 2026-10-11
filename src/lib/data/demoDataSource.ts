import { demoCustomers, demoMetrics, demoProducts, demoReminders, demoSalesSeries } from './demo'

/** UI-facing demo adapter; replace with a separately implemented Supabase adapter later. */
export const demoDataSource = {
  getDashboard() {
    return { metrics: demoMetrics, salesSeries: demoSalesSeries, products: demoProducts, reminders: demoReminders }
  },
  getProducts() { return demoProducts },
  getCustomers() { return demoCustomers },
}
