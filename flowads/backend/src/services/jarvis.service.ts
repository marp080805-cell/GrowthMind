import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../lib/supabase'
import { MetaService } from './meta.service'
import { WhatsAppService } from './whatsapp.service'

const SESSION_ID = '00000000-0000-0000-0000-000000000001'
const HISTORY_LIMIT = 30
const MODEL = 'claude-opus-4-6'

// ─── Tool definitions para o Claude ─────────────────────────────────────────

const JARVIS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_clients',
    description: 'Lista todos os clientes cadastrados com status e conta Meta',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_client_metrics',
    description: 'Busca métricas de campanhas de um cliente específico (gasto, CTR, ROAS, etc)',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        period: { type: 'string', description: 'Período: today, yesterday, last_7d, last_30d', default: 'last_7d' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'get_all_clients_summary',
    description: 'Resumo rápido de todos os clientes: quais têm anúncios ativos, quais precisam de atenção',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_campaigns',
    description: 'Lista campanhas ativas de um cliente',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        status: { type: 'string', description: 'ACTIVE, PAUSED, ou vazio para todas', default: 'ACTIVE' },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'get_adsets',
    description: 'Lista conjuntos de anúncios (adsets) de uma campanha',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        campaign_id: { type: 'string', description: 'ID da campanha na Meta' },
      },
      required: ['client_id', 'campaign_id'],
    },
  },
  {
    name: 'get_ads',
    description: 'Lista anúncios de um conjunto de anúncios',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        adset_id: { type: 'string', description: 'ID do adset na Meta' },
      },
      required: ['client_id', 'adset_id'],
    },
  },
  {
    name: 'get_instagram_posts',
    description: 'Lista posts recentes do Instagram de um cliente. Aceita filtro de busca na legenda.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        search: { type: 'string', description: 'Palavra-chave para filtrar na legenda (ex: vaga, emprego, promoção)' },
        limit: { type: 'number', description: 'Quantidade de posts (padrão: 10)', default: 10 },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'boost_post',
    description: 'Impulsiona um post do Instagram criando campanha + conjunto + anúncio na Meta. SEMPRE confirmar antes com o usuário.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        post_id: { type: 'string', description: 'ID do post do Instagram' },
        post_caption_preview: { type: 'string', description: 'Prévia da legenda para mostrar ao usuário' },
        budget_per_day: { type: 'number', description: 'Budget diário em reais' },
        days: { type: 'number', description: 'Duração em dias' },
        campaign_name: { type: 'string', description: 'Nome da campanha a criar' },
        objective: { type: 'string', description: 'Objetivo: POST_ENGAGEMENT, REACH, ou LINK_CLICKS', default: 'POST_ENGAGEMENT' },
      },
      required: ['client_id', 'post_id', 'budget_per_day', 'days'],
    },
  },
  {
    name: 'create_ad_in_existing',
    description: 'Cria um anúncio em campanha e conjunto EXISTENTES. Usar quando o usuário especificou onde colocar o anúncio.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        campaign_id: { type: 'string', description: 'ID da campanha existente na Meta' },
        adset_id: { type: 'string', description: 'ID do conjunto existente na Meta' },
        ad_name: { type: 'string', description: 'Nome do anúncio' },
        creative_type: { type: 'string', description: 'instagram_post (post existente) ou uploaded (link do Drive)', enum: ['instagram_post', 'uploaded'] },
        instagram_post_id: { type: 'string', description: 'ID do post do Instagram (se creative_type = instagram_post)' },
        drive_url: { type: 'string', description: 'URL do arquivo no Google Drive (se creative_type = uploaded)' },
        ad_title: { type: 'string', description: 'Título do anúncio (para uploaded)' },
        ad_body: { type: 'string', description: 'Texto do anúncio (para uploaded)' },
      },
      required: ['client_id', 'campaign_id', 'adset_id', 'ad_name', 'creative_type'],
    },
  },
  {
    name: 'pause_ads',
    description: 'Pausa anúncios, conjuntos ou campanhas. SEMPRE confirmar antes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        object_ids: { type: 'array', items: { type: 'string' }, description: 'IDs dos objetos a pausar na Meta' },
        object_type: { type: 'string', description: 'ad, adset, ou campaign', enum: ['ad', 'adset', 'campaign'] },
        reason: { type: 'string', description: 'Motivo da pausa (para log)' },
      },
      required: ['client_id', 'object_ids', 'object_type'],
    },
  },
  {
    name: 'activate_ads',
    description: 'Ativa anúncios, conjuntos ou campanhas pausados. SEMPRE confirmar antes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        object_ids: { type: 'array', items: { type: 'string' }, description: 'IDs dos objetos a ativar' },
        object_type: { type: 'string', description: 'ad, adset, ou campaign' },
      },
      required: ['client_id', 'object_ids', 'object_type'],
    },
  },
  {
    name: 'adjust_budget',
    description: 'Altera o budget de uma campanha ou conjunto. SEMPRE confirmar antes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'ID do cliente' },
        object_id: { type: 'string', description: 'ID da campanha ou adset na Meta' },
        object_type: { type: 'string', description: 'campaign ou adset' },
        new_budget: { type: 'number', description: 'Novo budget diário em reais' },
        current_budget_info: { type: 'string', description: 'Info do budget atual para mostrar na confirmação' },
      },
      required: ['client_id', 'object_id', 'object_type', 'new_budget'],
    },
  },
  {
    name: 'save_memory',
    description: 'Salva um aprendizado ou preferência para uso futuro. Usar quando o usuário ensinar algo explicitamente ou quando ele especificar preferências claras durante uma ação.',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Chave curta em snake_case (ex: beleza_natural_campanha_padrao)' },
        value: { type: 'string', description: 'Valor completo e detalhado para ser lembrado no futuro' },
        category: { type: 'string', description: 'Categoria: client_preference, default, procedure, restriction', default: 'general' },
        client_id: { type: 'string', description: 'ID do cliente se for preferência específica de cliente (opcional)' },
        client_name: { type: 'string', description: 'Nome do cliente para referência (opcional)' },
        learned_from: { type: 'string', description: 'Trecho da mensagem que gerou esse aprendizado' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'forget_memory',
    description: 'Remove uma memória salva quando o usuário pedir para esquecer algo',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Chave da memória a remover' },
        client_id: { type: 'string', description: 'ID do cliente se for memória específica de cliente' },
      },
      required: ['key'],
    },
  },
  {
    name: 'list_memories',
    description: 'Lista todas as memórias aprendidas, opcionalmente filtradas por cliente',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_id: { type: 'string', description: 'Filtrar por cliente (opcional)' },
        category: { type: 'string', description: 'Filtrar por categoria (opcional)' },
      },
      required: [],
    },
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getClientById(clientId: string) {
  const { data } = await supabase.from('clients').select('*').eq('id', clientId).single()
  return data
}

