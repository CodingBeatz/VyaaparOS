import { useMemo, useState, type FormEvent } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, CircleAlert, Edit3, Plus, Search, Trash2, Wallet, X } from 'lucide-react'
import { DemoNotice } from '../../components/ui/DemoStatus'
import { demoDataSource, DemoDataError, type ExpenseDraft } from '../../lib/data/demoDataSource'
import { formatDate, formatINR } from '../../lib/format'
import { parseMoneyToPaise } from '../../lib/validation'
import type { FinancialEntry, PaymentMethod } from '../../types/domain'
import { getFinanceSummary } from './financeMetrics'
import './finance.css'

type ExpenseFormDraft = { description: string; category: string; amount: string; date: string; paymentMethod: PaymentMethod }
type DatePreset = '30' | '90' | 'month' | 'custom'

const categories = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Marketing', 'Repairs', 'Other']
const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'other', label: 'Other' },
]

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function lastDays(days: number) {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return { from: dateKey(start), to: dateKey(end) }
}

function monthToDate() {
  const now = new Date()
  return { from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateKey(now) }
}

function emptyForm(): ExpenseFormDraft {
  return { description: '', category: categories[0], amount: '', date: dateKey(new Date()), paymentMethod: 'upi' }
}

function entryToForm(entry: FinancialEntry): ExpenseFormDraft {
  return {
    description: entry.description ?? '', category: entry.category, amount: (entry.amountPaise / 100).toFixed(2),
    date: entry.occurredAt.slice(0, 10), paymentMethod: entry.paymentMethod ?? 'other',
  }
}

