import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ServiceBoard from '@/components/service/ServiceBoard'

export const dynamic = 'force-dynamic'

export default async function ServicePage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const istech = profile.role === 'technician'

  let query = supabase
    .from('job_cards')
    .select('*, customers(name,phone), profiles!assigned_to(name)')
    .eq('store_id', profile.store_id)
    .not('status', 'in', '("delivered","cancelled")')
    .order('created_at', { ascending: true })

  if (istech) {
    query = query.eq('assigned_to', profile.id) as typeof query
  }

  const { data: jobs } = await query
  const { data: done } = await supabase
    .from('job_cards')
    .select('*, customers(name,phone), profiles!assigned_to(name)')
    .eq('store_id', profile.store_id)
    .in('status', ['delivered','cancelled'])
    .order('delivered_at', { ascending: false })
    .limit(10)

  return <ServiceBoard jobs={jobs ?? []} doneJobs={done ?? []} profile={profile} />
}
