import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import CatalogClient from '@/components/catalog/CatalogClient'

export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  // Owner gets full table, staff/viewer get safe view
  const isOwner = profile.role === 'owner'
  const { data: products } = isOwner
    ? await supabase
        .from('products')
        .select('*')
        .eq('store_id', profile.store_id)
        .eq('archived', false)
        .order('cat')
        .order('name')
    : await supabase
        .from('products_public')
        .select('*')
        .eq('store_id', profile.store_id)
        .eq('archived', false)
        .order('name')

  // Last sync time
  const { data: lastSync } = await supabase
    .from('products')
    .select('last_synced')
    .eq('store_id', profile.store_id)
    .not('last_synced', 'is', null)
    .order('last_synced', { ascending: false })
    .limit(1)
    .single()

  return (
    <CatalogClient
      products={products ?? []}
      profile={profile}
      lastSynced={lastSync?.last_synced ?? null}
    />
  )
}