export default function FinancePage() {
  const initialRange = lastDays(30)
  const [sales, setSales] = useState(() => demoDataSource.getSales())
  const [entries, setEntries] = useState(() => demoDataSource.getFinancialEntries())
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [preset, setPreset] = useState<DatePreset>('30')
  const [query, setQuery] = useState('')
  const [transactionType, setTransactionType] = useState<'all' | 'sale' | 'expense'>('all')
  const [dialogEntry, setDialogEntry] = useState<FinancialEntry | null | undefined>(undefined)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const rangeError = !from || !to ? 'Choose both a start date and an end date.' : from > to ? 'Start date must be on or before the end date.' : ''
  const summary = useMemo(() => getFinanceSummary(sales, entries, from, to), [sales, entries, from, to])
  const visibleTransactions = summary.transactions.filter((transaction) => {
    const matchesType = transactionType === 'all' || transaction.type === transactionType
    const text = `${transaction.description} ${transaction.category} ${transaction.status}`.toLowerCase()
    return matchesType && text.includes(query.toLowerCase().trim())
  })

  function refresh() {
    setSales(demoDataSource.getSales())
    setEntries(demoDataSource.getFinancialEntries())
  }

  function selectPreset(value: DatePreset) {
    setPreset(value)
    if (value === 'custom') return
    const next = value === 'month' ? monthToDate() : lastDays(Number(value))
    setFrom(next.from)
    setTo(next.to)
  }

  function saveExpense(draft: ExpenseDraft, entryId?: string): string | null {
    try {
      if (entryId) demoDataSource.updateExpense(entryId, draft)
      else demoDataSource.addExpense(draft)
      if (!from || !to || from > to) {
        setFrom(draft.occurredOn)
        setTo(draft.occurredOn)
        setPreset('custom')
      } else if (draft.occurredOn < from || draft.occurredOn > to) {
        setFrom(draft.occurredOn < from ? draft.occurredOn : from)
        setTo(draft.occurredOn > to ? draft.occurredOn : to)
        setPreset('custom')
      }
      refresh()
      setDialogEntry(undefined)
      setError('')
      setNotice(entryId ? 'Expense updated.' : 'Expense recorded in this browser.')
      return null
    } catch (cause) {
      const message = cause instanceof DemoDataError ? cause.message : 'Could not save this expense.'
      setError(message)
      return message
    }
  }

  function deleteExpense(entry: FinancialEntry) {
    if (!window.confirm(`Delete “${entry.description || entry.category}” expense? This cannot be undone.`)) return
    try {
      demoDataSource.deleteExpense(entry.id)
      refresh()
      setNotice('Expense deleted.')
      setError('')
    } catch (cause) {
      setError(cause instanceof DemoDataError ? cause.message : 'Could not delete this expense.')
    }
  }

  return <div className="feature-page finance-page">
    <div className="page-heading finance-heading"><div><div className="eyebrow">MONEY, MADE CLEAR <span className="eyebrow-dot" /> RECORDED ACTIVITY</div><h1>Finance</h1><p>Understand sales and recorded expenses for your store.</p></div><button className="primary-button" onClick={() => { setError(''); setDialogEntry(null) }}><Plus size={16} /> Add expense</button></div>

    <section className="finance-filters panel" aria-label="Finance date filters">
      <div className="finance-filter-title"><span className="panel-kicker">REPORTING PERIOD</span><strong>Choose a date range</strong></div>
      <div className="finance-date-controls"><select aria-label="Quick date range" value={preset} onChange={(event) => selectPreset(event.target.value as DatePreset)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="month">This month</option><option value="custom">Custom range</option></select><label>From<input type="date" value={from} onChange={(event) => { setPreset('custom'); setFrom(event.target.value) }} /></label><span className="date-range-separator">to</span><label>To<input type="date" value={to} onChange={(event) => { setPreset('custom'); setTo(event.target.value) }} /></label><button className="finance-reset" onClick={() => selectPreset('30')}>Reset</button></div>
    </section>
    {rangeError && <div className="finance-alert" role="alert"><CircleAlert size={16} />{rangeError}</div>}
    {notice && <div className="finance-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={14} /></button></div>}
    {error && <div className="finance-alert" role="alert"><CircleAlert size={16} />{error}</div>}

    <section className="finance-metrics" aria-label="Financial overview">
      <Metric title="Recorded sales" value={formatINR(summary.salesPaise)} icon={ArrowUpRight} tone="green" detail="Completed bills in this period" />
      <Metric title="Recorded expenses" value={formatINR(summary.expensesPaise)} icon={ArrowDownRight} tone="amber" detail="Manual expenses in this period" />
      <Metric title="Recorded cash flow" value={formatINR(summary.recordedCashFlowPaise)} icon={Wallet} tone="blue" detail="Sales less expenses · collections unverified" />
      <article className="finance-metric finance-metric-unavailable"><div className="finance-metric-top"><span>Gross profit estimate</span><span className="finance-metric-icon gray"><CircleAlert size={16} /></span></div><strong>Unavailable</strong><small>Product cost at the time of each sale is not stored.</small></article>
    </section>

    <section className="panel finance-chart-panel">
      <div className="finance-panel-heading"><div><span className="panel-kicker">REVENUE ANALYTICS</span><h2>Sales and expenses over time</h2><p>Only recorded transactions in the selected range are shown.</p></div><div className="finance-legend"><span><i className="finance-legend-revenue" />Sales</span><span><i className="finance-legend-expense" />Expenses</span></div></div>
      {rangeError ? <div className="finance-chart-empty">Choose a valid date range to view the chart.</div> : summary.trend.length ? <div className="finance-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.trend} margin={{ top: 8, right: 8, left: -15, bottom: 0 }}>
        <defs><linearGradient id="financeRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38805a" stopOpacity={0.2} /><stop offset="100%" stopColor="#38805a" stopOpacity={0.01} /></linearGradient><linearGradient id="financeExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d79654" stopOpacity={0.17} /><stop offset="100%" stopColor="#d79654" stopOpacity={0.01} /></linearGradient></defs>
        <CartesianGrid stroke="#eef0ec" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8b928b', fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b928b', fontSize: 10 }} tickFormatter={(value: number) => `₹${Math.round(value / 100_000) / 10}L`} /><Tooltip content={<FinanceTooltip />} />
        <Area type="monotone" dataKey="revenuePaise" name="Sales" stroke="#38805a" strokeWidth={2.5} fill="url(#financeRevenue)" activeDot={{ r: 4 }} /><Area type="monotone" dataKey="expensesPaise" name="Expenses" stroke="#cf8b4d" strokeWidth={2} fill="url(#financeExpense)" activeDot={{ r: 4 }} />
      </AreaChart></ResponsiveContainer></div> : <div className="finance-chart-empty"><span className="finance-empty-icon"><Wallet size={20} /></span><strong>No transactions in this period</strong><span>Sales appear after demo POS checkout. Record an expense to start tracking outgoings.</span></div>}
      <div className="finance-chart-footnote"><span>Revenue is completed sale total after discounts.</span><span>Demo records · paise calculations</span></div>
    </section>

    <section className="panel finance-transactions-panel">
      <div className="finance-panel-heading finance-transactions-heading"><div><span className="panel-kicker">ACTIVITY LEDGER</span><h2>Transactions</h2><p>{summary.transactions.length} recorded in the selected date range</p></div><button className="primary-button finance-add-small" onClick={() => { setError(''); setDialogEntry(null) }}><Plus size={15} /> Add expense</button></div>
      <div className="finance-toolbar"><label className="finance-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search category or description" aria-label="Search transactions" /></label><div className="finance-type-filters" aria-label="Filter transaction type">{(['all', 'sale', 'expense'] as const).map((type) => <button key={type} className={transactionType === type ? 'active' : ''} onClick={() => setTransactionType(type)}>{type === 'all' ? 'All' : type === 'sale' ? 'Sales' : 'Expenses'}</button>)}</div></div>
      {visibleTransactions.length ? <div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th>Method</th><th>Status</th><th className="finance-amount-col">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleTransactions.map((transaction) => {
        const expense = transaction.type === 'expense'
        const entry = expense ? entries.find((item) => item.id === transaction.id) : undefined
        const paymentLabel = paymentMethods.find((item) => item.value === transaction.paymentMethod)?.label ?? (expense ? 'Other' : '—')
        return <tr key={`${transaction.type}-${transaction.id}`}><td><div className="finance-transaction-title"><span className={expense ? 'finance-transaction-icon expense' : 'finance-transaction-icon sale'}>{expense ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}</span><span><strong>{transaction.description}</strong><small>{transaction.type === 'sale' ? 'Sale' : 'Expense'}</small></span></div></td><td>{transaction.category}</td><td>{formatDate(transaction.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td><td>{paymentLabel}</td><td><span className={`finance-status ${expense ? 'recorded' : 'completed'}`}>{expense ? 'Recorded' : 'Completed'}</span></td><td className={`finance-amount ${expense ? 'outgoing' : 'incoming'}`}>{expense ? '−' : '+'}{formatINR(transaction.amountPaise)}</td><td>{entry && <div className="finance-row-actions"><button aria-label={`Edit ${transaction.description}`} title="Edit expense" onClick={() => { setError(''); setDialogEntry(entry) }}><Edit3 size={14} /></button><button aria-label={`Delete ${transaction.description}`} title="Delete expense" onClick={() => deleteExpense(entry)}><Trash2 size={14} /></button></div>}</td></tr>
      })}</tbody></table></div> : <div className="finance-list-empty"><strong>{summary.transactions.length ? 'No matching transactions' : 'Nothing recorded in this range'}</strong><span>{summary.transactions.length ? 'Try a different search or transaction filter.' : 'Complete a POS sale or add an expense to see activity here.'}</span></div>}
    </section>

    <DemoNotice>Cash flow uses completed sale totals less recorded manual expenses; POS sales are not confirmed payment collections. This is not net profit or a full cash balance. Finance data is stored in this browser’s demo data only.</DemoNotice>
    {dialogEntry !== undefined && <ExpenseDialog entry={dialogEntry} onClose={() => setDialogEntry(undefined)} onSave={saveExpense} />}
  </div>
}

function Metric({ title, value, icon: Icon, tone, detail }: { title: string; value: string; icon: typeof Wallet; tone: string; detail: string }) {
  return <article className="finance-metric"><div className="finance-metric-top"><span>{title}</span><span className={`finance-metric-icon ${tone}`}><Icon size={16} /></span></div><strong>{value}</strong><small>{detail}</small></article>
}

function FinanceTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return <div className="finance-tooltip"><strong>{label}</strong>{payload.filter((item) => item.value > 0).map((item) => <div key={item.name}><i style={{ background: item.color }} />{item.name}<b>{formatINR(item.value)}</b></div>)}</div>
}

