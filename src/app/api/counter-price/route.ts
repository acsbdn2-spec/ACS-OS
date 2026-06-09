import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Server-side floor check — response NEVER contains floor/cost value
// Staff get only verdict + suggested price
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product_id, price } = await req.json()
  if (!product_id || price == null)
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Always read from base products table (floor is never in products_public)
  const { data: product } = await supabase
    .from('products')
    .select('floor, sell, name')
    .eq('id', product_id)
    .single()

  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const floor = product.floor ?? 0
  const inputPrice = Number(price)
  const below_floor = floor > 0 && inputPrice < floor

  if (below_floor) {
    return NextResponse.json({
      canMatch: false,
      below_floor: true,
      message: 'Below minimum — suggest bundle or service add-on',
      // NEVER return floor value to staff
    })
  }

  return NextResponse.json({
    canMatch: true,
    below_floor: false,
    suggestedPrice: inputPrice,
    message: `Can match at ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(inputPrice)}`,
  })
}
