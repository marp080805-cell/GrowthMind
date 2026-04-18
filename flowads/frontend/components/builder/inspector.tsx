'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getBlock } from '@/lib/blocks'
import { Button } from '@/components/ui/button'
import { X, Trash2, Play, ChevronDown, ChevronRight } from 'lucide-react'
import type { NodeLog } from '@/lib/api'
import { automationsApi } from '@/lib/api'
import { OutputTree } from './output-tree'

// Triggers
import { ScheduleInspector } from './inspectors/schedule'
import { WebhookInspector } from './inspectors/webhook'
import { TriggerMetricInspector } from './inspectors/trigger-metric'

// Meta
import { MetricsInspector } from './inspectors/metrics'
import {
  FetchCampaignsInspector,
  CreateCampaignInspector,
  EditCampaignInspector,
  DuplicateCampaignInspector,
} from './inspectors/meta-campaigns'
import {
  FetchAdSetsInspector,
  CreateAdSetInspector,
  EditAdSetInspector,
} from './inspectors/meta-adsets'
import {
  FetchAdsInspector,
  CreateAdInspector,
  EditAdInspector,
} from './inspectors/meta-ads'
import {
  PauseActivateInspector,
  AdjustBudgetInspector,
  BoostPostInspector,
  InstagramPostsInspector,
  CreativeInsightsInspector,
  AudiencesInspector,
  CreateAudienceInspector,
  CreateAdsFromNewPostsInspector,
  FilterUnsponsoredPostsInspector,
  FilterEligiblePostsInspector,
} from './inspectors/meta-actions'

// AI
import { AIAgentInspector } from './inspectors/ai-agent'

// WhatsApp
import { WhatsappInspector } from './inspectors/whatsapp'
import { SendReportInspector, SendFileInspector } from './inspectors/whatsapp-extras'

// Logic
import { ConditionalInspector } from './inspectors/conditional'
import { SwitchInspector } from './inspectors/switch'
import { LoopInspector } from './inspectors/loop'
import { WaitInspector } from './inspectors/wait'
import { FilterInspector, TransformInspector, MergeInspector, StopInspector } from './inspectors/logic-extras'

// Utils
import { HttpInspector } from './inspectors/http'
import { FormatTextInspector } from './inspectors/format-text'
import { NoteInspector } from './inspectors/note'
import { LogInspector, SetVariableInspector } from './inspectors/util-extras'

// Notion
import {
  NotionCreatePageInspector,
  NotionSearchPagesInspector,
  NotionUpdatePageInspector,
  NotionReadDatabaseInspector,
} from './inspectors/notion'

// Drive
import {
  DriveListFilesInspector,
  DriveDownloadFileInspector,
  DriveUploadFileInspector,
  DriveCreateFolderInspector,
} from './inspectors/drive'

// TickTick
import { TickTickCreateTaskInspector } from './inspectors/ticktick'

// Fallback
import { GenericInspector } from './inspectors/generic'

// Performance
import { EvaluateCampaignInspector } from './inspectors/evaluate-campaign'
import { GetAdMetricsInspector } from './inspectors/get-ad-metrics'
import { UploadCreativeInspector } from './inspectors/meta-upload-creative'

interface InspectorProps {
  nodeId: string
  nodeType: string
  nodeLabel: string
  config: Record<string, unknown>
  onConfigChange: (config: Record<string, unknown>) => void
  onLabelChange: (label: string) => void
  onDelete: () => void
  onClose: () => void
  executionLog?: NodeLog
  previousNodeLog?: NodeLog | null  // undefined = no previous node; null = has previous node but no execution yet
  automationId?: string
}

