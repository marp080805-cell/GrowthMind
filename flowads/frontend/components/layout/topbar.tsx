'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface Breadcrumb {
  label: string
  href?: string
}

interface TopbarProps {
  title: string
  breadcrumbs?: Breadcrumb[]
  actions?: React.ReactNode
}

export function Topbar({ title, breadcrumbs, actions }: TopbarProps) {
  return (
    <header className="h-14 bg-bg2 border-b border-[var(--border)] flex items-center justify-between px-7 sticky top-0 z-20">
      <div className="flex items-center gap-2">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5">
            {breadcrumbs.map((crumb, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} className="text-text3" />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-sm text-text2 hover:text-text transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-sm text-text font-syne font-semibold">
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </nav>
        ) : (
          <h1 className="font-syne font-semibold text-lg text-text">{title}</h1>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
