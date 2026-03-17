'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Shell } from '@/components/layout/shell'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ClientCard } from '@/components/clients/client-card'
import { ClientForm } from '@/components/clients/client-form'
import { CardSkeleton } from '@/components/ui/skeleton'
import { useClients } from '@/hooks/use-client'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search } from 'lucide-react'
import { clientsApi, type Client } from '@/lib/api'

function ClientsPageInner() {
  const { clients, loading, setClients } = useClients()
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Partial<Client> | undefined>()
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const searchParams = useSearchParams()
  const router = useRouter()
  const { success, error } = useToast()

  useEffect(() => {
    const metaError = searchParams.get('meta_error')
    if (metaError) {
      error(metaError === 'cancelled' ? 'Conexão cancelada' : 'Erro ao conectar com Meta')
      router.replace('/clients')
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreated = (client: Client) => {
    setClients((prev) => [client, ...prev])
    setShowModal(false)
    setEditingClient(undefined)
  }

  const handleDelete = async () => {
    if (!deletingClient) return
    setDeleting(true)
    try {
      await clientsApi.delete(deletingClient.id)
      setClients((prev) => prev.filter((c) => c.id !== deletingClient.id))
      setDeletingClient(null)
      success('Cliente removido')
    } catch {
      error('Erro ao remover cliente')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Shell
      title="Clientes"
      actions={
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Novo Cliente
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Search */}
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full h-9 pl-9 pr-3 rounded-[12px] bg-surface border border-[var(--border)] text-text text-sm placeholder:text-text3 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-text3">
            <p className="text-lg mb-2">Nenhum cliente encontrado</p>
            <p className="text-sm">
              {search ? 'Tente uma busca diferente' : 'Crie seu primeiro cliente clicando em "Novo Cliente"'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((client) => (
              <ClientCard key={client.id} client={client} onDelete={setDeletingClient} />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingClient(undefined) }}
        title={editingClient?.id ? 'Editar Cliente' : 'Novo Cliente'}
        description="Preencha os dados do cliente para começar"
        size="lg"
      >
        <ClientForm
          client={editingClient}
          onSuccess={handleCreated}
          onCancel={() => { setShowModal(false); setEditingClient(undefined) }}
        />
      </Modal>

      <Modal
        open={!!deletingClient}
        onClose={() => setDeletingClient(null)}
        title="Remover cliente"
        description={`Remover "${deletingClient?.name}"? Todas as automações, campanhas e dados do cliente serão removidos permanentemente.`}
      >
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setDeletingClient(null)} className="flex-1">Cancelar</Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting} className="flex-1">Remover</Button>
        </div>
      </Modal>
    </Shell>
  )
}

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsPageInner />
    </Suspense>
  )
}
