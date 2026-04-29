import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { authRoutes } from './routes/auth.routes'
import { clientsRoutes } from './routes/clients.routes'
import { automationsRoutes } from './routes/automations.routes'
import { presetsRoutes } from './routes/presets.routes'
import { usersRoutes } from './routes/users.routes'
import { settingsRoutes, dashboardRoutes } from './routes/settings.routes'
import { ticktickRoutes } from './routes/ticktick.routes'
import { webhooksRoutes } from './routes/webhooks.routes'
import { jarvisRoutes } from './routes/jarvis.routes'
import { initQueue, initCronDispatcher } from './jobs/scheduler'
import { initAdActivationWorker } from './jobs/ad-activation'
import { startHealthMonitor } from './jobs/account-health-monitor'
import { initializeQueueWorkers, createAccountWorker } from './jobs/queue-worker'
import { queueManager } from './jobs/account-queue-manager'
import { supabase } from './lib/supabase'

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
  },
})

async function start() {
  // Register plugins
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  await fastify.register(cookie)

  // Global error handler
  fastify.setErrorHandler((error: Error & { statusCode?: number }, req, reply) => {
    fastify.log.error(error)
    const statusCode = error.statusCode || 500
    reply.status(statusCode).send({
      message: error.message || 'Erro interno do servidor',
      statusCode,
    })
  })

  // Register routes
  await fastify.register(authRoutes)
  await fastify.register(clientsRoutes)
  await fastify.register(automationsRoutes)
  await fastify.register(presetsRoutes)
  await fastify.register(usersRoutes)
  await fastify.register(settingsRoutes)
  await fastify.register(dashboardRoutes)
  await fastify.register(webhooksRoutes)
  await fastify.register(jarvisRoutes)
  await fastify.register(ticktickRoutes)

  // Health check
  fastify.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }))

  // Initialize job queues
  try {
    initQueue()
    initAdActivationWorker()
    await initCronDispatcher()
    fastify.log.info('CronDispatcher iniciado')

    // Initialize Meta account protection system
    startHealthMonitor()
    fastify.log.info('Health Monitor iniciado')

    // Registrar factory para criação dinâmica de workers (novos accounts após startup)
    queueManager.setWorkerFactory(createAccountWorker)

    const accountWorkers = await initializeQueueWorkers()
    fastify.log.info(`Queue Workers inicializados (${accountWorkers.size} accounts)`)
  } catch (err) {
    fastify.log.warn('Job queue initialization failed (Redis may not be available):', err)
  }

  // Cleanup: marcar execuções orphanadas (rodando há > 30min) como erro
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('execution_logs')
      .update({ status: 'error', finished_at: new Date().toISOString(), error_message: 'Execução interrompida por reinicialização do servidor' })
      .eq('status', 'running')
      .lt('started_at', cutoff)
    fastify.log.info(`Cleanup: ${count ?? 0} execuções orphanadas marcadas como erro`)
  } catch (err) {
    fastify.log.warn('Cleanup de execuções orphanadas falhou:', err)
  }

  // Start server
  const port = parseInt(process.env.PORT || '4000')
  const host = process.env.HOST || '0.0.0.0'

  await fastify.listen({ port, host })
  fastify.log.info(`AdMind Backend running on http://${host}:${port}`)
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
