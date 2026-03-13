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
  { type: 'trigger.instagram', label: 'Novo post Instagram', description: 'Detecta novo post na conta', icon: '📸', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },
  { type: 'trigger.drive_file', label: 'Arquivo novo no Drive', description: 'Detecta novo arquivo em pasta', icon: '📁', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },
  { type: 'trigger.notion_page', label: 'Página nova no Notion', description: 'Detecta nova entrada em database', icon: '📄', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },
  { type: 'trigger.manual', label: 'Gatilho manual', description: 'Executa ao clicar "Testar agora"', icon: '🔁', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },
  { type: 'trigger.metric', label: 'Métrica atingida', description: 'Dispara quando CPM/CPC/CTR passa de threshold', icon: '📊', category: 'triggers', color: CATEGORY_COLORS.triggers, handles: { inputs: [], outputs: ['default'] } },

  // META ADS
  { type: 'meta.fetch_campaigns', label: 'Buscar campanhas', description: 'Lista campanhas ativas da conta', icon: '📋', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.fetch_metrics', label: 'Buscar métricas', description: 'Puxa métricas de período configurável', icon: '📈', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.create_ad', label: 'Criar anúncio', description: 'Sobe novo anúncio com criativo', icon: '➕', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.edit_ad', label: 'Editar anúncio', description: 'Atualiza texto/criativo de anúncio', icon: '✏️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.pause_ad', label: 'Pausar anúncio', description: 'Pausa anúncio ou campanha inteira', icon: '⏸️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.activate_ad', label: 'Ativar anúncio', description: 'Reativa anúncio ou campanha', icon: '▶️', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.adjust_budget', label: 'Ajustar orçamento', description: 'Altera budget diário ou total', icon: '💰', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.boost_post', label: 'Subir post existente', description: 'Usa post do Instagram como anúncio', icon: '📎', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.fetch_creative_insights', label: 'Buscar insights por criativo', description: 'Performance individual de cada criativo', icon: '🎯', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'meta.fetch_adsets', label: 'Buscar adsets', description: 'Lista adsets de uma campanha', icon: '🔍', category: 'meta', color: CATEGORY_COLORS.meta, handles: { inputs: ['default'], outputs: ['default'] } },

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
  { type: 'drive.monitor_folder', label: 'Monitorar pasta', description: 'Verifica arquivos novos', icon: '🔔', category: 'drive', color: CATEGORY_COLORS.drive, handles: { inputs: ['default'], outputs: ['default'] } },

  // LOGIC
  { type: 'logic.if', label: 'Condicional (IF)', description: 'Divide fluxo em dois caminhos', icon: '❓', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['yes', 'no'] } },
  { type: 'logic.loop', label: 'Loop', description: 'Itera sobre lista de itens', icon: '🔄', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['each', 'done'] } },
  { type: 'logic.wait', label: 'Aguardar', description: 'Pausa execução por tempo configurável', icon: '⏳', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'logic.merge', label: 'Mesclar dados', description: 'Combina saídas de dois caminhos paralelos', icon: '🔀', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['a', 'b'], outputs: ['default'] } },
  { type: 'logic.filter', label: 'Filtrar lista', description: 'Filtra array por condição', icon: '🗂️', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'logic.transform', label: 'Transformar dados', description: 'Manipula JSON, formata texto, cálculos', icon: '🧮', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'logic.stop', label: 'Parar fluxo', description: 'Encerra execução', icon: '🛑', category: 'logic', color: CATEGORY_COLORS.logic, handles: { inputs: ['default'], outputs: [] } },

  // UTILS
  { type: 'util.note', label: 'Nota', description: 'Comentário visual no canvas', icon: '📝', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: [], outputs: [] } },
  { type: 'util.http', label: 'Requisição HTTP', description: 'Chama qualquer endpoint REST externo', icon: '🌐', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'util.format_text', label: 'Formatar texto', description: 'Interpola variáveis em template de texto', icon: '📋', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: ['default'], outputs: ['default'] } },
  { type: 'util.log', label: 'Log de execução', description: 'Registra valor no log para debug', icon: '🔢', category: 'utils', color: CATEGORY_COLORS.utils, handles: { inputs: ['default'], outputs: ['default'] } },
]

export function getBlock(type: string): BlockDefinition | undefined {
  return BLOCKS.find((b) => b.type === type)
}

export const BLOCKS_BY_CATEGORY = BLOCKS.reduce((acc, block) => {
  if (!acc[block.category]) acc[block.category] = []
  acc[block.category].push(block)
  return acc
}, {} as Record<Category, BlockDefinition[]>)
