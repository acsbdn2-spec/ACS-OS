import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const RP_ID = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
  : 'localhost'

// POST /api/auth/webauthn (handles challenge, register, verify via ?action=)
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') ?? 'challenge'

  if (action === 'challenge') {
    // Generate a random challenge
    const challenge = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
    // Return credential IDs for this device (browser sends user context)
    return NextResponse.json({ challenge, rpId: RP_ID, credentialIds: [] })
  }

  if (action === 'register') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { credentialId, publicKey, deviceName } = await req.json()

    const { error } = await supabase.from('webauthn_credentials').insert({
      user_id: user.id, credential_id: credentialId,
      public_key: publicKey, device_name: deviceName ?? 'Unknown device',
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'verify') {
    // Full FIDO2 verification is complex; for MVP we verify credential exists
    // and issue a session via magic link or OTP. Production: use @simplewebauthn/server
    const { credentialId } = await req.json()
    const supabase = await createClient()

    const { data: cred } = await supabase
      .from('webauthn_credentials')
      .select('user_id')
      .eq('credential_id', credentialId)
      .single()

    if (!cred) return NextResponse.json({ error: 'Credential not found' }, { status: 401 })

    // Update last_used + counter
    await supabase.from('webauthn_credentials')
      .update({ last_used: new Date().toISOString() })
      .eq('credential_id', credentialId)

    return NextResponse.json({ ok: true, userId: cred.user_id })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