async function getSettings() {
  const { data } = await supabase.from('settings').select('*').single()
  return data
}

function buildMetaService(client: { meta_token: string; ad_account_id: string }) {
  return new MetaService(client.meta_token, client.ad_account_id)
}

function formatBRL(cents: number) {
  return `R$${(cents / 100).toFixed(2).replace('.', ',')}`
}

// ─── Execução das tools ───────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_clients': {
      const { data } = await supabase.from('clients').select('id, name, business_type, status, ad_account_id').order('name')
      return data || []
    }

    case 'get_all_clients_summary': {
      const { data: clients } = await supabase.from('clients').select('id, name, business_type, status, meta_token, ad_account_id').eq('status', 'active')
      if (!clients?.length) return { summary: 'Nenhum cliente ativo cadastrado.' }

      const summaries = []
      for (const client of clients.slice(0, 10)) {
        try {
          const meta = buildMetaService(client)
          const campaigns = await meta.getCampaigns('ACTIVE')
          summaries.push({
            client: client.name,
            active_campaigns: campaigns.length,
            status: campaigns.length > 0 ? 'ativo' : 'sem campanhas ativas',
          })
        } catch {
          summaries.push({ client: client.name, status: 'erro ao buscar (token pode estar expirado)' })
        }
      }
      return summaries
    }

    case 'get_client_metrics': {
      const { client_id, period = 'last_7d' } = input as { client_id: string; period?: string }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')

      const periodMap: Record<string, string> = {
        today: 'today', yesterday: 'yesterday', last_7d: 'last_7_d', last_30d: 'last_30_d',
      }
      const meta = buildMetaService(client)
      const metrics = await meta.getMetrics(null, periodMap[period] || 'last_7_d', [])
      return { client: client.name, period, metrics }
    }

    case 'get_campaigns': {
      const { client_id, status } = input as { client_id: string; status?: string }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      const meta = buildMetaService(client)
      const campaigns = await meta.getCampaigns(status || undefined)
      return campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        budget: c.daily_budget ? formatBRL(parseInt(c.daily_budget)) + '/dia' : c.lifetime_budget ? formatBRL(parseInt(c.lifetime_budget)) + ' total' : 'sem budget',
      }))
    }

    case 'get_adsets': {
      const { client_id, campaign_id } = input as { client_id: string; campaign_id: string }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      const meta = buildMetaService(client)
      const adsets = await meta.getAdSets(campaign_id)
      return adsets.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        budget: a.daily_budget ? formatBRL(parseInt(a.daily_budget)) + '/dia' : 'herda da campanha',
      }))
    }

    case 'get_ads': {
      const { client_id, adset_id } = input as { client_id: string; adset_id: string }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      const meta = buildMetaService(client)
      const ads = await meta.getAds(adset_id)
      return ads.map(a => ({ id: a.id, name: a.name, status: a.status }))
    }

    case 'get_instagram_posts': {
      const { client_id, search, limit = 10 } = input as { client_id: string; search?: string; limit?: number }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      if (!client.instagram_account_id) throw new Error('Cliente não tem conta Instagram configurada')
      const meta = buildMetaService(client)
      const allPosts = await meta.getInstagramPosts(client.instagram_account_id, limit * 3)
      let posts = allPosts
      if (search) {
        const lower = search.toLowerCase()
        posts = allPosts.filter(p => p.caption?.toLowerCase().includes(lower))
      }
      return posts.slice(0, limit).map(p => ({
        id: p.id,
        caption_preview: p.caption ? p.caption.slice(0, 80) + (p.caption.length > 80 ? '...' : '') : '(sem legenda)',
        media_type: p.media_type,
        permalink: p.permalink,
        timestamp: p.timestamp,
        likes: p.like_count,
      }))
    }

    case 'boost_post': {
      const { client_id, post_id, budget_per_day, days, campaign_name, objective = 'POST_ENGAGEMENT' } = input as {
        client_id: string; post_id: string; post_caption_preview?: string
        budget_per_day: number; days: number; campaign_name?: string; objective?: string
      }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      const meta = buildMetaService(client)

      // Cria campanha
      const campaignName = campaign_name || `Impulsionado - ${new Date().toLocaleDateString('pt-BR')}`
      const campaign = await meta.createCampaign({
        name: campaignName,
        objective,
        status: 'ACTIVE',
        daily_budget: budget_per_day,
      })

      // Calcula datas
      const now = new Date()
      const endDate = new Date(now.getTime() + days * 24 * 3600 * 1000)

      // Cria adset
      const adset = await meta.createAdSet({
        name: campaignName,
        campaign_id: campaign.id,
        daily_budget: budget_per_day,
        billing_event: 'IMPRESSIONS',
        optimization_goal: objective === 'POST_ENGAGEMENT' ? 'POST_ENGAGEMENT' : 'REACH',
        status: 'ACTIVE',
        end_time: endDate.toISOString(),
        targeting: {
          geo_locations: { countries: ['BR'] },
          age_min: 18,
          age_max: 65,
        },
      })

      // Cria anúncio com post do Instagram
      const ad = await meta.createAd({
        name: campaignName,
        adset_id: adset.id,
        campaign_id: campaign.id,
        creative_type: 'instagram_post',
        source_instagram_media_id: post_id,
        page_id: client.facebook_page_id || '',
        status: 'ACTIVE',
      })

      // Log da ação
      await supabase.from('jarvis_action_log').insert({
        client_id, client_name: client.name,
        action_type: 'boost_post',
        action_params: input,
        success: true,
        result: { campaign_id: campaign.id, adset_id: adset.id, ad_id: ad.ad_id },
        channel: 'platform',
      })

      return {
        success: true,
        campaign_id: campaign.id,
        adset_id: adset.id,
        ad_id: ad.ad_id,
        message: `Post impulsionado! Campanha "${campaignName}" ativa por ${days} dia(s) com R$${budget_per_day}/dia.`,
      }
    }

    case 'create_ad_in_existing': {
      const { client_id, campaign_id, adset_id, ad_name, creative_type, instagram_post_id, drive_url, ad_title, ad_body } = input as {
        client_id: string; campaign_id: string; adset_id: string; ad_name: string
        creative_type: string; instagram_post_id?: string; drive_url?: string
        ad_title?: string; ad_body?: string
      }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      const meta = buildMetaService(client)

      const ad = await meta.createAd({
        name: ad_name,
        adset_id,
        campaign_id,
        creative_type: creative_type as 'instagram_post' | 'uploaded',
        source_instagram_media_id: instagram_post_id,
        drive_url,
        title: ad_title,
        body: ad_body,
        page_id: client.facebook_page_id || '',
        status: 'ACTIVE',
      })

      await supabase.from('jarvis_action_log').insert({
        client_id, client_name: client.name,
        action_type: 'create_ad_in_existing',
        action_params: input,
        success: true,
        result: ad,
        channel: 'platform',
      })

      return { success: true, ad_id: ad.ad_id, message: `Anúncio "${ad_name}" criado com sucesso!` }
    }

    case 'pause_ads': {
      const { client_id, object_ids, object_type, reason } = input as {
        client_id: string; object_ids: string[]; object_type: string; reason?: string
      }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      const meta = buildMetaService(client)
      const results = []
      for (const id of object_ids) {
        await meta.pauseObject(id)
        results.push({ id, paused: true })
      }
      await supabase.from('jarvis_action_log').insert({
        client_id, client_name: client.name,
        action_type: 'pause_ads',
        action_params: { object_ids, object_type, reason },
        success: true,
        result: { paused: results.length },
      })
      return { success: true, paused: results.length, message: `${results.length} ${object_type}(s) pausado(s).` }
    }

    case 'activate_ads': {
      const { client_id, object_ids, object_type } = input as {
        client_id: string; object_ids: string[]; object_type: string
      }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      const meta = buildMetaService(client)
      for (const id of object_ids) {
        await meta.activateObject(id)
      }
      await supabase.from('jarvis_action_log').insert({
        client_id, client_name: client.name,
        action_type: 'activate_ads',
        action_params: { object_ids, object_type },
        success: true,
        result: { activated: object_ids.length },
      })
      return { success: true, activated: object_ids.length, message: `${object_ids.length} ${object_type}(s) ativado(s).` }
    }

    case 'adjust_budget': {
      const { client_id, object_id, object_type, new_budget } = input as {
        client_id: string; object_id: string; object_type: string; new_budget: number
      }
      const client = await getClientById(client_id)
      if (!client) throw new Error('Cliente não encontrado')
      const meta = buildMetaService(client)
      await meta.updateBudget(object_id, { daily_budget: new_budget })
      await supabase.from('jarvis_action_log').insert({
        client_id, client_name: client.name,
        action_type: 'adjust_budget',
        action_params: { object_id, object_type, new_budget },
        success: true,
        result: { new_budget },
      })
      return { success: true, message: `Budget atualizado para R$${new_budget}/dia.` }
    }

    case 'save_memory': {
      const { key, value, category = 'general', client_id, client_name, learned_from } = input as {
        key: string; value: string; category?: string; client_id?: string; client_name?: string; learned_from?: string
      }
      await supabase.from('jarvis_memory').upsert({
        key,
        value,
        category,
        client_id: client_id || null,
        client_name: client_name || null,
        learned_from: learned_from || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key,client_id' })
      return { saved: true, key, value }
    }

    case 'forget_memory': {
      const { key, client_id } = input as { key: string; client_id?: string }
      const query = supabase.from('jarvis_memory').delete().eq('key', key)
      if (client_id) query.eq('client_id', client_id)
      else query.is('client_id', null)
      await query
      return { forgotten: true, key }
    }

    case 'list_memories': {
      const { client_id, category } = input as { client_id?: string; category?: string }
      let query = supabase.from('jarvis_memory').select('*').order('updated_at', { ascending: false })
      if (client_id) query = query.eq('client_id', client_id)
      if (category) query = query.eq('category', category)
      const { data } = await query
      return data || []
    }

    default:
      throw new Error(`Tool desconhecida: ${name}`)
  }
}

