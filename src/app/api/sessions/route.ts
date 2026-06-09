import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sessions — owner: list all active sessions
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  // Use service role to list sessions
  const service = createServiceClient()
  const { data, error } = await service.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json(data.users.map((u: any) => ({
    id: u.id, email: u.email,
    last_sign_in: u.last_sign_in_at,
    created: u.created_at,
  })))
}

// DELETE /api/sessions/:userId — owner force-logout any user
export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const targetUserId = url.searchParams.get('userId')
  if (!targetUserId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const service = createServiceClient()
  const { error } = await service.auth.admin.signOut(targetUserId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