function ExpenseDialog({ entry, onClose, onSave }: { entry: FinancialEntry | null; onClose: () => void; onSave: (draft: ExpenseDraft, entryId?: string) => string | null }) {
  const [form, setForm] = useState(() => entry ? entryToForm(entry) : emptyForm())
  const [formError, setFormError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amountPaise = parseMoneyToPaise(form.amount)
    if (!form.description.trim()) return setFormError('Enter a description for this expense.')
    if (!form.category) return setFormError('Choose an expense category.')
    if (amountPaise === null || amountPaise <= 0) return setFormError('Enter an amount greater than ₹0.00, with up to two decimal places.')
    if (!form.date) return setFormError('Choose the date the expense occurred.')
    setFormError('')
    const saveError = onSave({ description: form.description, category: form.category, amountPaise, occurredOn: form.date, paymentMethod: form.paymentMethod }, entry?.id)
    if (saveError) setFormError(saveError)
  }

  return <div className="receipt-backdrop finance-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="finance-dialog" role="dialog" aria-modal="true" aria-labelledby="expense-dialog-title">
    <div className="finance-dialog-head"><div><span className="panel-kicker">RECORDED EXPENSE</span><h2 id="expense-dialog-title">{entry ? 'Edit expense' : 'Add an expense'}</h2><p>Amounts are saved as integer paise in demo data.</p></div><button className="receipt-close" onClick={onClose} aria-label="Close expense dialog"><X size={18} /></button></div>
    <form onSubmit={submit} noValidate><div className="finance-form-grid"><label className="finance-form-wide">Description<input autoFocus maxLength={180} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="e.g. Electricity bill" /></label><label>Amount (₹)<input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></label><label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Date<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>Payment method<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></label></div>{formError && <div className="finance-alert" role="alert">{formError}</div>}<div className="finance-dialog-actions"><button type="button" className="select-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">{entry ? 'Save changes' : 'Record expense'}</button></div></form>
  </section></div>
}
