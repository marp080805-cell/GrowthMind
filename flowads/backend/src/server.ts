import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { authRoutes } from './routes/auth.routes'
import { clientsRoutes } from './routes/clients.routes'
import { automationsRoutes } from './routes/automations.routes'
import { presetsRoutes } from './routes/presets.routes'
import { usersRoutes } from './routes/users.routes'
import { settingsRoutes, dashboardRoutes } from './routes/settings.routes'
import { webhooksRoutes } from './routes/webhooks.routes'
import { jarvisRoutes } from './routes/jarvis.routes'
import { initQueue, loadScheduledAutomations } from './jobs/scheduler'

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

  // Health check
  fastify.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }))

  // Initialize job queue
  try {
    initQueue()
    await loadScheduledAutomations()
    fastify.log.info('BullMQ scheduler initialized')
  } catch (err) {
    fastify.log.warn('BullMQ initialization failed (Redis may not be available):', err)
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
