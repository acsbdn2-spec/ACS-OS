import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeName } from '@/lib/fuzzy'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role,store_id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const table = profile.role === 'owner' ? 'products' : 'products_public'
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Serials
  const { data: serials } = await supabase
    .from('serials').select('*').eq('product_id', id).order('status')

  // Compat
  const { data: compat } = await supabase
    .from('product_compat')
    .select('compatible_product_id, products_public!compatible_product_id(id,name,sell)')
    .eq('product_id', id)

  return NextResponse.json({ product: data, serials: serials ?? [], compat: compat ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role,store_id,id').eq('user_id', user.id).single()
  if (!profile || !['owner', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Strip cost/floor for staff
  if (profile.role !== 'owner') {
    delete body.cost; delete body.floor; delete body.tender_floor
  }

  if (body.name) body.norm_name = normalizeName(body.name)

  const { data, error } = await supabase
    .from('products').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    user_id: profile.id, store_id: profile.store_id,
    action: 'update', entity: 'products', entity_id: id,
    detail: { fields: Object.keys(body) },
  })

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role,store_id,id').eq('user_id', user.id).single()
  if (profile?.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  // Soft delete
  const { error } = await supabase.from('products').update({ archived: true }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    user_id: profile.id, store_id: profile.store_id,
    action: 'archive', entity: 'products', entity_id: id, detail: {},
  })

  return NextResponse.json({ ok: true })
}
