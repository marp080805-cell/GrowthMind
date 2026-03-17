'use client'

import { useState, useEffect } from 'react'
import { Shell } from '@/components/layout/shell'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TableSkeleton } from '@/components/ui/skeleton'
import { usersApi, type User } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { formatDate, getInitials, getAvatarColor } from '@/lib/utils'
import { Plus, MoreHorizontal, Shield, UserCheck, UserX, Trash2 } from 'lucide-react'

export default function UsersPage() {
  const { success, error } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'manager' as 'admin' | 'manager' })

  useEffect(() => {
    usersApi.list()
      .then(setUsers)
      .catch(() => error('Erro ao carregar usuários'))
      .finally(() => setLoading(false))
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { error('Preencha todos os campos'); return }
    setInviteLoading(true)
    try {
      const user = await usersApi.create(form)
      setUsers((prev) => [user, ...prev])
      success('Usuário criado com sucesso!')
      setShowInvite(false)
      setForm({ name: '', email: '', password: '', role: 'manager' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar usuário'
      error(msg)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleToggleStatus = async (user: User) => {
    try {
      const updated = await usersApi.update(user.id, { is_active: !user.is_active })
      setUsers((prev) => prev.map((u) => u.id === user.id ? updated : u))
      success(updated.is_active ? 'Usuário ativado' : 'Usuário desativado')
    } catch {
      error('Erro ao atualizar status')
    }
    setMenuOpen(null)
  }

  const handleDelete = async () => {
    if (!deletingUser) return
    setDeleteLoading(true)
    try {
      await usersApi.delete(deletingUser.id)
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id))
      success('Usuário removido')
      setDeletingUser(null)
    } catch {
      error('Erro ao remover usuário')
    } finally {
      setDeleteLoading(false)
      setMenuOpen(null)
    }
  }

  return (
    <Shell
      title="Usuários"
      actions={
        <Button size="sm" onClick={() => setShowInvite(true)}>
          <Plus size={14} />
          Criar usuário
        </Button>
      }
    >
      <div className="bg-surface border border-[var(--border)] rounded-lg overflow-visible">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {['Usuário', 'Email', 'Role', 'Status', 'Criado em', ''].map((h, i, arr) => (
                <th key={h} className={`text-left text-xs font-syne font-semibold text-text3 px-4 py-3 ${i === 0 ? 'rounded-tl-lg' : ''} ${i === arr.length - 1 ? 'rounded-tr-lg' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><TableSkeleton rows={5} /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-text3">Nenhum usuário</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} className="border-b border-[var(--border)] last:border-0 hover:bg-bg3/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-syne font-bold text-white shrink-0"
                      style={{ backgroundColor: getAvatarColor(user.name) }}
                    >
                      {getInitials(user.name)}
                    </div>
                    <span className="text-sm font-medium text-text">{user.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-text2">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={user.role === 'admin' ? 'purple' : 'info'}>
                    {user.role === 'admin' ? <><Shield size={10} /> Admin</> : <><UserCheck size={10} /> Gestor</>}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.is_active ? 'success' : 'default'}>
                    {user.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-text2">{formatDate(user.created_at)}</td>
                <td className="px-4 py-3 relative">
                  <button
                    onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                    className="text-text3 hover:text-text transition-colors p-1"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {menuOpen === user.id && (
                    <div className="absolute right-4 top-10 z-10 bg-surface border border-[var(--border2)] rounded-[10px] shadow-2xl min-w-[160px] overflow-hidden">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text2 hover:bg-surface2 hover:text-text transition-colors"
                      >
                        <UserX size={14} />
                        {user.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => { setDeletingUser(user); setMenuOpen(null) }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red hover:bg-red/5 transition-colors"
                      >
                        <Trash2 size={14} />
                        Remover
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        title="Remover usuário"
        description={`Remover "${deletingUser?.name}"? Esta ação não pode ser desfeita.`}
      >
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setDeletingUser(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteLoading} className="flex-1">Remover</Button>
        </div>
      </Modal>

      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Criar usuário"
        description="Preencha os dados do novo usuário"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <Input label="Nome *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          <Input label="Email *" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
          <Input label="Senha *" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text2 font-syne">Perfil</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'admin' | 'manager' }))}
              className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent"
            >
              <option value="manager">Gestor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowInvite(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" loading={inviteLoading} className="flex-1">Criar usuário</Button>
          </div>
        </form>
      </Modal>
    </Shell>
  )
}
