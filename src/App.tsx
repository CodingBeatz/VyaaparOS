import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Bell, Boxes, CalendarDays, ChevronDown, CircleHelp, Download, FileText, Gift,
  LayoutDashboard, Menu, MoreHorizontal, PackagePlus, Search, Settings2, ShoppingCart,
  Store, UsersRound, Wallet, X,
} from 'lucide-react'
import { formatDate, formatINR } from './lib/format'
import { demoDataSource } from './lib/data/demoDataSource'
import { demoShop } from './lib/data/demo'
import DashboardPage from './features/dashboard/DashboardPage'
import { DemoModeBadge, DemoNotice } from './components/ui/DemoStatus'
import FinancePage from './features/finance/FinancePage'

type IconType = typeof LayoutDashboard

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
            <Route path="/billing" element={<PlaceholderPage title="Billing / POS" eyebrow="SELL WITH EASE" icon={ShoppingCart} description="A faster checkout is taking shape. Your shared sale flow will keep bills, stock, loyalty and finance in sync." bullets={['Search and add products to a cart', 'Attach a customer and apply loyalty', 'Complete a sale with a clear invoice']} />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/customers" element={<PlaceholderPage title="Customers & Loyalty" eyebrow="MAKE EVERY VISIT COUNT" icon={Gift} description="Know your regulars, reward repeat visits and make every customer feel remembered." bullets={['Customer profiles and purchase history', 'Simple points earned on completed sales', 'Shop-wide loyalty activity']} />} />
            <Route path="/store" element={<PlaceholderPage title="Online Store" eyebrow="YOUR SHOP, ONLINE" icon={Store} description="A simple digital storefront for nearby customers, connected to the same products and stock as your counter." bullets={['Shareable storefront catalog', 'Online orders with clear status', 'No payment provider is connected in this demo']} />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/tax" element={<PlaceholderPage title="Tax Assistant" eyebrow="FEEL READY FOR TAX TIME" icon={FileText} description="Keep sales, purchase and expense records together, with reminders to help you prepare." bullets={['Tax-period sales and purchase summaries', 'Filing preparation reminders', 'Information is indicative and is not tax or filing advice']} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

function InventoryPage() {
  const products = demoDataSource.getProducts()
  return <div className="feature-page"><div className="page-heading"><div><div className="eyebrow">KEEP YOUR SHELVES IN CHECK</div><h1>Inventory</h1><p>A clear view of what’s in stock and what needs a top-up.</p></div><button className="primary-button" disabled title="Product editing is not part of this milestone"><PackagePlus size={16} /> Add product</button></div>
    <div className="feature-summary"><span className="metric-icon orange"><Boxes size={18} /></span><div><strong>{products.length} sample products</strong><small>{products.filter((product) => product.stockQuantity <= product.lowStockThreshold).length} are at or below their low-stock level</small></div><span className="coming-soon-chip">DEMO CATALOG</span></div>
    <div className="panel inventory-table-panel"><div className="table-toolbar"><div><h2>Product list</h2><span>Sample inventory for {demoShop.name}</span></div><button className="select-button" disabled title="Export is not part of this milestone"><Download size={14} /> Export</button></div><div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Unit price</th><th>In stock</th><th>Stock status</th></tr></thead><tbody>{products.map((product) => { const low = product.stockQuantity <= product.lowStockThreshold; return <tr key={product.id}><td><div className="table-product"><div className="product-thumb">{product.name.charAt(0)}</div><strong>{product.name}</strong></div></td><td>{product.sku}</td><td>{formatINR(product.salePricePaise)}</td><td>{product.stockQuantity} <span className="muted">{product.unit}</span></td><td><span className={`status-pill ${low ? 'status-low' : 'status-good'}`}><i />{low ? 'Running low' : 'In stock'}</span></td></tr> })}</tbody></table></div></div>
    <DemoNotice>Sample data only. Product changes are not saved in demo mode.</DemoNotice>
  </div>
}

function PlaceholderPage({ title, eyebrow, icon: Icon, description, bullets }: { title: string; eyebrow: string; icon: IconType; description: string; bullets: string[] }) {
  return <div className="feature-page"><div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div><div className="placeholder-card"><div className="placeholder-icon"><Icon size={22} /></div><div className="placeholder-copy"><span className="coming-soon-chip">FOUNDATION READY</span><h2>A little more is on the way</h2><p>This space is ready for the team to build into. The shared business data contract is in place, so each module can connect without duplicating core models.</p><ul>{bullets.map((bullet) => <li key={bullet}><span>✓</span>{bullet}</li>)}</ul></div><div className="placeholder-ornament"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-core"><Icon size={26} /></div><span className="orbit-dot dot-one"/><span className="orbit-dot dot-two"/><span className="orbit-dot dot-three"/></div></div><div className="demo-disclaimer"><span className="demo-dot" /> Demo mode is active. No live integrations are connected.</div></div>
}

export default App
