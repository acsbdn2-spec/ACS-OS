import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const profile = await requireProfile()
  if (!['owner', 'viewer'].includes(profile.role)) redirect('/catalog')

  const supabase = await createClient()
  const storeId = profile.store_id
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const [
    { count: openQuotes },
    { count: openJobs },
    { data: salesData },
    { data: lowStock },
    { data: renewalsDue },
    { data: emdParked },
    { data: tendersDue },
  ] = await Promise.all([
    supabase.from('quotes').select('*', { count: 'exact', head: true })
      .eq('store_id', storeId).eq('status', 'open'),
    supabase.from('job_cards').select('*', { count: 'exact', head: true })
      .eq('store_id', storeId).in('status', ['received','diagnosed','in_repair','testing','ready']),
    supabase.from('sales').select('total')
      .eq('store_id', storeId).gte('date', monthStart),
    supabase.from('products').select('id,name,stock_qty,low_stock_threshold')
      .eq('store_id', storeId).eq('archived', false)
      .filter('stock_qty', 'lte', 2).limit(5),
    supabase.from('renewals').select('id,item,customer_id,expiry,amount')
      .eq('store_id', storeId).eq('reminded', false)
      .lte('expiry', new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
      .order('expiry').limit(5),
    supabase.from('emd_records').select('amount')
      .eq('refunded', false),
    supabase.from('tenders').select('id,title,deadline')
      .eq('store_id', storeId).in('status', ['watching','preparing'])
      .lte('deadline', new Date(Date.now() + 7 * 86400000).toISOString())
      .order('deadline').limit(3),
  ])

  const monthRevenue = (salesData ?? []).reduce((s: number, r: any) => s + (r.total ?? 0), 0)
  const totalEmd = (emdParked ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0)

  return (
    <DashboardClient
      profile={profile}
      stats={{
        openQuotes: openQuotes ?? 0,
        openJobs: openJobs ?? 0,
        monthRevenue,
        lowStockCount: (lowStock ?? []).length,
        renewalsDue: renewalsDue ?? [],
        emdParked: totalEmd,
        tendersDue: tendersDue ?? [],
        lowStockItems: lowStock ?? [],
      }}
    />
  )
}
