import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QuoteBuilder from '@/components/quotes/QuoteBuilder'

export const dynamic = 'force-dynamic'

export default async function NewQuotePage() {
  const profile = await requireProfile()
  if (!['owner','staff'].includes(profile.role)) redirect('/quotes')

  const supabase = await createClient()

  const [{ data: products }, { data: customers }, { data: bundles }] = await Promise.all([
    supabase.from('products_public').select('id,name,cat,sell,gst_pct,stock,market_ref')
      .eq('store_id', profile.store_id).eq('archived', false).order('name'),
    supabase.from('customers').select('id,name,phone,rate_contract')
      .eq('store_id', profile.store_id).order('name'),
    supabase.from('quote_bundles').select('*').eq('store_id', profile.store_id),
  ])

  return (
    <QuoteBuilder
      profile={profile}
      products={products ?? []}
      customers={customers ?? []}
      bundles={bundles ?? []}
      existingQuote={null}
    />
  )
}