const INSPECTOR_MAP: Record<string, React.ComponentType<InspectorFieldProps>> = {
  // Triggers
  'trigger.schedule': ScheduleInspector,
  'trigger.webhook': WebhookInspector,
  'trigger.metric': TriggerMetricInspector,

  // Meta — Leitura
  'meta.fetch_campaigns': FetchCampaignsInspector,
  'meta.fetch_adsets': FetchAdSetsInspector,
  'meta.fetch_ads': FetchAdsInspector,
  'meta.fetch_metrics': MetricsInspector,
  'meta.fetch_creative_insights': CreativeInsightsInspector,
  'meta.fetch_instagram_posts': InstagramPostsInspector,
  'meta.fetch_audiences': AudiencesInspector,
  'meta.filter_unsponsored_posts': FilterUnsponsoredPostsInspector,
  'meta.filter_eligible_posts': FilterEligiblePostsInspector,

  // Meta — Criação
  'meta.create_campaign': CreateCampaignInspector,
  'meta.create_adset': CreateAdSetInspector,
  'meta.create_ad': CreateAdInspector,
  'meta.boost_post': BoostPostInspector,
  'meta.duplicate_campaign': DuplicateCampaignInspector,
  'meta.create_audience': CreateAudienceInspector,
  'meta.create_ads_from_new_posts': CreateAdsFromNewPostsInspector,
  'meta.upload_creative': UploadCreativeInspector,

  // Meta — Edição
  'meta.edit_campaign': EditCampaignInspector,
  'meta.edit_adset': EditAdSetInspector,
  'meta.edit_ad': EditAdInspector,
  'meta.adjust_budget': AdjustBudgetInspector,

  // Meta — Performance
  'meta.evaluate_campaign_performance': EvaluateCampaignInspector,
  'meta.get_ad_metrics': GetAdMetricsInspector,

  // Meta — Status
  'meta.pause_ad': PauseActivateInspector,
  'meta.activate_ad': PauseActivateInspector,
  'meta.delete_object': PauseActivateInspector,

  // AI
  'ai.agent': AIAgentInspector,

  // WhatsApp
  'whatsapp.send_message': WhatsappInspector,
  'whatsapp.send_report': SendReportInspector,
  'whatsapp.send_file': SendFileInspector,

  // Logic
  'logic.if': ConditionalInspector,
  'logic.switch': SwitchInspector,
  'logic.loop': LoopInspector,
  'logic.wait': WaitInspector,
  'logic.merge': MergeInspector,
  'logic.filter': FilterInspector,
  'logic.transform': TransformInspector,
  'logic.stop': StopInspector,

  // Utils
  'util.http': HttpInspector,
  'util.format_text': FormatTextInspector,
  'util.note': NoteInspector,
  'util.log': LogInspector,
  'util.set_variable': SetVariableInspector,

  // Notion
  'notion.create_page': NotionCreatePageInspector,
  'notion.search_pages': NotionSearchPagesInspector,
  'notion.update_page': NotionUpdatePageInspector,
  'notion.read_database': NotionReadDatabaseInspector,

  // Drive
  'drive.list_files': DriveListFilesInspector,
  'drive.download_file': DriveDownloadFileInspector,
  'drive.upload_file': DriveUploadFileInspector,
  'drive.create_folder': DriveCreateFolderInspector,

  // TickTick
  'ticktick.create_task': TickTickCreateTaskInspector,
}

export interface InspectorFieldProps {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  nodeId: string
}

type Tab = 'config' | 'input'

