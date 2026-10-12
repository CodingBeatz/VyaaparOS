import { Link } from 'react-router-dom'
import {
  ArrowRight, ChevronDown, CreditCard,
  MoreHorizontal, PackagePlus, ShoppingBag, ShoppingCart, Sparkles, Wallet,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { demoDataSource } from '../../lib/data/demoDataSource'
import { formatCompactINR, formatDate, formatINR } from '../../lib/format'
import type { Product } from '../../types/domain'
import { DemoNotice } from '../../components/ui/DemoStatus'

type IconType = typeof Wallet

export default function DashboardPage({ onNewSale }: { onNewSale: () => void }) {
  const { metrics, salesSeries, products, reminders, hasRecentSales } = demoDataSource.getDashboard()
  return <>
    <div className="page-heading heading-with-action">
      <div><div className="eyebrow">{formatDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()} <span className="eyebrow-dot" /> YOUR STORE AT A GLANCE</div><h1>Good morning, Ravi <span className="wave">✦</span></h1><p>Here’s what’s happening at Namma Provision Store today.</p></div>
      <button className="primary-button" onClick={onNewSale}><ShoppingCart size={16} /> New sale <span className="button-plus">+</span></button>
    </div>

    <section className="metrics-grid" aria-label="Today's business indicators">
      <MetricCard title="Today’s sales" value={formatINR(metrics.todaySalesPaise)} detail="Completed bills · demo records" icon={Wallet} tone="green" />
      <MetricCard title="Orders today" value={String(metrics.ordersToday)} detail="Completed bills · demo records" icon={ShoppingBag} tone="blue" />
      <MetricCard title="Average order value" value={formatINR(metrics.averageOrderPaise)} detail="Average of completed bills today" icon={CreditCard} tone="lilac" />
      <MetricCard title="Items running low" value={String(metrics.lowStockCount)} detail="Active products at or below threshold" icon={PackagePlus} tone="orange" />
    </section>

    <section className="dashboard-grid">
      <div className="panel sales-panel">
        <div className="panel-heading"><div><div className="panel-kicker">SALES OVERVIEW</div><h2>This week at a glance</h2></div><button className="select-button" disabled title="Date filters are not part of this milestone">This week <ChevronDown size={14} /></button></div>
        <div className="chart-legend"><span><i className="legend-current" /> This week</span><span><i className="legend-previous" /> Last week</span></div>
        {hasRecentSales ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={salesSeries} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
          <defs><linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3a815e" stopOpacity={0.16} /><stop offset="100%" stopColor="#3a815e" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid stroke="#eef0ec" strokeDasharray="4 5" vertical={false} />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8b928b', fontSize: 11 }} dy={11} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b928b', fontSize: 11 }} tickFormatter={(value: number) => formatCompactINR(value)} />
          <Tooltip content={<SalesTooltip />} />
          <Area type="monotone" dataKey="previous" stroke="#bdc8bd" strokeWidth={2} strokeDasharray="4 5" fill="transparent" activeDot={false} name="Last week" />
          <Area type="monotone" dataKey="current" stroke="#367b59" strokeWidth={2.5} fill="url(#salesGradient)" activeDot={{ r: 4, fill: '#367b59', stroke: '#fff', strokeWidth: 2 }} name="This week" />
        </AreaChart></ResponsiveContainer></div> : <div className="dashboard-chart-empty"><strong>No completed sales in this 14-day period</strong><span>Finish a demo POS bill to see the sales trend here.</span></div>}
        <div className="chart-footnote"><span>Daily completed sale totals after discounts</span><span>Current week and previous week · demo records</span></div>
      </div>

      <div className="panel stock-panel">
        <div className="panel-heading"><div><div className="panel-kicker">STOCK CHECK</div><h2>Running low</h2></div><Link className="text-button" to="/inventory">View inventory <ArrowRight size={14} /></Link></div>
        <div className="stock-list">{products.slice(0, 3).map((product) => <StockRow key={product.id} product={product} />)}{products.length === 0 && <div className="dashboard-stock-empty">No active products are at or below their low-stock threshold.</div>}</div>
        <button className="replenish-button" disabled title="Replenishment workflow is coming later"><PackagePlus size={15} /> Create a replenishment list <ArrowRight size={14} /></button>
      </div>
    </section>

    <section className="bottom-grid">
      <div className="panel activity-panel">
        <div className="panel-heading"><div><div className="panel-kicker">STORE PULSE</div><h2>Today so far</h2></div><button className="icon-button small-icon" aria-label="More store activity" disabled><MoreHorizontal size={18} /></button></div>
        <div className="pulse-stats"><div><strong>{metrics.ordersToday}</strong><span>completed bills today</span></div><div><strong>{metrics.loyaltyMembers}</strong><span>customer profiles</span></div><div><strong>—</strong><span>online orders · not tracked</span></div></div>
        <div className="pulse-note"><span className="pulse-spark"><Sparkles size={15} /></span><span>Only completed sales are counted. No live payment or online order data is connected.</span></div>
      </div>
      <div className="panel reminder-panel">
        <div className="panel-heading"><div><div className="panel-kicker">COMING UP</div><h2>A little heads-up</h2></div><span className="count-badge">{reminders.length}</span></div>
        {reminders.map((reminder) => <div className="reminder-item" key={reminder.id}><div className="reminder-calendar"><span>{new Date(`${reminder.dueDate}T12:00:00`).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</span><strong>{new Date(`${reminder.dueDate}T12:00:00`).getDate()}</strong></div><div className="reminder-copy"><strong>{reminder.title}</strong><span>Preparation reminder · {formatDate(reminder.dueDate, { day: 'numeric', month: 'short' })}</span></div><ArrowRight size={15} className="muted" /></div>)}
        <p className="fine-print">For planning only. Please confirm filing requirements with a tax professional.</p>
      </div>
    </section>
    <DemoNotice>You’re exploring VyapaarOS demo data. Nothing here is connected to a live store.</DemoNotice>
  </>
}

function MetricCard({ title, value, detail, icon: Icon, tone }: { title: string; value: string; detail: string; icon: IconType; tone: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}><Icon size={17} strokeWidth={1.8} /></span></div><div className="metric-value">{value}</div><div className="metric-foot">{detail}</div></article>
}

function SalesTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item) => <div key={item.name}><i style={{ background: item.color }} />{item.name}<b>{formatINR(item.value)}</b></div>)}</div>
}

function StockRow({ product }: { product: Product }) {
  const ratio = product.lowStockThreshold > 0 ? Math.min(100, (product.stockQuantity / product.lowStockThreshold) * 100) : 100
  return <div className="stock-row"><div className="product-thumb">{product.name.charAt(0)}</div><div className="stock-copy"><strong>{product.name}</strong><span>{product.unit}{product.sku ? ` · SKU ${product.sku}` : ''}</span><div className="stock-meter"><i style={{ width: `${ratio}%` }} /></div></div><div className="stock-qty"><strong>{product.stockQuantity}</strong><span>left</span></div></div>
}
