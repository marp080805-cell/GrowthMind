'use client'

import { getBlock } from '@/lib/blocks'
import { Button } from '@/components/ui/button'
import { X, Trash2 } from 'lucide-react'

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
} from './inspectors/meta-actions'

// AI
import { AIAgentInspector } from './inspectors/ai-agent'

// WhatsApp
import { WhatsappInspector } from './inspectors/whatsapp'
import { SendReportInspector, SendFileInspector } from './inspectors/whatsapp-extras'

// Logic
import { ConditionalInspector } from './inspectors/conditional'
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

// Fallback
import { GenericInspector } from './inspectors/generic'

interface InspectorProps {
  nodeId: string
  nodeType: string
  nodeLabel: string
  config: Record<string, unknown>
  onConfigChange: (config: Record<string, unknown>) => void
  onLabelChange: (label: string) => void
  onDelete: () => void
  onClose: () => void
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

  // Meta — Criação
  'meta.create_campaign': CreateCampaignInspector,
  'meta.create_adset': CreateAdSetInspector,
  'meta.create_ad': CreateAdInspector,
  'meta.boost_post': BoostPostInspector,
  'meta.duplicate_campaign': DuplicateCampaignInspector,
  'meta.create_audience': CreateAudienceInspector,

  // Meta — Edição
  'meta.edit_campaign': EditCampaignInspector,
  'meta.edit_adset': EditAdSetInspector,
  'meta.edit_ad': EditAdInspector,
  'meta.adjust_budget': AdjustBudgetInspector,

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
}

export interface InspectorFieldProps {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  nodeId: string
}

export function Inspector({
  nodeId,
  nodeType,
  nodeLabel,
  config,
  onConfigChange,
  onLabelChange,
  onDelete,
  onClose,
}: InspectorProps) {
  const block = getBlock(nodeType)
  const FieldComponent = INSPECTOR_MAP[nodeType] || GenericInspector

  return (
    <div className="w-[270px] h-full bg-bg2 border-l border-[var(--border)] flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-base">{block?.icon}</span>
          <span className="text-sm font-syne font-semibold text-text truncate">
            {block?.label || nodeType}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onDelete} title="Deletar bloco">
            <Trash2 size={14} className="text-red" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Label field */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <label className="text-[10px] font-syne font-semibold text-text3 mb-1 block">
          NOME DO BLOCO
        </label>
        <input
          value={nodeLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={block?.label}
          className="w-full h-8 rounded-[8px] bg-surface border border-[var(--border)] text-text px-2.5 text-xs focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <FieldComponent config={config} onChange={onConfigChange} nodeId={nodeId} />
      </div>
    </div>
  )
}
