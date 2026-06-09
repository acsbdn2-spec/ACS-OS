import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import QuoteListClient from '@/components/quotes/QuoteListClient'

export const dynamic = 'force-dynamic'

export default async function QuotesPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: quotes } = await supabase
    .from('quotes')
    .select(`*, customers(name,phone), profiles!by_user(name)`)
    .eq('store_id', profile.store_id)
    .order('created_at', { ascending: false })
    .limit(60)

  return <QuoteListClient quotes={quotes ?? []} profile={profile} />
}
