import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeName } from '@/lib/fuzzy'
import { z } from 'zod'

const createSchema = z.object({
  store_id:    z.string().uuid(),
  name:        z.string().min(2),
  cat:         z.string().optional(),
  sell:        z.coerce.number().min(0),
  cost:        z.coerce.number().min(0).optional(),
  floor:       z.coerce.number().min(0).optional(),
  tender_floor:z.coerce.number().min(0).optional(),
  gst_pct:     z.coerce.number().default(18),
  stock_qty:   z.coerce.number().default(0),
  low_stock_threshold: z.coerce.number().default(2),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check role — staff cannot set cost/floor
  const { data: profile } = await supabase
    .from('profiles').select('id,role,store_id').eq('user_id', user.id).single()
  if (!profile || !['owner', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const data = parsed.data
  // Staff cannot set cost/floor — strip them
  if (profile.role !== 'owner') {
    delete (data as Partial<typeof data>).cost
    delete (data as Partial<typeof data>).floor
    delete (data as Partial<typeof data>).tender_floor
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert({ ...data, norm_name: normalizeName(data.name) })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log activity
  await supabase.from('activity_log').insert({
    user_id: profile.id,
    store_id: data.store_id,
    action: 'create', entity: 'products', entity_id: product.id,
    detail: { name: data.name },
  })

  return NextResponse.json(product, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role,store_id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  const table = profile.role === 'owner' ? 'products' : 'products_public'

  let query = supabase.from(table).select('*')
    .eq('store_id', profile.store_id)
    .eq('archived', false)

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data, error } = await query.order('name').limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
