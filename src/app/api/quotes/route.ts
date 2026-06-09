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
  const { store_id, customer_id, lines, quote_type, draft } = body

  // Auto-save draft path
  if (draft) {
    return NextResponse.json({ ok: true })
  }

  if (!lines?.length) return NextResponse.json({ error: 'No lines' }, { status: 400 })

  // Server-side floor validation for every line
  if (profile.role !== 'owner') {
    for (const line of lines) {
      const { data: prod } = await supabase
        .from('products').select('floor').eq('id', line.product_id).single()
      if (prod?.floor && line.unit_price < prod.floor) {
        return NextResponse.json({ error: 'One or more lines are below minimum price' }, { status: 422 })
      }
    }
  }

  // Allocate quote number transactionally
  const { data: numData } = await supabase.rpc('allocate_number', {
    p_store_id: store_id ?? profile.store_id,
    p_kind: quote_type === 'proforma' ? 'proforma' : 'quote',
  })

  const total = lines.reduce((s: number, l: { qty: number; unit_price: number; gst_pct: number }) =>
    s + l.qty * l.unit_price * (1 + l.gst_pct / 100), 0)

  const { data: quote, error } = await supabase.from('quotes').insert({
    store_id: store_id ?? profile.store_id,
    number: numData,
    customer_id: customer_id || null,
    by_user: profile.id,
    status: 'open',
    total,
    quote_type: quote_type ?? 'quote',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert lines
  const lineRows = lines.map((l: { product_id: string; qty: number; unit_price: number; gst_pct: number }) => ({
    quote_id: quote.id,
    product_id: l.product_id,
    qty: l.qty,
    unit_price: l.unit_price,
    gst_pct: l.gst_pct,
  }))
  await supabase.from('quote_lines').insert(lineRows)

  await supabase.from('activity_log').insert({
    user_id: profile.id, store_id: store_id ?? profile.store_id,
    action: 'create', entity: 'quotes', entity_id: quote.id,
    detail: { number: numData, total, lines: lines.length },
  })

  return NextResponse.json(quote, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role,store_id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const { data, error } = await supabase
    .from('quotes')
    .select('*, customers(name,phone), profiles!by_user(name)')
    .eq('store_id', profile.store_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
