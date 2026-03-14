'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { automationsApi, type AutomationWithNodes, type AutomationNode, type AutomationEdge } from '@/lib/api'
import { useToast } from './use-toast'

export function useAutomation(id: string) {
  const [automation, setAutomation] = useState<AutomationWithNodes | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { success, error } = useToast()
  const saveTimer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!id || id === 'new') { setLoading(false); return }
    setLoading(true)
    automationsApi
      .get(id)
      .then(setAutomation)
      .catch(() => error('Erro ao carregar automação'))
      .finally(() => setLoading(false))
  }, [id])

  const save = useCallback(
    async (nodes: AutomationNode[], edges: AutomationEdge[]) => {
      if (!automation) return
      setSaving(true)
      try {
        await automationsApi.save(id, { nodes, edges })
        success('Salvo com sucesso')
      } catch {
        error('Erro ao salvar automação')
      } finally {
        setSaving(false)
      }
    },
    [id, automation]
  )

  const debouncedSave = useCallback(
    (nodes: AutomationNode[], edges: AutomationEdge[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => save(nodes, edges), 2000)
    },
    [save]
  )

  const toggle = useCallback(async () => {
    if (!automation) return
    try {
      const updated = await automationsApi.toggle(id)
      setAutomation((prev) => prev ? { ...prev, is_active: updated.is_active } : null)
    } catch {
      error('Erro ao alternar automação')
    }
  }, [id, automation])

  return { automation, loading, saving, save, debouncedSave, toggle, setAutomation }
}
