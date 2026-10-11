import type { ReactNode } from 'react'

export function DemoModeBadge() {
  return <div className="demo-pill"><span className="demo-dot" /> DEMO MODE</div>
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return <div className="demo-disclaimer" role="status"><span className="demo-dot" /> {children}</div>
}
