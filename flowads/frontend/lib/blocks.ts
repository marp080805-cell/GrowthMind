export interface BlockDefinition {
  type: string
  label: string
  description: string
  icon: string
  category: Category
  color: string
  handles: {
    inputs: string[]
    outputs: string[]
  }
  defaultConfig?: Record<string, unknown>
}

export type Category =
  | 'triggers'
  | 'meta'
  | 'ai'
  | 'whatsapp'
  | 'notion'
  | 'drive'
  | 'logic'
  | 'utils'

export const CATEGORY_COLORS: Record<Category, string> = {
  triggers: '#ff8c42',
  meta: '#4f6fff',
  ai: '#7b5fff',
  whatsapp: '#22c97a',
  notion: '#8892a4',
  drive: '#22d4e0',
  logic: '#ffd166',
  utils: '#505870',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  triggers: 'TRIGGERS',
  meta: 'META ADS',
  ai: 'AGENTES IA',
  whatsapp: 'WHATSAPP',
  notion: 'NOTION',
  drive: 'GOOGLE DRIVE',
  logic: 'LÓGICA',
  utils: 'UTILITÁRIOS',
}

export const BLOCKS: BlockDefinition[] = [
  // TRIGGERS
  { type: 'trigger.schedule', label: 'Agendamento', description: 'Dispara em horário/dia fixo', icon: '⏰', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },
  { type: 'trigger.webhook', label: 'Webhook', description: 'Recebe requisição POST externa', icon: '🔔', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },
  { type: 'trigger.manual', label: 'Gatilho manual', description: 'Executa ao clicar "Testar agora"', icon: '🔁', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },
  { type: 'trigger.metric', label: 'Métrica atingida', description: 'Dispara quando CPM/CPC/CTR passa de threshold (use com Agendamento)', icon: '📊', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },

  // META ADS — Leitura
  { type: 'meta.fetch_campaigns', label: 'Buscar campanhas', description: 'Lista campanhas da conta com status e budget', icon: '📋', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.fetch_adsets', label: 'Buscar adsets', description: 'Lista conjuntos de anúncios de uma campanha', icon: '🗂️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.fetch_ads', label: 'Buscar anúncios', description: 'Lista anúncios de um adset ou campanha', icon: '🔍', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.get_ad_metrics', label: 'Buscar métricas', description: 'Enriquece anúncios com métricas de performance (CTR, CPC, ROAS, frequência...)', icon: '📊', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] }, defaultConfig: { period: '7d' } },
  { type: 'meta.fetch_metrics', label: 'Buscar métricas', description: 'Puxa métricas de período configurável', icon: '📈', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.fetch_creative_insights', label: 'Insights por criativo', description: 'Performance individual de cada criativo', icon: '🎯', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.fetch_instagram_posts', label: 'Buscar posts Instagram', description: 'Lista posts publicados da conta Instagram', icon: '📸', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.fetch_audiences', label: 'Buscar públicos', description: 'Lista custom audiences e lookalike audiences', icon: '👥', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },

  // META ADS — Criação
  { type: 'meta.create_campaign', label: 'Criar campanha', description: 'Cria nova campanha com objetivo e orçamento', icon: '🚀', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.create_adset', label: 'Criar adset', description: 'Cria conjunto de anúncios com segmentação', icon: '➕', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.create_ad', label: 'Criar anúncio', description: 'Sobe novo anúncio com criativo e segmentação', icon: '📢', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.boost_post', label: 'Impulsionar post', description: 'Impulsiona post existente do Instagram/Facebook', icon: '⚡', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.filter_unsponsored_posts', label: 'Filtrar posts não patrocinados', description: 'Remove da lista os posts que já têm anúncio ativo no Meta Ads', icon: '🔎', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] }, defaultConfig: { source_posts: '{{posts}}' } },
  { type: 'meta.filter_eligible_posts', label: 'Filtrar posts elegíveis para boost', description: 'Remove da lista os posts que não podem ser turbinados via API (collab, efeito restrito, etc)', icon: '✅', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.create_ads_from_new_posts', label: 'Criar anúncios de posts novos', description: 'Cria anúncios para posts Instagram ainda não patrocinados. Evita duplicatas automaticamente.', icon: '📸', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.duplicate_campaign', label: 'Duplicar campanha', description: 'Clona campanha existente', icon: '📋', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.create_audience', label: 'Criar público', description: 'Cria custom audience a partir de lista ou regras', icon: '👤', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.upload_creative', label: 'Upload criativo', description: 'Baixa arquivo do Google Drive e faz upload para a Meta. Detecta automaticamente imagem/vídeo e placement (feed ou story).', icon: '🖼️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] }, defaultConfig: { drive_url: '' } },

  // META ADS — Edição
  { type: 'meta.edit_campaign', label: 'Editar campanha', description: 'Atualiza nome, orçamento ou datas', icon: '✏️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.edit_adset', label: 'Editar adset', description: 'Atualiza segmentação, budget ou datas do adset', icon: '✏️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.edit_ad', label: 'Editar anúncio', description: 'Atualiza texto, link ou criativo', icon: '✏️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.adjust_budget', label: 'Ajustar orçamento', description: 'Altera budget diário ou total de campanha/adset', icon: '💰', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },

  // META ADS — Performance
  { type: 'meta.evaluate_campaign_performance', label: 'Avaliar campanha', description: 'Pontua criativos com scoring inteligente — respeita mínimo de ativos, maturação e tempo máximo', icon: '🎯', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] }, defaultConfig: {} },

  // META ADS — Status
  { type: 'meta.pause_ad', label: 'Pausar', description: 'Pausa campanha, adset ou anúncio', icon: '⏸️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.activate_ad', label: 'Ativar', description: 'Reativa campanha, adset ou anúncio', icon: '▶️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.delete_object', label: 'Excluir objeto', description: 'Remove campanha, adset ou anúncio', icon: '🗑️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },

  // AI AGENTS
  { type: 'ai.agent', label: 'Agente IA', description: 'Bloco livre configurado via prompt', icon: '🤖', category: 'ai', color: CATEGORY_COLORS.ai, handles: { inputs: ['default'], outputs: ['default'] } },

  // WHATSAPP
  { type: 'whatsapp.send_message', label: 'Enviar mensagem', description: 'Envia texto para número configurado', icon: '💬', category: 'whatsapp', color: CATEGORY_COLORS.whatsapp, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'whatsapp.send_file', label: 'Enviar arquivo', description: 'Envia PDF ou imagem', icon: '📎', category: 'whatsapp', color: CATEGORY_COLORS.whatsapp, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'whatsapp.send_report', label: 'Enviar relatório', description: 'Formata e envia relatório de performance', icon: '📊', category: 'whatsapp', color: CATEGORY_COLORS.whatsapp, handles: { inputs: ['default'], outputs: ['default'] } },

  // NOTION
  { type: 'notion.create_page', label: 'Criar página', description: 'Cria nova entrada em database', icon: '📄', category: 'notion', color: CATEGORY_COLORS.notion, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'notion.search_pages', label: 'Buscar páginas', description: 'Consulta database com filtros', icon: '🔍', category: 'notion', color: CATEGORY_COLORS.notion, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'notion.update_page', label: 'Atualizar página', description: 'Edita propriedades de uma página', icon: '✏️', category: 'notion', color: CATEGORY_COLORS.notion, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'notion.read_database', label: 'Ler database', description: 'Importa dados para usar no fluxo', icon: '📥', category: 'notion', color: CATEGORY_COLORS.notion, handles: { inputs: ['default'], outputs: ['default'] } },

  // DRIVE
  { type: 'drive.list_files', label: 'Listar arquivos', description: 'Lista arquivos de pasta configurada', icon: '📁', category: 'drive', color: CATEGORY_COLORS.drive, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'drive.download_file', label: 'Baixar arquivo', description: 'Download de arquivo para usar no fluxo', icon: '⬇️', category: 'drive', color: CATEGORY_COLORS.drive, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'drive.upload_file', label: 'Upload de arquivo', description: 'Envia arquivo gerado pela automação', icon: '⬆️', category: 'drive', color: CATEGORY_COLORS.drive, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'drive.create_folder', label: 'Criar pasta', description: 'Cria nova pasta no Drive', icon: '🗂️', category: 'drive', color: CATEGORY_COLORS.drive, handles: { inputs: ['default'], outputs: ['default'] } },

  // LOGIC
  { type: 'logic.if', label: 'Condicional (IF)', description: 'Divide fluxo em dois caminhos', icon: '❓', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['yes', 'no'] } },
  { type: 'logic.switch', label: 'Switch', description: 'Roteia para N saídas por palavra-chave ou valor', icon: '🔀', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['default'] }, defaultConfig: { variable: '', cases: [] } },
  { type: 'logic.loop', label: 'Loop', description: 'Itera sobre lista de itens', icon: '🔄', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['each', 'done'] } },
  { type: 'logic.wait', label: 'Aguardar', description: 'Pausa execução por tempo configurável', icon: '⏳', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'logic.merge', label: 'Mesclar dados', description: 'Combina saídas de dois caminhos paralelos', icon: '🔀', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['a', 'b'], outputs: ['default'] } },
  { type: 'logic.filter', label: 'Filtrar lista', description: 'Filtra array por condição', icon: '🗂️', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'logic.transform', label: 'Transformar dados', description: 'Manipula JSON, formata texto, cálculos', icon: '🧮', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'logic.stop', label: 'Parar fluxo', description: 'Encerra execução imediatamente', icon: '🛑', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: [] } },

  // UTILS
  { type: 'util.note', label: 'Nota', description: 'Comentário visual no canvas', icon: '📝', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: [], outputs: [] } },
  { type: 'util.http', label: 'Requisição HTTP', description: 'Chama qualquer endpoint REST externo', icon: '🌐', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'util.format_text', label: 'Formatar texto', description: 'Interpola variáveis em template de texto', icon: '📋', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'util.log', label: 'Log de execução', description: 'Registra valor no log para debug', icon: '🔢', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'util.set_variable', label: 'Definir variável', description: 'Cria ou sobrescreve variável no fluxo', icon: '📌', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: ['default'], outputs: ['default'] } },
]

export function getBlock(type: string): BlockDefinition | undefined {
  return BLOCKS.find((b) => b.type === type)
}

export const BLOCKS_BY_CATEGORY = BLOCKS.reduce((acc, block) => {
  if (!acc[block.category]) acc[block.category] = []
  acc[block.category].push(block)
  return acc
}, {} as Record<Category, BlockDefinition[]>)