// ─── Carrega contexto (memórias + histórico) ─────────────────────────────────

async function loadMemories(): Promise<string> {
  const { data: memories } = await supabase
    .from('jarvis_memory')
    .select('key, value, category, client_name, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (!memories?.length) return ''

  const lines = memories.map(m => {
    const clientInfo = m.client_name ? ` [Cliente: ${m.client_name}]` : ''
    return `• [${m.category}]${clientInfo} ${m.key}: ${m.value}`
  })

  return `\n\n## O QUE VOCÊ JÁ APRENDEU (MEMÓRIAS SALVAS):\n${lines.join('\n')}\nUse essas informações para reduzir perguntas ao usuário.`
}

async function loadHistory(): Promise<Anthropic.MessageParam[]> {
  const { data: messages } = await supabase
    .from('jarvis_messages')
    .select('role, content')
    .eq('session_id', SESSION_ID)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (!messages?.length) return []

  return messages
    .reverse()
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

async function loadClients(): Promise<string> {
  const { data } = await supabase.from('clients').select('id, name, business_type, status').order('name')
  if (!data?.length) return 'Nenhum cliente cadastrado.'
  return data.map(c => `• ${c.name} (${c.business_type}) — ID: ${c.id} — Status: ${c.status}`).join('\n')
}

// ─── System prompt ────────────────────────────────────────────────────────────

async function buildSystemPrompt(): Promise<string> {
  const clients = await loadClients()
  const memories = await loadMemories()
  const now = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return `Você é o JARVIS — assistente de tráfego digital do AdMind. Hoje é ${now}.

## SEUS CLIENTES:
${clients}

## SUAS RESPONSABILIDADES:
Você tem acesso total à plataforma AdMind e à Meta Ads API. Você pode:
- Buscar informações (métricas, campanhas, conjuntos, anúncios, posts Instagram)
- Criar anúncios em campanhas/conjuntos existentes
- Impulsionar posts do Instagram
- Pausar, ativar e ajustar budgets
- Aprender e lembrar preferências do gestor

## REGRAS FUNDAMENTAIS:

### NUNCA crie campanha ou conjunto novo sem o usuário pedir explicitamente
Quando o usuário pedir para "subir um anúncio" ou "colocar um criativo":
1. Pergunte em qual cliente (se não especificou)
2. Chame get_campaigns para mostrar as opções
3. Aguarde o usuário escolher a campanha
4. Chame get_adsets para mostrar os conjuntos
5. Aguarde o usuário escolher o conjunto
6. Pergunte o nome do anúncio
7. Pergunte o criativo (post ID ou link do Drive)
8. Mostre o resumo e peça confirmação
9. Só então execute

### SEMPRE confirme antes de executar qualquer ação que MUDA algo na Meta
Pausar, ativar, criar, ajustar budget — sempre mostrar um resumo e pedir "Confirma? (sim/não)" antes de executar.

### Quando o usuário especificar preferências, SALVE automaticamente com save_memory
Exemplos:
- "Sempre que subir post do cliente X, usar campanha Y" → save_memory
- "Meu budget padrão para post de vaga é R$50/dia" → save_memory
- Ao executar uma ação onde o usuário especificou campanha+conjunto para um cliente → save_memory como preferência

### Use as memórias salvas para reduzir perguntas
Se você já sabe qual campanha o usuário usa para o cliente X, sugira-a em vez de listar todas as opções. Mas ainda confirme antes de usar.

### Respostas concisas
- Listas: máximo 5-8 itens, numerados para facilitar a resposta ("1. ...", "2. ...")
- Confirmações: mostre apenas o essencial
- Após executar: confirme brevemente e pergunte se precisa de mais alguma coisa
- Emojis são bem-vindos mas não exagere

### Quando o usuário ensinar algo explicitamente
Frases como "aprende que...", "lembra que...", "sempre que...", "nunca..." → salve com save_memory IMEDIATAMENTE e confirme que aprendeu.
${memories}`
}

// ─── Função principal ─────────────────────────────────────────────────────────

export interface JarvisMessage {
  role: 'user' | 'assistant'
  content: string
  was_audio?: boolean
  channel?: 'platform' | 'whatsapp'
}

export interface JarvisResponse {
  message: string
  actions_executed: Array<{ tool: string; success: boolean; summary: string }>
  requires_confirmation: boolean
}

export async function processJarvisMessage(
  userMessage: string,
  options: { was_audio?: boolean; channel?: 'platform' | 'whatsapp' } = {}
): Promise<JarvisResponse> {
  const settings = await getSettings()
  if (!settings?.anthropic_key) throw new Error('Chave Anthropic não configurada em Configurações')

  const anthropic = new Anthropic({ apiKey: settings.anthropic_key })

  // Salva mensagem do usuário no histórico
  await supabase.from('jarvis_messages').insert({
    session_id: SESSION_ID,
    role: 'user',
    content: userMessage,
    channel: options.channel || 'platform',
    was_audio: options.was_audio || false,
  })

  // Carrega contexto completo
  const [systemPrompt, history] = await Promise.all([buildSystemPrompt(), loadHistory()])

  // Remove última mensagem do histórico (já é a que acabou de salvar)
  const historyWithoutLast = history.slice(0, -1)

  const actionsExecuted: Array<{ tool: string; success: boolean; summary: string }> = []

  // Loop de tool use — Claude pode chamar várias tools em sequência
  const messages: Anthropic.MessageParam[] = [
    ...historyWithoutLast,
    { role: 'user', content: userMessage },
  ]

  let finalMessage = ''
  let iterations = 0
  const MAX_ITERATIONS = 10

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await anthropic.messages.create({
      model: MODEL,
      system: systemPrompt,
      messages,
      tools: JARVIS_TOOLS,
      max_tokens: 2048,
    })

    // Se parou por tool_use, executa as tools
    if (response.stop_reason === 'tool_use') {
      const assistantMessage: Anthropic.MessageParam = {
        role: 'assistant',
        content: response.content,
      }
      messages.push(assistantMessage)

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        const toolName = block.name
        const toolInput = block.input as Record<string, unknown>

        let result: unknown
        let success = true

        try {
          result = await executeTool(toolName, toolInput)
          actionsExecuted.push({
            tool: toolName,
            success: true,
            summary: JSON.stringify(result).slice(0, 100),
          })
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) }
          success = false
          actionsExecuted.push({
            tool: toolName,
            success: false,
            summary: result.error as string,
          })
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
          is_error: !success,
        })
      }

      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Resposta final em texto
    finalMessage = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n')
    break
  }

  // Salva resposta do assistente no histórico
  await supabase.from('jarvis_messages').insert({
    session_id: SESSION_ID,
    role: 'assistant',
    content: finalMessage,
    channel: options.channel || 'platform',
  })

  // Atualiza last_active da sessão
  await supabase
    .from('jarvis_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', SESSION_ID)

  const requiresConfirmation = finalMessage.toLowerCase().includes('confirma?') ||
    finalMessage.toLowerCase().includes('sim/não') ||
    finalMessage.toLowerCase().includes('sim/nao')

  return { message: finalMessage, actions_executed: actionsExecuted, requires_confirmation: requiresConfirmation }
}

