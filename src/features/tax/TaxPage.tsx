import { useMemo, useState } from 'react'
import { Calculator, CircleAlert, Download, FileText, Search, ShieldAlert } from 'lucide-react'
import { DemoNotice } from '../../components/ui/DemoStatus'
import { demoDataSource } from '../../lib/data/demoDataSource'
import { formatDate, formatINR } from '../../lib/format'
import { parseMoneyToPaise } from '../../lib/validation'
import { calculateGstEstimate, getTaxSummary } from './taxMetrics'
import './tax.css'

type DatePreset = '30' | '90' | 'month' | 'custom'
const gstRates = [0, 500, 1200, 1800, 2800]

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function lastDays(days: number) {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - days + 1)
  return { from: dateKey(from), to: dateKey(to) }
}

function monthToDate() {
  const now = new Date()
  return { from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateKey(now) }
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`
}

export default function TaxPage() {
  const initialRange = lastDays(30)
  const [sales] = useState(() => demoDataSource.getSales())
  const [saleItems] = useState(() => sales.flatMap((sale) => demoDataSource.getSaleItems(sale.id)))
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [preset, setPreset] = useState<DatePreset>('30')
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState('1000.00')
  const [rateBps, setRateBps] = useState(1800)
  const [includesGst, setIncludesGst] = useState(false)
  const [exportMessage, setExportMessage] = useState('')

  const rangeError = !from || !to ? 'Choose both a start date and an end date.' : from > to ? 'Start date must be on or before the end date.' : ''
  const summary = useMemo(() => getTaxSummary(sales, saleItems, from, to), [sales, saleItems, from, to])
  const visibleTransactions = summary.transactions.filter(({ sale }) => `${sale.invoiceNumber} ${sale.source} ${sale.id}`.toLowerCase().includes(query.trim().toLowerCase()))
  const calculator = useMemo(() => {
    const paise = parseMoneyToPaise(amount)
    if (paise === null || paise <= 0) return { result: null, error: 'Enter a positive amount with up to two decimal places.' }
    try { return { result: calculateGstEstimate(paise, rateBps, includesGst), error: '' } }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : 'Could not calculate this estimate.' } }
  }, [amount, rateBps, includesGst])

  function selectPreset(value: DatePreset) {
    setPreset(value)
    if (value === 'custom') return
    const next = value === 'month' ? monthToDate() : lastDays(Number(value))
    setFrom(next.from)
    setTo(next.to)
  }

  function exportCsv() {
    if (rangeError) return
    const rows = [
      ['VyapaarOS demo tax summary (not a GST return)', `${from} to ${to}`],
      ['Completed sales', summary.salesCount],
      ['Sales with item tax details reconciled', summary.verifiedSalesCount],
      ['Sales with unavailable tax detail', summary.unavailableSalesCount],
      ['Pre-discount taxable subtotal (verified sales)', formatINR(summary.taxableValuePaise)],
      ['Recorded POS tax estimate (pre-discount)', formatINR(summary.recordedTaxPaise)],
      ['Final completed bill totals', formatINR(summary.grossSalesPaise)],
      ['CGST/SGST or IGST split', 'Unavailable: place of supply and GST registration details are not stored'],
      [],
      ['Sale reference', 'Date', 'Final bill total', 'Pre-discount taxable subtotal', 'Recorded tax estimate', 'Tax detail status'],
      ...summary.transactions.map(({ sale, taxableValuePaise, taxPaise }) => [
        sale.invoiceNumber || sale.id,
        sale.createdAt,
        formatINR(sale.totalPaise),
        taxableValuePaise === null ? 'Unavailable' : formatINR(taxableValuePaise),
        taxPaise === null ? 'Unavailable' : formatINR(taxPaise),
        taxableValuePaise === null ? 'Incomplete or inconsistent item snapshots' : 'Recorded POS estimate; pre-discount',
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => csvCell(cell ?? '')).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `vyapaaros-tax-summary-${from}-to-${to}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setExportMessage('Tax summary CSV downloaded. This is a preparation aid, not a filing document.')
  }

  return <div className="feature-page tax-page">
    <div className="page-heading tax-heading"><div><div className="eyebrow">PREPARE WITH CLARITY <span className="eyebrow-dot" /> DEMO ESTIMATES</div><h1>Tax Assistant</h1><p>Review recorded POS tax details and make a simple GST estimate.</p></div><button className="primary-button tax-export" onClick={exportCsv} disabled={Boolean(rangeError)}><Download size={15} /> Export summary</button></div>

    <section className="finance-filters panel" aria-label="Tax date filters">
      <div className="finance-filter-title"><span className="panel-kicker">REPORTING PERIOD</span><strong>Choose a date range</strong></div>
      <div className="finance-date-controls"><select aria-label="Quick date range" value={preset} onChange={(event) => selectPreset(event.target.value as DatePreset)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="month">This month</option><option value="custom">Custom range</option></select><label>From<input type="date" value={from} onChange={(event) => { setPreset('custom'); setFrom(event.target.value) }} /></label><span className="date-range-separator">to</span><label>To<input type="date" value={to} onChange={(event) => { setPreset('custom'); setTo(event.target.value) }} /></label><button className="finance-reset" onClick={() => selectPreset('30')}>Reset</button></div>
    </section>
    {rangeError && <div className="finance-alert" role="alert"><CircleAlert size={16} />{rangeError}</div>}
    {exportMessage && <div className="tax-export-message" role="status">{exportMessage}<button onClick={() => setExportMessage('')} aria-label="Dismiss export notice">×</button></div>}

    <section className="finance-metrics tax-metrics" aria-label="Tax period overview">
      <Metric title="Completed sales" value={formatINR(summary.grossSalesPaise)} detail={`${summary.salesCount} completed bills · final bill total`} tone="green" />
      <Metric title="Taxable value available" value={summary.verifiedSalesCount ? formatINR(summary.taxableValuePaise) : 'Unavailable'} detail="Pre-discount subtotal for reconciled item records" tone="blue" />
      <Metric title="Recorded tax estimate" value={summary.verifiedSalesCount ? formatINR(summary.recordedTaxPaise) : 'Unavailable'} detail={`${summary.verifiedSalesCount} of ${summary.salesCount} sales have matching item tax details`} tone="amber" />
      <article className="finance-metric finance-metric-unavailable"><div className="finance-metric-top"><span>CGST / SGST / IGST</span><span className="finance-metric-icon gray"><ShieldAlert size={16} /></span></div><strong>Unavailable</strong><small>Shop GSTIN, registration state and place of supply are not recorded.</small></article>
    </section>

    {summary.unavailableSalesCount > 0 && <div className="tax-alert" role="status"><CircleAlert size={17} /><span><strong>Some tax details need review.</strong> {summary.unavailableSalesCount} sale{summary.unavailableSalesCount === 1 ? '' : 's'} do not have item tax snapshots that reconcile with the stored sale totals, so they are excluded from taxable value and tax estimates.</span></div>}

    <div className="tax-content-grid">
      <section className="panel tax-calculator-panel">
        <div className="tax-panel-heading"><span className="tax-panel-icon"><Calculator size={18} /></span><div><span className="panel-kicker">QUICK TOOL · ESTIMATE ONLY</span><h2>GST calculator</h2><p>Estimate GST for one amount and rate.</p></div></div>
        <div className="tax-form-grid">
          <label>Amount (₹)<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={Boolean(calculator.error)} /></label>
          <label>GST rate<select value={rateBps} onChange={(event) => setRateBps(Number(event.target.value))}>{gstRates.map((rate) => <option value={rate} key={rate}>{rate / 100}%</option>)}</select></label>
        </div>
        <fieldset className="tax-inclusion"><legend>Entered amount</legend><label><input type="radio" checked={!includesGst} onChange={() => setIncludesGst(false)} /> Before GST (exclusive)</label><label><input type="radio" checked={includesGst} onChange={() => setIncludesGst(true)} /> Includes GST (inclusive)</label></fieldset>
        {calculator.error && <div className="tax-form-error" role="alert">{calculator.error}</div>}
        {calculator.result && <div className="tax-calc-results"><div><span>Taxable value</span><strong>{formatINR(calculator.result.taxableValuePaise)}</strong></div><div><span>Estimated GST</span><strong>{formatINR(calculator.result.gstPaise)}</strong></div><div className="tax-calc-total"><span>Total amount</span><strong>{formatINR(calculator.result.totalPaise)}</strong></div></div>}
        <p className="tax-method-note">Rounded to the nearest paise. For inclusive amounts, GST is extracted from the entered total. Confirm the applicable rate and treatment with a tax professional.</p>
      </section>

      <section className="panel tax-context-panel">
        <div className="tax-panel-heading"><span className="tax-panel-icon muted-icon"><FileText size={18} /></span><div><span className="panel-kicker">DATA COVERAGE</span><h2>What this view can show</h2><p>Tax preparation details available in this demo.</p></div></div>
        <ul className="tax-data-list">
          <li><span className="tax-data-check">✓</span><span><strong>Available</strong><small>POS sale subtotal, stored tax amount, discount, final total, and item-level rate/tax snapshots when they reconcile.</small></span></li>
          <li><span className="tax-data-missing">!</span><span><strong>Not recorded</strong><small>Shop/customer GSTIN, HSN/SAC, place of supply, supply state, filing status, and tax split by jurisdiction.</small></span></li>
          <li><span className="tax-data-missing">!</span><span><strong>Discount treatment</strong><small>Stored demo sale tax is calculated before loyalty discounts; taxable value and tax are presented pre-discount and are not a liability calculation.</small></span></li>
        </ul>
      </section>
    </div>

    <section className="panel tax-history-panel">
      <div className="tax-panel-heading tax-history-heading"><span className="tax-panel-icon muted-icon"><FileText size={18} /></span><div><span className="panel-kicker">RECORDED POS DATA</span><h2>Tax transaction history</h2><p>{rangeError ? 'Choose a valid period.' : `${summary.salesCount} completed sale${summary.salesCount === 1 ? '' : 's'} in this period`}</p></div></div>
      <label className="tax-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sale reference" aria-label="Search sales" /></label>
      {!rangeError && visibleTransactions.length > 0 ? <div className="finance-table-scroll"><table className="finance-table tax-table"><thead><tr><th>Sale reference</th><th>Date</th><th>Pre-discount taxable value</th><th>Recorded tax estimate</th><th>Final bill total</th></tr></thead><tbody>{visibleTransactions.map(({ sale, taxableValuePaise, taxPaise }) => <tr key={sale.id}><td><div className="tax-reference"><strong>{sale.invoiceNumber || 'Reference unavailable'}</strong><small>{sale.source.toUpperCase()} · completed</small></div></td><td>{formatDate(sale.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>{taxableValuePaise === null ? <span className="tax-unavailable">Unavailable</span> : formatINR(taxableValuePaise)}</td><td>{taxPaise === null ? <span className="tax-unavailable">Unavailable</span> : formatINR(taxPaise)}</td><td className="tax-final-total">{formatINR(sale.totalPaise)}</td></tr>)}</tbody></table></div> : <div className="finance-list-empty"><strong>{rangeError ? 'Date range is invalid' : summary.salesCount ? 'No matching sales' : 'No completed sales in this period'}</strong><span>{summary.salesCount ? 'Try another sale reference or adjust the date range.' : 'Completed demo POS sales with available records will appear here.'}</span></div>}
      <p className="tax-history-footnote">Displayed tax values are stored POS estimates before discounts, not verified GST liability. No transactions are generated by this report.</p>
    </section>

    <DemoNotice>Preparation aid only — not professional tax advice, an official GST return, or filing-ready data. This demo does not calculate CGST/SGST versus IGST, and does not file or submit returns.</DemoNotice>
  </div>
}

function Metric({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: string }) {
  return <article className="finance-metric"><div className="finance-metric-top"><span>{title}</span><span className={`finance-metric-icon ${tone}`}><FileText size={15} /></span></div><strong>{value}</strong><small>{detail}</small></article>
}
