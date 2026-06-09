import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewJobForm from '@/components/service/NewJobForm'

export const dynamic = 'force-dynamic'

export default async function NewJobPage() {
  const profile = await requireProfile()
  if (!['owner','staff','technician'].includes(profile.role)) redirect('/service')
  const supabase = await createClient()

  const [{ data: customers }, { data: technicians }] = await Promise.all([
    supabase.from('customers').select('id,name,phone').eq('store_id', profile.store_id).order('name'),
    supabase.from('profiles').select('id,name').eq('store_id', profile.store_id)
      .in('role', ['owner','staff','technician']).eq('is_active', true),
  ])

  return <NewJobForm profile={profile} customers={customers ?? []} technicians={technicians ?? []} />
}
