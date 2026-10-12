import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Bell, Boxes, CalendarDays, ChevronDown, CircleHelp, FileText,
  LayoutDashboard, Menu, MoreHorizontal, Search, Settings2, ShoppingCart,
  Store, UsersRound, Wallet, X,
} from 'lucide-react'
import { formatDate } from './lib/format'
import { demoShop } from './lib/data/demo'
import DashboardPage from './features/dashboard/DashboardPage'
import BillingPage from './features/billing/BillingPage'
import InventoryPage from './features/inventory/InventoryPage'
import CustomersPage from './features/customers/CustomersPage'
import FinancePage from './features/finance/FinancePage'
import StorePage from './features/storefront/StorePage'
import TaxPage from './features/tax/TaxPage'
import { DemoModeBadge } from './components/ui/DemoStatus'

const navigation = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Billing / POS', path: '/billing', icon: ShoppingCart, shortcut: '⌘ 1' },
  { label: 'Inventory', path: '/inventory', icon: Boxes },
  { label: 'Customers & Loyalty', path: '/customers', icon: UsersRound },
  { label: 'Online Store', path: '/store', icon: Store },
  { label: 'Finance', path: '/finance', icon: Wallet },
  { label: 'Tax Assistant', path: '/tax', icon: FileText },
]

function App() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const page = navigation.find((item) => item.path === location.pathname) ?? navigation[0]
  const navigate = useNavigate()

  return (
    <div className="app-frame">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><span>v</span></div>
          <div><div className="brand-name">vyapaar<span>OS</span></div><div className="brand-caption">RETAIL, IN RHYTHM</div></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <button className="shop-switcher" aria-label="Selected shop" disabled title="Shop switching is not part of this milestone">
          <div className="shop-avatar">N</div>
          <span className="shop-copy"><strong>{demoShop.name}</strong><small>{demoShop.location}</small></span>
          <ChevronDown size={15} className="muted" />
        </button>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ label, path, icon: Icon, shortcut }) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{shortcut && <small className="shortcut">{shortcut}</small>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="help-card">
          <div className="help-icon"><CircleHelp size={17} /></div>
          <strong>Here to help</strong>
          <p>Get quick answers to make your store run smoother.</p>
          <button className="help-link" disabled title="Help centre is not connected">Visit help centre <ArrowRight size={14} /></button>
        </div>
        <div className="sidebar-footer">
          <button className="nav-link settings-link" disabled title="Settings are not part of this milestone"><Settings2 size={18} /><span>Settings</span></button>
          <div className="profile-row"><div className="profile-avatar">RK</div><div className="profile-copy"><strong>Ravi Kumar</strong><small>Store owner</small></div><MoreHorizontal size={19} className="muted" /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-sep">/</span><strong>{page.label}</strong></div></div>
          <div className="topbar-actions">
            <DemoModeBadge />
            <button className="icon-button top-search" aria-label="Search" disabled title="Search is not connected"><Search size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notifications" disabled title="Notifications are not connected"><Bell size={18} /><i /></button>
            <div className="top-divider" />
            <div className="today-label"><CalendarDays size={15} /> {formatDate(new Date().toISOString(), { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>
        </header>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<DashboardPage onNewSale={() => navigate('/billing')} />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/store" element={<StorePage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/tax" element={<TaxPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default App
