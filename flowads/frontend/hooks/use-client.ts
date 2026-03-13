'use client'

import { useState, useEffect } from 'react'
import { clientsApi, type Client } from '@/lib/api'
import { useToast } from './use-toast'

export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const { error } = useToast()

  useEffect(() => {
    clientsApi
      .list()
      .then(setClients)
      .catch(() => error('Erro ao carregar clientes'))
      .finally(() => setLoading(false))
  }, [])

  return { clients, loading, setClients }
}

export function useClient(id: string) {
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const { error } = useToast()

  useEffect(() => {
    if (!id) return
    clientsApi
      .get(id)
      .then(setClient)
      .catch(() => error('Erro ao carregar cliente'))
      .finally(() => setLoading(false))
  }, [id])

  return { client, loading, setClient }
}
