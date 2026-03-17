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

    // 1. Nullify clients.user_id (no CASCADE on FK)
    const { error: e1 } = await supabase.from('clients').update({ user_id: null }).eq('user_id', id)
    if (e1) console.error('[delete user] nullify clients.user_id:', e1.message)

    // 2. Delete from auth (suppress errors — user may not exist in auth)
    const { error: authErr } = await supabase.auth.admin.deleteUser(id)
    if (authErr) console.error('[delete user] auth.admin.deleteUser:', authErr.message)

    // 3. Delete from public.users (no-op if cascade already removed it)
    const { error: e3 } = await supabase.from('users').delete().eq('id', id)
    if (e3) console.error('[delete user] public.users:', e3.message)

    return reply.status(204).send()
  })
}
