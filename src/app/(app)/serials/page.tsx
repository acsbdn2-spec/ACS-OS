import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import SerialsClient from '@/components/serials/SerialsClient'

export const dynamic = 'force-dynamic'

export default async function SerialsPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: serials } = await supabase
    .from('serials')
    .select(`
      *,
      products!product_id (id, name, cat)
    `)
    .eq('products.store_id', profile.store_id)
    .order('status')
    .order('created_at', { ascending: false })
    .limit(200)

  return <SerialsClient serials={serials ?? []} profile={profile} />
}
