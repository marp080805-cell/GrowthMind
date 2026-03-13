import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { ToastProvider } from '@/components/ui/toast'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface ShellProps {
  title: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
  children: React.ReactNode
}

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function Shell({ title, breadcrumbs, actions, children }: ShellProps) {
  const user = await getUser()

  const userData = user
    ? {
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
        email: user.email || '',
        role: user.user_metadata?.role || 'manager',
      }
    : null

  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar user={userData} />
      <div className="flex-1 ml-[220px] flex flex-col min-h-screen">
        <Topbar title={title} breadcrumbs={breadcrumbs} actions={actions} />
        <main className="flex-1 p-7 overflow-y-auto">{children}</main>
      </div>
      <ToastProvider />
    </div>
  )
}
