'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Shell } from '@/components/layout/shell'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { CardSkeleton } from '@/components/ui/skeleton'
import { presetsApi, clientsApi, type Preset, type Client } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Layers, ChevronRight } from 'lucide-react'
import { CATEGORY_COLORS } from '@/lib/blocks'

const TAG_COLORS: Record<string, 'info' | 'success' | 'purple' | 'orange' | 'cyan' | 'warning'> = {
  'meta': 'info',
  'whatsapp': 'success',
  'ia': 'purple',
  'notion': 'warning',
  'drive': 'cyan',
  'agendamento': 'orange',
}

export default function PresetsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { success, error } = useToast()

  const [presets, setPresets] = useState<Preset[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null)
  const [selectedClientId, setSelectedClientId] = useState(searchParams.get('clientId') || '')
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    Promise.all([presetsApi.list(), clientsApi.list()])
      .then(([p, c]) => { setPresets(p); setClients(c) })
      .catch(() => error('Erro ao carregar presets'))
      .finally(() => setLoading(false))
  }, [])

  const handleApply = async () => {
    if (!selectedPreset || !selectedClientId) return
    setApplying(true)
    try {
      const auto = await presetsApi.apply(selectedPreset.id, selectedClientId)
      success('Preset aplicado! Abrindo builder...')
      router.push(`/clients/${selectedClientId}/automations/${auto.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao aplicar preset'
      error(msg)
    } finally {
      setApplying(false)
    }
  }

  return (
    <Shell
      title="Presets"
      actions={
        <div className="flex items-center gap-2 text-sm text-text2">
          <Layers size={14} />
          <span>{presets.length} templates disponíveis</span>
        </div>
      }
    >
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="bg-surface border border-[var(--border)] rounded-lg p-5 hover:border-[var(--border2)] transition-all cursor-pointer"
              onClick={() => setSelectedPreset(preset)}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{preset.icon}</span>
                <div>
                  <h3 className="font-syne font-semibold text-text">{preset.name}</h3>
                  <p className="text-xs text-text2 mt-0.5">{preset.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {preset.tags.map((tag) => (
                  <Badge key={tag} variant={TAG_COLORS[tag.toLowerCase()] || 'default'}>
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-text3">
                  {preset.nodes?.length || 0} blocos
                </span>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedPreset(preset) }}>
                  Usar preset
                  <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!selectedPreset}
        onClose={() => setSelectedPreset(null)}
        title={`Usar preset: ${selectedPreset?.name}`}
        description="Selecione o cliente para importar esta automação"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text2 font-syne">Cliente</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text px-3 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Selecione um cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-text3">
            A automação será criada para o cliente selecionado e você será redirecionado para o builder para configurar os detalhes.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelectedPreset(null)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              loading={applying}
              disabled={!selectedClientId}
              className="flex-1"
            >
              Aplicar preset
            </Button>
          </div>
        </div>
      </Modal>
    </Shell>
  )
}
