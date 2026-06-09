import { NextResponse } from 'next/server'
import { requireProfile } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const profile = await requireProfile()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('sync_requests')
    .insert({
      store_id:     profile.store_id,
      requested_by: profile.name,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, request_id: data.id })
}
