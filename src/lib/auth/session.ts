import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Profile } from '@/types/database'

// Demo profile — used when acs-demo cookie is set
async function getDemoProfile(): Promise<Profile | null> {
  const cookieStore = await cookies()
  const role = cookieStore.get('acs-demo')?.value
  if (!role) return null
  return {
    id: 'demo-profile-id',
    created_at: new Date().toISOString(),
    user_id: 'demo-user-id',
    role: role as Profile['role'],
    store_id: '11111111-1111-1111-1111-111111111111',
    name: 'Demo Owner',
    lang: 'en',
    phone: null,
    is_active: true,
  }
}

export async function requireAuth() {
  const demo = await getDemoProfile()
  if (demo) return { id: demo.user_id } as any

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function getProfile(): Promise<Profile | null> {
  const demo = await getDemoProfile()
  if (demo) return demo

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data ?? null
}

export async function requireProfile() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}

export function isOwner(profile: Profile) { return profile.role === 'owner' }
export function canWrite(profile: Profile) { return profile.role === 'owner' || profile.role === 'staff' || profile.role === 'technician' }
export function seesFinancials(profile: Profile) { return profile.role === 'owner' }
