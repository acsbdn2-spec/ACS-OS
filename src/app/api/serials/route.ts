import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('id,role,store_id').eq('user_id', user.id).single()
  if (!profile || !['owner','staff'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { product_id, serial_no, purchase_date, warranty_months } = body
  if (!product_id || !serial_no)
    return NextResponse.json({ error: 'product_id and serial_no required' }, { status: 400 })

  const { data, error } = await supabase.from('serials').insert({
    product_id, serial_no: serial_no.trim(),
    purchase_date: purchase_date || null,
    warranty_months: warranty_months ?? 12,
    status: 'available',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('activity_log').insert({
    user_id: profile.id, store_id: profile.store_id,
    action: 'create', entity: 'serials', entity_id: data.id,
    detail: { serial_no, product_id },
  })

  return NextResponse.json(data, { status: 201 })
}
