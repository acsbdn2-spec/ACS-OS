import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/stock — reserve or unreserve stock
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role,store_id,id').eq('user_id', user.id).single()
  if (!profile || !['owner', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { product_id, qty, action, ref_id } = await req.json()
  if (!['reserve', 'unreserve'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  // Get current stock
  const { data: product } = await supabase
    .from('products')
    .select('stock_qty, reserved_qty')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const available = product.stock_qty - product.reserved_qty
  if (action === 'reserve' && available < qty) {
    return NextResponse.json({ error: 'Insufficient available stock' }, { status: 409 })
  }

  const delta = action === 'reserve' ? qty : -qty
  const { error } = await supabase
    .from('products')
    .update({ reserved_qty: product.reserved_qty + delta })
    .eq('id', product_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('stock_moves').insert({
    product_id, store_id: profile.store_id,
    qty: action === 'reserve' ? qty : -qty,
    type: action, ref_table: 'quotes', ref_id,
  })

  return NextResponse.json({ ok: true })
}
