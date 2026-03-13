'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { ToastProvider } from '@/components/ui/toast'
import { createClient } from '@/lib/supabase'

interface ShellProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
  children: React.ReactNode
}

export function Shell({ title, breadcrumbs, actions, children }: ShellProps) {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
          email: user.email || '',
          role: user.user_metadata?.role || 'manager',
        })
      }
    })
  }, [])

  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar user={user} />
      <div className="flex-1 ml-[220px] flex flex-col min-h-screen">
        <Topbar title={title} breadcrumbs={breadcrumbs} actions={actions} />
        <main className="flex-1 p-7 overflow-y-auto">{children}</main>
      </div>
      <ToastProvider />
    </div>
  )
}
