import type { FastifyPluginAsync } from 'fastify'
import {
  processJarvisMessage,
  transcribeAudio,
  getJarvisHistory,
  getJarvisMemories,
  getJarvisActionLog,
  clearJarvisHistory,
} from '../services/jarvis.service'
import { supabase } from '../lib/supabase'
import { WhatsAppService } from '../services/whatsapp.service'

export const jarvisRoutes: FastifyPluginAsync = async (fastify) => {

  // ─── Chat: enviar mensagem de texto ────────────────────────────────────────
  fastify.post('/jarvis/message', async (req, reply) => {
    const { message, channel = 'platform' } = req.body as { message: string; channel?: 'platform' | 'whatsapp' }

    if (!message?.trim()) {
      return reply.status(400).send({ error: 'Mensagem não pode ser vazia' })
    }

    try {
      const response = await processJarvisMessage(message.trim(), { channel })
      return response
    } catch (err) {
      fastify.log.error('[Jarvis] Erro ao processar mensagem:', err)
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Erro interno',
      })
    }
  })

  // ─── Chat: transcrever e processar áudio ────────────────────────────────────
  fastify.post('/jarvis/audio', async (req, reply) => {
    const data = await req.file?.()
    if (!data) return reply.status(400).send({ error: 'Arquivo de áudio não recebido' })

    try {
      const buffer = await data.toBuffer()
      const mimeType = data.mimetype || 'audio/ogg'

      const transcription = await transcribeAudio(buffer, mimeType)
      fastify.log.info(`[Jarvis] Áudio transcrito: "${transcription}"`)

      const response = await processJarvisMessage(transcription, { was_audio: true, channel: 'platform' })
      return { ...response, transcription }
    } catch (err) {
      fastify.log.error('[Jarvis] Erro ao processar áudio:', err)
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Erro ao processar áudio',
      })
    }
  })

  // ─── Histórico de mensagens ────────────────────────────────────────────────
  fastify.get('/jarvis/history', async (req) => {
    const { limit = 50 } = req.query as { limit?: number }
    return getJarvisHistory(Number(limit))
  })

  // ─── Limpar histórico ──────────────────────────────────────────────────────
  fastify.delete('/jarvis/history', async () => {
    await clearJarvisHistory()
    return { cleared: true }
  })

  // ─── Memórias aprendidas ───────────────────────────────────────────────────
  fastify.get('/jarvis/memories', async () => {
    return getJarvisMemories()
  })

  // ─── Deletar memória específica ────────────────────────────────────────────
  fastify.delete('/jarvis/memories/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { error } = await supabase.from('jarvis_memory').delete().eq('id', id)
    if (error) return reply.status(500).send({ error: error.message })
    return { deleted: true }
  })

  // ─── Log de ações executadas ───────────────────────────────────────────────
  fastify.get('/jarvis/log', async (req) => {
    const { limit = 50 } = req.query as { limit?: number }
    return getJarvisActionLog(Number(limit))
  })

  // ─── Webhook WhatsApp: recebe mensagens do número do gestor ────────────────
  fastify.post('/jarvis/whatsapp/webhook', async (req, reply) => {
    const payload = req.body as Record<string, unknown>

    try {
      // Estrutura Evolution API
      const messageData = (payload.data as Record<string, unknown>) || payload
      const from = (messageData.key as Record<string, unknown>)?.remoteJid as string || ''
      const messageType = (messageData.message as Record<string, unknown>) ? Object.keys(messageData.message as object)[0] : ''

      // Verificar se é do número do gestor (configurado em settings)
      const { data: settings } = await supabase.from('settings').select('manager_whatsapp, whatsapp_url, whatsapp_token, whatsapp_instance').single()
      if (!settings?.manager_whatsapp) {
        fastify.log.warn('[Jarvis WhatsApp] manager_whatsapp não configurado')
        return { ok: true }
      }

      const managerNumber = settings.manager_whatsapp.replace(/\D/g, '')
      const fromNumber = from.replace('@s.whatsapp.net', '').replace(/\D/g, '')

      if (!fromNumber.includes(managerNumber) && !managerNumber.includes(fromNumber)) {
        // Mensagem não é do gestor — ignorar
        return { ok: true }
      }

      const wa = new WhatsAppService(settings.whatsapp_url, settings.whatsapp_token, settings.whatsapp_instance || 'default')

      let userMessage = ''
      let wasAudio = false

      // Mensagem de texto
      if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
        const msgObj = messageData.message as Record<string, unknown>
        userMessage = (msgObj.conversation as string) || (msgObj.extendedTextMessage as Record<string, unknown>)?.text as string || ''
      }

      // Mensagem de áudio (PTT ou audio)
      else if (messageType === 'audioMessage' || messageType === 'pttMessage') {
        try {
          // Download do áudio via Evolution API
          const msgId = (messageData.key as Record<string, unknown>)?.id as string
          const audioRes = await fetch(`${settings.whatsapp_url}/chat/getBase64FromMediaMessage/${settings.whatsapp_instance || 'default'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: settings.whatsapp_token },
            body: JSON.stringify({ message: { key: messageData.key } }),
          })

          if (audioRes.ok) {
            const audioData = await audioRes.json() as { base64?: string; mimetype?: string }
            if (audioData.base64) {
              const buffer = Buffer.from(audioData.base64, 'base64')
              userMessage = await transcribeAudio(buffer, audioData.mimetype || 'audio/ogg')
              wasAudio = true
              fastify.log.info(`[Jarvis WhatsApp] Áudio transcrito: "${userMessage}"`)
            }
          }
        } catch (err) {
          fastify.log.error('[Jarvis WhatsApp] Erro ao transcrever áudio:', err)
          await wa.sendMessage(from, '❌ Não consegui transcrever o áudio. Pode escrever a mensagem?')
          return { ok: true }
        }
      }

      if (!userMessage.trim()) return { ok: true }

      // Indicador de "digitando"
      await wa.sendMessage(from, '⏳ Processando...')

      const response = await processJarvisMessage(userMessage.trim(), { was_audio: wasAudio, channel: 'whatsapp' })

      await wa.sendMessage(from, response.message)

      return { ok: true }
    } catch (err) {
      fastify.log.error('[Jarvis WhatsApp] Erro:', err)
      return { ok: true } // Sempre retornar 200 para o WhatsApp não retentar
    }
  })

  // ─── Briefing manual (para testar) ────────────────────────────────────────
  fastify.post('/jarvis/briefing', async (req, reply) => {
    try {
      const response = await processJarvisMessage(
        'Faça um briefing completo de todos os clientes para eu começar o dia. Mostre quem precisa de atenção, quem está bem, alertas urgentes e oportunidades. Seja objetivo.',
        { channel: 'platform' }
      )
      return response
    } catch (err) {
      return reply.status(500).send({ error: err instanceof Error ? err.message : 'Erro' })
    }
  })

  // ─── Status da sessão ──────────────────────────────────────────────────────
  fastify.get('/jarvis/session', async () => {
    const { data: session } = await supabase
      .from('jarvis_sessions')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    const { count: messageCount } = await supabase
      .from('jarvis_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', '00000000-0000-0000-0000-000000000001')

    const { count: memoryCount } = await supabase
      .from('jarvis_memory')
      .select('*', { count: 'exact', head: true })

    return {
      session,
      message_count: messageCount || 0,
      memory_count: memoryCount || 0,
    }
  })
}
