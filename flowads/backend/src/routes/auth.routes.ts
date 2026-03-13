import type { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return reply.status(401).send({ message: 'Credenciais inválidas' })

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    return { token: data.session?.access_token, user }
  })

  fastify.post('/auth/logout', async (req, reply) => {
    await supabase.auth.signOut()
    return reply.send({ ok: true })
  })

  fastify.get('/auth/me', async (req, reply) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return reply.status(401).send({ message: 'Não autorizado' })

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return reply.status(401).send({ message: 'Token inválido' })

    const { data: dbUser } = await supabase.from('users').select('*').eq('email', user.email).single()
    return dbUser || user
  })
}
