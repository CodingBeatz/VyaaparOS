import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, ReceiptText, Banknote } from 'lucide-react'
import { demoMetrics, demoSalesSeries } from '../../lib/data/demo'
import { formatINR } from '../../lib/format'
import { DemoNotice } from '../../components/ui/DemoStatus'

type Period = '7 days' | 'Today'

export default function FinancePage() {
const [period, setPeriod] = useState<Period>('7 days')

const finance = useMemo(() => {
const sales =
period === 'Today'
? demoMetrics.todaySalesPaise
: demoSalesSeries.reduce((sum, day) => sum + day.current, 0)

const previousSales =
period === 'Today'
? sales
: demoSalesSeries.reduce((sum, day) => sum + day.previous, 0)

const estimatedCost = Math.round(sales * 0.72)
const estimatedProfit = sales - estimatedCost
const change =
previousSales > 0
? ((sales - previousSales) / previousSales) * 100
: 0

return { sales, estimatedCost, estimatedProfit, change }
}, [period])
const money = (paise: number) => formatINR(paise)


return ( <div className="feature-page"> <div className="page-heading"> <div> <div className="eyebrow">MONEY, MADE CLEAR</div> <h1>Finance</h1> <p>Understand your sales and estimated business performance.</p> </div>
<select
className="select-button"
value={period}
onChange={(event) => setPeriod(event.target.value as Period)}
aria-label="Finance reporting period"
> <option>7 days</option> <option>Today</option> </select> </div>

```
  <div className="metric-grid">
    <div className="metric-card">
      <div className="metric-label"><Wallet size={17} /> Sales recorded</div>
      <div className="metric-value">{money(finance.sales)}</div>
      <div className="metric-foot">Demo sales data</div>
    </div>
    <div className="metric-card">
      <div className="metric-label"><ReceiptText size={17} /> Estimated costs</div>
      <div className="metric-value">{money(finance.estimatedCost)}</div>
      <div className="metric-foot">Illustrative estimate only</div>
    </div>
    <div className="metric-card">
      <div className="metric-label"><TrendingUp size={17} /> Estimated profit</div>
      <div className="metric-value">{money(finance.estimatedProfit)}</div>
      <div className="metric-foot">Sales minus estimated costs</div>
    </div>
    <div className="metric-card">
      <div className="metric-label">
        {finance.change >= 0 ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
        Sales change
      </div>
      <div className="metric-value">{finance.change >= 0 ? '+' : ''}{finance.change.toFixed(1)}%</div>
      <div className="metric-foot">Compared with previous demo period</div>
    </div>
  </div>

  <div className="panel">
    <div className="table-toolbar">
      <div>
        <h2>Sales overview</h2>
        <span>Recorded sample sales by day</span>
      </div>
      <Banknote size={22} />
    </div>
    <div className="table-scroll">
      <table>
        <thead>
          <tr><th>Day</th><th>Current period</th><th>Previous period</th><th>Difference</th></tr>
        </thead>
        <tbody>
          {demoSalesSeries.map((day) => (
            <tr key={day.day}>
              <td><strong>{day.day}</strong></td>
              <td>{money(day.current)}</td>
              <td>{money(day.previous)}</td>
              <td>{money(day.current - day.previous)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>

  <div className="panel">
    <div className="table-toolbar">
      <div>
        <h2>Cash-flow notes</h2>
        <span>What these figures do—and don't—tell you</span>
      </div>
    </div>
    <div className="placeholder-copy">
      <p>Sales are not the same as cash available. Supplier payments, rent, wages, refunds and other expenses are not included in this demo calculation.</p>
      <p>No actual expense entries or bank balances are connected yet, so profit and cash flow cannot be confirmed.</p>
    </div>
  </div>

  <DemoNotice>
    Demo data only. Estimated costs assume 72% of sales for illustration; this is not actual profit or accounting advice.
  </DemoNotice>
</div>

)
}
