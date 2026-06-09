import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import CustomersClient from '@/components/customers/CustomersClient'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('customers')
    .select('id,name,phone,email,created_at')
    .eq('store_id', profile.store_id)
    .order('name')
    .limit(100)

  return <CustomersClient customers={customers ?? []} profile={profile} />
}