export function Inspector({
  nodeId,
  nodeType,
  nodeLabel,
  config,
  onConfigChange,
  onLabelChange,
  onDelete,
  onClose,
  executionLog,
  previousNodeLog,
  automationId,
}: InspectorProps) {
  const block = getBlock(nodeType)
  const FieldComponent = INSPECTOR_MAP[nodeType] || GenericInspector
  const params = useParams<{ automationId?: string }>()
  const resolvedAutomationId = automationId || params?.automationId

  const [tab, setTab] = useState<Tab>('config')
  const [testRunning, setTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<{ output?: unknown; error?: string; duration_ms?: number } | null>(null)
  const [inputExpanded, setInputExpanded] = useState(true)
  const [outputExpanded, setOutputExpanded] = useState(true)

  const hasExecution = !!executionLog
  const inputData = executionLog?.input ?? previousNodeLog?.output
  const outputData = testResult?.output ?? executionLog?.output
  const outputError = testResult?.error ?? (executionLog?.status === 'error' ? executionLog.error : undefined)
  const hasInput = inputData !== undefined && inputData !== null
  const hasOutput = outputData !== undefined && outputData !== null || !!outputError

  // Wide mode: show split panel whenever there's a connected previous node
  // previousNodeLog === undefined means no previous node connected → narrow mode
  // previousNodeLog === null means previous node exists but hasn't run yet → wide mode (show placeholder)
  // previousNodeLog === NodeLog means has execution data → wide mode with data
  const hasPreviousNode = previousNodeLog !== undefined
  const wideMode = hasPreviousNode

  // Reset to config tab when switching between wide/narrow or changing nodes
  useEffect(() => {
    setTab('config')
    setTestResult(null)
    setOutputExpanded(true)
  }, [nodeId])

  // In wide mode, 'input' tab doesn't exist — redirect to config
  useEffect(() => {
    if (wideMode && tab === 'input') setTab('config')
  }, [wideMode, tab])

  // Auto-expand output when new data arrives
  useEffect(() => {
    if (hasOutput) setOutputExpanded(true)
  }, [hasOutput])

  const handleTest = async () => {
    if (!resolvedAutomationId) return
    setTestRunning(true)
    setTestResult(null)
    try {
      const result = await automationsApi.runNode(resolvedAutomationId, nodeId, inputData ?? null)
      setTestResult(result)
      setOutputExpanded(true)
    } catch (err) {
      setTestResult({ error: err instanceof Error ? err.message : String(err) })
      setOutputExpanded(true)
    } finally {
      setTestRunning(false)
    }
  }

  const isTrigger = nodeType.startsWith('trigger.')

  // Tabs to show — in wide mode, no 'input' tab (it's always visible on the left)
  // Output is always shown as a bottom panel, not a tab
  const tabs: Tab[] = wideMode ? ['config'] : ['config', 'input']
  const tabLabel = (t: Tab) => t === 'config' ? 'CONFIG' : 'ENTRADA'

  return (
    <div className={`${wideMode ? 'w-[580px]' : 'w-[300px]'} h-full bg-bg2 border-l border-[var(--border)] flex flex-col overflow-hidden shrink-0 transition-[width] duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{block?.icon}</span>
          <span className="text-xs font-syne font-semibold text-text truncate">
            {block?.label || nodeType}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isTrigger && resolvedAutomationId && (
            <button
              type="button"
              onClick={handleTest}
              disabled={testRunning}
              title="Executar apenas este node"
              className={`flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10px] font-syne font-bold transition-all border ${
                testRunning
                  ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 cursor-wait'
                  : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
              }`}
            >
              <Play size={9} className={testRunning ? 'animate-pulse' : ''} />
              {testRunning ? 'Testando...' : 'Testar'}
            </button>
          )}
          <Button size="icon" variant="ghost" onClick={onDelete} title="Deletar bloco">
            <Trash2 size={13} className="text-red-400" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X size={13} />
          </Button>
        </div>
      </div>

      {/* Label field */}
      <div className="px-3 py-2 border-b border-[var(--border)] shrink-0">
        <label className="text-[9px] font-syne font-semibold text-text3 mb-1 block">NOME DO BLOCO</label>
        <input
          value={nodeLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={block?.label}
          className="w-full h-7 rounded-[6px] bg-surface border border-[var(--border)] text-text px-2 text-xs focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Main body — split in wide mode */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL: Previous node output — only in wide mode */}
        {wideMode && (
          <div className="w-[250px] border-r border-[var(--border)] flex flex-col overflow-hidden shrink-0">
            <div
              className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)] bg-bg3 shrink-0 cursor-pointer select-none"
              onClick={() => setInputExpanded(v => !v)}
            >
              {inputExpanded
                ? <ChevronDown size={10} className="text-text3 shrink-0" />
                : <ChevronRight size={10} className="text-text3 shrink-0" />}
              <div className="min-w-0">
                <p className="text-[9px] font-syne font-bold text-text3 uppercase">← Saída do node anterior</p>
                <p className="text-[8px] text-text3 opacity-60">Arraste os campos para a config →</p>
              </div>
            </div>
            {inputExpanded && (
              <div className="flex-1 overflow-y-auto p-1">
                {hasInput ? (
                  <OutputTree data={inputData} draggable path="input" />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center px-3">
                    <p className="text-[10px] text-text3">Sem dados ainda.</p>
                    <p className="text-[9px] text-text3 opacity-60">Execute o fluxo ou clique ▶ Run no node anterior para ver os dados aqui.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RIGHT PANEL: Config + output tab */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Tabs — only shown when there are multiple tabs */}
          {tabs.length > 1 && (
            <div className="flex border-b border-[var(--border)] shrink-0">
              {tabs.map((t) => {
                const hasBadge = t === 'input' && hasInput
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex-1 py-1.5 text-[10px] font-syne font-bold transition-colors relative ${
                      tab === t
                        ? 'text-accent border-b-2 border-accent -mb-px'
                        : 'text-text3 hover:text-text'
                    }`}
                  >
                    {tabLabel(t)}
                    {hasBadge && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Tab content — scrollable config area */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* CONFIG TAB */}
            {tab === 'config' && (
              <div className="p-3 space-y-3">
                <FieldComponent config={config} onChange={onConfigChange} nodeId={nodeId} />
              </div>
            )}

            {/* INPUT TAB — only in narrow mode */}
            {tab === 'input' && !wideMode && (
              <div className="p-2">
                {hasInput ? (
                  <>
                    <div
                      className="flex items-center gap-1 px-1 py-1 cursor-pointer select-none"
                      onClick={() => setInputExpanded(v => !v)}
                    >
                      {inputExpanded ? <ChevronDown size={11} className="text-text3" /> : <ChevronRight size={11} className="text-text3" />}
                      <p className="text-[9px] font-syne font-bold text-text3">
                        DADOS DO NODE ANTERIOR — arraste para usar como variável
                      </p>
                    </div>
                    {inputExpanded && (
                      <OutputTree data={inputData} draggable path="input" />
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <p className="text-[10px] text-text3">Sem dados de entrada ainda.</p>
                    <p className="text-[9px] text-text3 opacity-70">Execute o fluxo ou teste este node para ver os dados aqui.</p>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ALWAYS-VISIBLE OUTPUT PANEL — bottom of right panel */}
          <div className="shrink-0 border-t border-[var(--border)]">
            <div
              className="flex items-center gap-1 px-2 py-1.5 bg-bg3 cursor-pointer select-none"
              onClick={() => setOutputExpanded(v => !v)}
            >
              {outputExpanded
                ? <ChevronDown size={10} className="text-text3 shrink-0" />
                : <ChevronRight size={10} className="text-text3 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-syne font-bold text-text3 uppercase">Saída do node atual</p>
                <p className="text-[8px] text-text3 opacity-60">Arraste os campos para usar como variável</p>
              </div>
              {hasOutput && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              )}
              {outputError && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              )}
            </div>
            {outputExpanded && (
              <div className="max-h-[200px] overflow-y-auto p-1">
                {outputError && (
                  <div className="mb-1 bg-red-500/10 border border-red-500/20 rounded-[6px] p-2 text-[10px] text-red-400 font-mono break-all">
                    {outputError}
                  </div>
                )}
                {(testResult?.duration_ms !== undefined || executionLog?.duration_ms !== undefined) && (
                  <div className="mb-1 flex items-center gap-1 px-1">
                    <span className="text-[9px] bg-surface border border-[var(--border)] rounded-full px-2 py-0.5 text-text3">
                      {testResult?.duration_ms ?? executionLog?.duration_ms}ms
                    </span>
                    {testResult && <span className="text-[9px] text-green-400 font-syne font-bold">TESTE</span>}
                  </div>
                )}
                {hasOutput && !outputError ? (
                  <OutputTree data={outputData} draggable path="output" />
                ) : !outputError ? (
                  <div className="flex flex-col items-center justify-center py-4 gap-1 text-center">
                    <p className="text-[10px] text-text3">Sem dados de saída ainda.</p>
                    <p className="text-[9px] text-text3 opacity-70">Clique ▶ Testar para executar.</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execution status bar */}
      {hasExecution && (
        <div className={`shrink-0 px-3 py-1.5 border-t border-[var(--border)] flex items-center gap-2 text-[10px] font-syne ${
          executionLog.status === 'success' ? 'text-green-400' :
          executionLog.status === 'error' ? 'text-red-400' :
          executionLog.status === 'skipped' ? 'text-text3' : 'text-yellow-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            executionLog.status === 'success' ? 'bg-green-400' :
            executionLog.status === 'error' ? 'bg-red-400' :
            executionLog.status === 'skipped' ? 'bg-surface2' : 'bg-yellow-400 animate-pulse'
          }`} />
          <span className="font-bold">
            {executionLog.status === 'success' ? 'Executado com sucesso' :
             executionLog.status === 'error' ? 'Erro na execução' :
             executionLog.status === 'skipped' ? 'Pulado (branch inativo)' : 'Executando...'}
          </span>
          <span className="ml-auto text-text3">{executionLog.duration_ms}ms</span>
        </div>
      )}
    </div>
  )
}
