import type { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  })

  fastify.post('/users', async (req) => {
    const { name, email, role, password } = req.body as { name: string; email: string; role: string; password: string }

    // Create auth user via Supabase Admin (with password, confirmed immediately)
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (authError) throw new Error(authError.message)

    // Create profile in users table
    const { data, error } = await supabase
      .from('users')
      .insert({ id: authUser.user.id, email, name, role })
      .select()
      .single()

    if (error) throw error
    return data
  })

  fastify.put('/users/:id', async (req) => {
    const { id } = req.params as { id: string }
    const body = req.body as Record<string, unknown>
    const { data, error } = await supabase.from('users').update(body).eq('id', id).select().single()
    if (error) throw error
    return data
  })

  fastify.delete('/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    // Nullify user_id on clients referencing this user (no CASCADE on FK)
    await supabase.from('clients').update({ user_id: null }).eq('user_id', id)
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw error
    await supabase.auth.admin.deleteUser(id)
    return reply.status(204).send()
  })
}
