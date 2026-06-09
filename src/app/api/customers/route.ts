import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('role,store_id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')
  let query = supabase.from('customers').select('id,name,phone,email,gstin,rate_contract')
    .eq('store_id', profile.store_id).order('name').limit(50)
  if (q) query = query.ilike('name', `%${q}%`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles').select('id,role,store_id').eq('user_id', user.id).single()
  if (!profile || !['owner','staff'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, phone, email, gstin, address, note } = body
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase.from('customers').insert({
    store_id: profile.store_id, name, phone: phone || null,
    email: email || null, gstin: gstin || null,
    address: address || null, note: note || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('activity_log').insert({
    user_id: profile.id, store_id: profile.store_id,
    action: 'create', entity: 'customers', entity_id: data.id,
    detail: { name },
  })
  return NextResponse.json(data, { status: 201 })
}
