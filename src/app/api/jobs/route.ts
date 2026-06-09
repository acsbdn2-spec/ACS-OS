import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomToken } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('id,role,store_id').eq('user_id', user.id).single()
  if (!profile || !['owner','staff','technician'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    store_id, customer_id, device_desc, complaint, condition_in,
    accessories, assigned_to, is_warranty_claim, is_outside,
    outside_vendor, sla_days,
  } = body

  const { data: numData } = await supabase.rpc('allocate_number', {
    p_store_id: store_id ?? profile.store_id,
    p_kind: 'job',
  })

  const token = randomToken()
  const tokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

  const { data: job, error } = await supabase.from('job_cards').insert({
    store_id: store_id ?? profile.store_id,
    number: numData,
    customer_id,
    device_desc,
    complaint,
    condition_in: condition_in || null,
    accessories: accessories?.length ? accessories : null,
    assigned_to: assigned_to || null,
    is_warranty_claim: !!is_warranty_claim,
    is_outside: !!is_outside,
    outside_vendor: outside_vendor || null,
    sla_days: sla_days ?? 5,
    status: 'received',
    public_token: token,
    token_expires_at: tokenExpiry,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Initial status log
  await supabase.from('job_status_log').insert({
    job_card_id: job.id, status: 'received',
    by_user: profile.id, note: 'Job created',
  })

  await supabase.from('activity_log').insert({
    user_id: profile.id, store_id: store_id ?? profile.store_id,
    action: 'create', entity: 'job_cards', entity_id: job.id,
    detail: { number: numData, device: device_desc, customer_id },
  })

  return NextResponse.json(job, { status: 201 })
}
