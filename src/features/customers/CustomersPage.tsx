import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, AtSign, Gift, Mail, Phone, Plus, Search, ShoppingBag, UserRound, UsersRound, X } from 'lucide-react'
import { DemoNotice } from '../../components/ui/DemoStatus'
import { DemoDataError, demoDataSource, type CustomerDraft, type LoyaltyAdjustmentDraft } from '../../lib/data/demoDataSource'
import { formatDate, formatINR } from '../../lib/format'
import { getCustomerMetrics, type CustomerMetrics } from './customerMetrics'
import type { Customer, LoyaltyTransaction, Sale } from '../../types/domain'
import './customers.css'

interface SaleHistory extends Sale {
  productSummary: string
  itemCount: number
  pointsEarned: number
  pointsRedeemed: number
}

type CustomerDialogState = { customer: Customer | null } | null

function getCompletedSales(): Sale[] {
  const seenSaleIds = new Set<string>()
  return demoDataSource.getSales().filter((sale) => {
    if (sale.status !== 'completed' || seenSaleIds.has(sale.id)) return false
    seenSaleIds.add(sale.id)
    return true
  })
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState(() => demoDataSource.getCustomers())
  const [sales, setSales] = useState(() => getCompletedSales())
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<CustomerDialogState>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState<Customer | null>(null)
  const [notice, setNotice] = useState('')

  const customerSummaries = useMemo(() => customers.map((customer) => ({ customer, metrics: getCustomerMetrics(customer.id, sales) })), [customers, sales])
  const filteredCustomers = customerSummaries.filter(({ customer }) => `${customer.name} ${customer.phone ?? ''} ${customer.email ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const selected = customerSummaries.find(({ customer }) => customer.id === selectedId)?.customer ?? null
  const totalPoints = customers.reduce((sum, customer) => sum + customer.loyaltyPoints, 0)
  const lifetimeSalesPaise = sales.reduce((sum, sale) => sum + sale.totalPaise, 0)
  const customerIds = new Set(customers.map((customer) => customer.id))
  const unlinkedSales = sales.filter((sale) => !sale.customerId || !customerIds.has(sale.customerId))
  const unlinkedSalesPaise = unlinkedSales.reduce((sum, sale) => sum + sale.totalPaise, 0)
  const detailTransactions = selected ? demoDataSource.getLoyaltyTransactions(selected.id) : []
  const detailHistory: SaleHistory[] = selected ? sales.filter((sale) => sale.customerId === selected.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((sale) => {
    const items = demoDataSource.getSaleItems(sale.id)
    const saleTransactions = detailTransactions.filter((transaction) => transaction.saleId === sale.id)
    const pointsEarned = saleTransactions.filter((transaction) => transaction.transactionType === 'sale').reduce((sum, transaction) => sum + transaction.pointsDelta, 0)
    const pointsRedeemed = saleTransactions.filter((transaction) => transaction.transactionType === 'redemption').reduce((sum, transaction) => sum - transaction.pointsDelta, 0)
    return { ...sale, productSummary: items.map((item) => `${item.quantity} × ${item.productNameSnapshot}`).join(', '), itemCount: items.reduce((sum, item) => sum + item.quantity, 0), pointsEarned, pointsRedeemed }
  }) : []
  const detailAdjustments = detailTransactions.filter((transaction) => transaction.transactionType === 'adjustment_add' || transaction.transactionType === 'adjustment_deduct').sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function refresh() {
    setCustomers(demoDataSource.getCustomers())
    setSales(getCompletedSales())
  }

  function saveCustomer(draft: CustomerDraft, customerId?: string): string | null {
    try {
      if (customerId) demoDataSource.updateCustomer(customerId, draft)
      else demoDataSource.addCustomer(draft)
      refresh()
      setDialog(null)
      setNotice(customerId ? 'Customer details updated.' : 'Customer added to your list.')
      return null
    } catch (error) {
      return error instanceof DemoDataError ? error.message : 'Could not save this customer. Please try again.'
    }
  }

  function applyAdjustment(draft: LoyaltyAdjustmentDraft): string | null {
    try {
      demoDataSource.applyLoyaltyAdjustment(draft)
      refresh()
      setAdjusting(null)
      setNotice('Loyalty points adjusted and saved in demo data.')
      return null
    } catch (error) {
      return error instanceof DemoDataError ? error.message : 'Could not save this points adjustment. Please try again.'
    }
  }

  const loyaltyMembers = customers.filter((customer) => customer.loyaltyPoints > 0).length

  return <div className="feature-page customers-page">
    <div className="page-heading customers-heading"><div><div className="eyebrow">CUSTOMER RELATIONSHIPS <span className="eyebrow-dot" /> LOYALTY, MADE SIMPLE</div><h1>Customers & Loyalty</h1><p>Keep your regulars close and make every visit count.</p></div><button className="primary-button" onClick={() => setDialog({ customer: null })}><Plus size={16} /> Add customer</button></div>

    <section className="customer-stats" aria-label="Customer summary">
      <article className="panel customer-stat"><span className="customer-stat-icon green"><UsersRound size={17} /></span><div><span>Customers</span><strong>{customers.length}</strong><small>in your store list</small></div></article>
      <article className="panel customer-stat"><span className="customer-stat-icon lilac"><Gift size={17} /></span><div><span>Loyalty members</span><strong>{loyaltyMembers}</strong><small>with points earned</small></div></article>
      <article className="panel customer-stat"><span className="customer-stat-icon amber"><AtSign size={17} /></span><div><span>Points earned</span><strong>{totalPoints.toLocaleString('en-IN')}</strong><small>across all profiles</small></div></article>
      <article className="panel customer-stat"><span className="customer-stat-icon blue"><ShoppingBag size={17} /></span><div><span>Recorded sales</span><strong>{formatINR(lifetimeSalesPaise)}</strong><small>{sales.length} completed bills · {formatINR(unlinkedSalesPaise)} not linked to a current customer ({unlinkedSales.length})</small></div></article>
    </section>

    {notice && <div className="customer-notice" role="status"><span>✓</span>{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')}><X size={14} /></button></div>}

    <section className="panel customer-list-panel" aria-labelledby="customer-list-title">
      <div className="customer-list-toolbar"><div><div className="panel-kicker">YOUR COMMUNITY</div><h2 id="customer-list-title">Customer list</h2><p>{filteredCustomers.length} {filteredCustomers.length === 1 ? 'profile' : 'profiles'} · lifetime spend from completed POS bills</p></div><label className="customer-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone or email" aria-label="Search customers" /><kbd>⌘ K</kbd></label></div>
      {filteredCustomers.length > 0 ? <div className="customer-table-scroll"><table className="customer-table"><thead><tr><th>Customer</th><th>Total spending</th><th>Purchases</th><th>Loyalty points</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredCustomers.map(({ customer, metrics }) => <tr key={customer.id}>
        <td><button className="customer-person" onClick={() => setSelectedId(customer.id)}><span className="customer-avatar">{customer.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</span><span className="customer-person-copy"><strong>{customer.name}</strong><small>{customer.phone || customer.email || 'No contact details'}</small></span></button></td>
        <td><strong className="customer-spending">{formatINR(metrics.spendingPaise)}</strong></td><td><span className="customer-purchase-count">{metrics.purchaseCount}</span></td>
        <td><span className={`loyalty-points ${customer.loyaltyPoints ? '' : 'points-empty'}`}><Gift size={13} />{customer.loyaltyPoints.toLocaleString('en-IN')} pts</span></td>
        <td><div className="customer-row-actions"><button className="customer-view-button" onClick={() => setSelectedId(customer.id)}>View profile <ArrowRight size={13} /></button><button className="customer-edit-button" onClick={() => setDialog({ customer })} aria-label={`Edit ${customer.name}`} title="Edit customer"><UserRound size={14} /></button></div></td>
      </tr>)}</tbody></table></div> : <div className="customer-empty"><span className="customer-empty-icon"><UsersRound size={22} /></span><strong>{customers.length ? 'No customers match that search' : 'Your customer list is ready'}</strong><p>{customers.length ? 'Try a different name, phone number or email.' : 'Add a customer to keep their details and visits together.'}</p>{customers.length === 0 && <button className="primary-button" onClick={() => setDialog({ customer: null })}><Plus size={15} /> Add first customer</button>}</div>}
    </section>

    <DemoNotice>Demo rewards: earn 1 point per full ₹100 of a completed POS bill. New profiles start at zero; changes are stored in this browser only.</DemoNotice>

    {dialog && <CustomerDialog customer={dialog.customer} onClose={() => setDialog(null)} onSave={saveCustomer} />}
    {selected && <CustomerDetails customer={selected} metrics={getCustomerMetrics(selected.id, sales)} history={detailHistory} adjustments={detailAdjustments} onClose={() => setSelectedId(null)} onEdit={() => { setSelectedId(null); setDialog({ customer: selected }) }} onAdjust={() => setAdjusting(selected)} />}
    {adjusting && <PointAdjustmentDialog customer={adjusting} onClose={() => setAdjusting(null)} onApply={applyAdjustment} />}
  </div>
}

function CustomerDialog({ customer, onClose, onSave }: { customer: Customer | null; onClose: () => void; onSave: (draft: CustomerDraft, customerId?: string) => string | null }) {
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = onSave({ name, phone, email }, customer?.id)
    if (validationError) setError(validationError)
  }

  return <div className="customer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="customer-dialog-title">
    <div className="customer-dialog-head"><div><span className="panel-kicker">CUSTOMER PROFILE</span><h2 id="customer-dialog-title">{customer ? 'Edit customer' : 'Add a customer'}</h2><p>Phone and email help you find this profile again.</p></div><button className="customer-dialog-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
    <form onSubmit={submit} noValidate><div className="customer-fields"><label>Full name<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ananya Rao" /></label><label>Mobile number <span>optional</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" /></label><label>Email address <span>optional</span><input type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ananya@example.com" /></label></div>{error && <div className="customer-form-error" role="alert">{error}</div>}<p className="customer-form-hint">Phone and email duplicates are blocked; if both are blank, names must be distinct.</p><div className="customer-form-actions"><button type="button" className="select-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{customer ? 'Save changes' : 'Add customer'}</button></div></form>
  </section></div>
}

function CustomerDetails({ customer, metrics, history, adjustments, onClose, onEdit, onAdjust }: { customer: Customer; metrics: CustomerMetrics; history: SaleHistory[]; adjustments: LoyaltyTransaction[]; onClose: () => void; onEdit: () => void; onAdjust: () => void }) {
  return <div className="customer-overlay customer-detail-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="customer-detail" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title">
    <header className="customer-detail-header"><button className="customer-dialog-close" onClick={onClose} aria-label="Close profile"><X size={18} /></button><div className="customer-profile-identity"><span className="customer-avatar customer-avatar-large">{customer.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')}</span><div><span className="panel-kicker">CUSTOMER SINCE {formatDate(customer.createdAt, { month: 'short', year: 'numeric' }).toUpperCase()}</span><h2 id="customer-detail-title">{customer.name}</h2><div className="customer-contact-list">{customer.phone && <span><Phone size={13} />{customer.phone}</span>}{customer.email && <span><Mail size={13} />{customer.email}</span>}{!customer.phone && !customer.email && <span>No contact details</span>}</div></div></div><div className="customer-detail-actions"><button className="customer-detail-adjust" onClick={onAdjust}>Adjust points</button><button className="customer-detail-edit" onClick={onEdit}>Edit profile</button></div></header>
    <div className="customer-detail-stats"><div><span>Lifetime spend</span><strong>{formatINR(metrics.spendingPaise)}</strong></div><div><span>Purchases</span><strong>{metrics.purchaseCount}</strong></div><div><span>Loyalty balance</span><strong className="customer-detail-points"><Gift size={15} />{customer.loyaltyPoints.toLocaleString('en-IN')} pts</strong></div></div>
    <div className="customer-history-heading"><div><span className="panel-kicker">COMPLETED POS BILLS</span><h3>Purchase history</h3></div><span className="customer-history-count">{history.length}</span></div>
    {history.length ? <div className="customer-history-list">{history.map((sale) => <article className="customer-sale-card" key={sale.id}><div className="customer-sale-top"><span className="customer-sale-icon"><ShoppingBag size={15} /></span><div className="customer-sale-meta"><strong>{sale.invoiceNumber}</strong><span>{formatDate(sale.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div><strong className="customer-sale-total">{formatINR(sale.totalPaise)}</strong></div><p>{sale.productSummary || 'No item details available'} <span>· {sale.itemCount} {sale.itemCount === 1 ? 'item' : 'items'}</span></p><div className="customer-sale-bottom"><span>{formatINR(sale.subtotalPaise)} subtotal · {formatINR(sale.taxPaise)} estimated tax</span><span className="sale-complete-pill">Completed</span></div>{sale.pointsEarned > 0 && <div className="customer-purchase-points"><Gift size={12} /> +{sale.pointsEarned} points earned on this bill</div>}{sale.pointsRedeemed > 0 && <div className="customer-points-redeemed"><Gift size={12} /> −{sale.pointsRedeemed} points redeemed on this bill</div>}</article>)}</div> : <div className="customer-history-empty"><span><ShoppingBag size={18} /></span><strong>No completed purchases yet</strong><p>When this customer is selected at POS and a sale is completed, it will appear here.</p></div>}
    <section className="customer-adjustments"><div className="customer-history-heading"><div><span className="panel-kicker">MANUAL CHANGES</span><h3>Points adjustments</h3></div><span className="customer-history-count">{adjustments.length}</span></div>{adjustments.length ? <div className="customer-adjustment-list">{adjustments.map((transaction) => <article className="customer-adjustment-row" key={transaction.id}><span className={`adjustment-icon ${transaction.pointsDelta > 0 ? 'adjustment-positive' : 'adjustment-negative'}`}>{transaction.pointsDelta > 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</span><div className="customer-adjustment-copy"><strong>{transaction.transactionType === 'adjustment_add' ? 'Points added' : 'Points deducted'}</strong><span>{transaction.reason || 'No reason recorded'}</span><small>{formatDate(transaction.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div><b className={transaction.pointsDelta > 0 ? 'adjustment-positive-text' : 'adjustment-negative-text'}>{transaction.pointsDelta > 0 ? '+' : ''}{transaction.pointsDelta} pts</b></article>)}</div> : <div className="customer-adjustments-empty">No manual adjustments yet. Purchase-earned points are listed with each completed bill above.</div>}</section>
    <DemoNotice>Demo rewards: 1 point per full ₹100 on completed POS sales. Purchase rewards and manual adjustments are recorded separately in this browser.</DemoNotice>
  </section></div>
}

function PointAdjustmentDialog({ customer, onClose, onApply }: { customer: Customer; onClose: () => void; onApply: (draft: LoyaltyAdjustmentDraft) => string | null }) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'deduct'>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [confirmedDraft, setConfirmedDraft] = useState<LoyaltyAdjustmentDraft | null>(null)
  const [saving, setSaving] = useState(false)

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const points = Number(amount)
    if (!Number.isSafeInteger(points) || points <= 0) { setError('Enter a positive whole number of points.'); return }
    if (!reason.trim()) { setError('Add a reason for this adjustment.'); return }
    if (reason.trim().length > 240) { setError('Keep the reason to 240 characters or fewer.'); return }
    if (adjustmentType === 'deduct' && points > customer.loyaltyPoints) { setError('This customer does not have enough points for that deduction.'); return }
    setError('')
    setConfirmedDraft({ customerId: customer.id, adjustmentType, amount: points, reason: reason.trim() })
  }

  function confirmAdjustment() {
    if (!confirmedDraft || saving) return
    setSaving(true)
    const failure = onApply(confirmedDraft)
    if (failure) { setError(failure); setSaving(false) }
  }

  const resultingBalance = customer.loyaltyPoints + (confirmedDraft?.adjustmentType === 'deduct' ? -1 : 1) * (confirmedDraft?.amount ?? 0)
  return <div className="customer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="customer-dialog" role="dialog" aria-modal="true" aria-labelledby="adjust-dialog-title">
    <div className="customer-dialog-head"><div><span className="panel-kicker">LOYALTY BALANCE · {customer.loyaltyPoints.toLocaleString('en-IN')} PTS</span><h2 id="adjust-dialog-title">{confirmedDraft ? 'Confirm adjustment' : 'Adjust points'}</h2><p>{confirmedDraft ? 'Review this change before saving it.' : 'Every manual change is recorded with a reason.'}</p></div><button className="customer-dialog-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
    {confirmedDraft ? <div className="adjustment-confirmation"><div className={`adjustment-confirm-value ${confirmedDraft.adjustmentType === 'add' ? 'adjustment-positive-text' : 'adjustment-negative-text'}`}>{confirmedDraft.adjustmentType === 'add' ? '+' : '−'}{confirmedDraft.amount} points</div><p>{confirmedDraft.adjustmentType === 'add' ? 'Add to' : 'Deduct from'} <strong>{customer.name}</strong>’s balance. New balance: <strong>{resultingBalance.toLocaleString('en-IN')} points</strong>.</p><blockquote>{confirmedDraft.reason}</blockquote><div className="adjustment-confirm-actions"><button className="select-button" disabled={saving} onClick={() => { setConfirmedDraft(null); setError('') }}>Back</button><button className="primary-button" disabled={saving} onClick={confirmAdjustment}>{saving ? 'Saving…' : 'Confirm adjustment'}</button></div></div> : <form onSubmit={review} noValidate><div className="customer-fields"><label>Adjustment type<select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as 'add' | 'deduct')}><option value="add">Add points</option><option value="deduct">Deduct points</option></select></label><label>Points<input type="number" inputMode="numeric" min="1" step="1" autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 10" /></label><label>Reason<textarea maxLength={240} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Service recovery for a delayed order" /></label></div><p className="customer-form-hint">Balance cannot go below zero. The change is saved to this browser’s demo data.</p><div className="customer-form-actions"><button type="button" className="select-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">Review adjustment</button></div></form>}
    {error && <div className="customer-form-error" role="alert">{error}</div>}
  </section></div>
}
