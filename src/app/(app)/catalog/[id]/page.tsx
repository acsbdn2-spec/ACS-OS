import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetail from '@/components/catalog/ProductDetail'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  const supabase = await createClient()
  const isOwner = profile.role === 'owner'

  const { data: product } = isOwner
    ? await supabase.from('products').select('*').eq('id', id).single()
    : await supabase.from('products_public').select('*').eq('id', id).single()

  if (!product) notFound()

  const [{ data: serials }, { data: compat }] = await Promise.all([
    supabase.from('serials').select('*').eq('product_id', id).order('status').order('created_at', { ascending: false }),
    supabase.from('product_compat')
      .select('compatible_product_id')
      .eq('product_id', id),
  ])

  return (
    <ProductDetail
      product={product}
      serials={serials ?? []}
      profile={profile}
    />
  )
}