// ─── Transcrição de áudio ────────────────────────────────────────────────────

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const settings = await getSettings()

  // Tenta OpenAI Whisper primeiro (melhor qualidade para PT-BR)
  if (settings?.openai_key) {
    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: mimeType })
    formData.append('file', blob, 'audio.ogg')
    formData.append('model', 'whisper-1')
    formData.append('language', 'pt')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${settings.openai_key}` },
      body: formData,
    })

    if (res.ok) {
      const data = await res.json() as { text?: string }
      if (data.text) return data.text
    }
  }

  throw new Error('Transcrição de áudio requer chave OpenAI configurada em Configurações')
}

// ─── Briefing diário ─────────────────────────────────────────────────────────

export async function sendDailyBriefing(): Promise<void> {
  const settings = await getSettings()
  if (!settings?.whatsapp_url || !settings?.whatsapp_token) return

  const briefingMessage = `☀️ *Bom dia! Briefing do dia — ${new Date().toLocaleDateString('pt-BR')}*`

  const response = await processJarvisMessage(
    'Faça um briefing rápido de todos os clientes para eu começar o dia. Mostre quem precisa de atenção, quem está bem, e se há algum alerta urgente. Seja conciso.',
    { channel: 'platform' }
  )

  const wa = new WhatsAppService(settings.whatsapp_url, settings.whatsapp_token, settings.whatsapp_instance || 'default')
  const managerWhatsapp = settings.manager_whatsapp
  if (managerWhatsapp) {
    await wa.sendMessage(managerWhatsapp, briefingMessage + '\n\n' + response.message)
  }
}

// ─── Histórico para o frontend ───────────────────────────────────────────────

export async function getJarvisHistory(limit = 50) {
  const { data } = await supabase
    .from('jarvis_messages')
    .select('*')
    .eq('session_id', SESSION_ID)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data || []).reverse()
}

export async function getJarvisMemories() {
  const { data } = await supabase
    .from('jarvis_memory')
    .select('*')
    .order('updated_at', { ascending: false })

  return data || []
}

export async function getJarvisActionLog(limit = 50) {
  const { data } = await supabase
    .from('jarvis_action_log')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(limit)

  return data || []
}

export async function clearJarvisHistory(): Promise<void> {
  await supabase.from('jarvis_messages').delete().eq('session_id', SESSION_ID)
}
