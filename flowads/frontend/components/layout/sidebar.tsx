'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, getInitials, getAvatarColor } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Brain,
  Settings,
  LogOut,
  Bot,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const navItems = [
  {
    section: 'PRINCIPAL',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/clients', icon: Users, label: 'Clientes' },
    ],
  },
  {
    section: 'FERRAMENTAS',
    items: [
      { href: '/automacoes', icon: Brain, label: 'Automações' },
      { href: '/agentes', icon: Bot, label: 'Agentes' },
      { href: '/users', icon: Users, label: 'Usuários' },
    ],
  },
  {
    section: 'SISTEMA',
    items: [
      { href: '/settings', icon: Settings, label: 'Configurações' },
    ],
  },
]

interface SidebarProps {
  user?: { name: string; email: string; role: string } | null
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase?.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-[220px] h-screen bg-bg2 border-r border-[var(--border)] flex flex-col fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[8px] bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shadow-[0_0_16px_var(--accent-glow)]">
            <Brain size={16} className="text-white" />
          </div>
          <span className="font-syne font-bold text-lg">
            <span className="text-text">Ad</span>
            <span className="text-accent">Mind</span>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {navItems.map((section) => (
          <div key={section.section}>
            <p className="text-[10px] font-syne font-semibold text-text3 px-2 mb-1.5 tracking-wider">
              {section.section}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-2 rounded-[10px]',
                      'text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-accent/10 text-accent'
                        : 'text-text2 hover:bg-surface hover:text-text'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon size={16} />
                      {item.label}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info */}
      {user && (
        <div className="p-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 p-2 rounded-[10px] hover:bg-surface transition-colors group">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-syne font-bold text-white shrink-0"
              style={{ backgroundColor: getAvatarColor(user.name) }}
            >
              {getInitials(user.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">{user.name}</p>
              <p className="text-[10px] text-text3 capitalize">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-text3 hover:text-red transition-colors"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
