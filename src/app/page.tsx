import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'

// Root redirect — sends each role to their home screen
export default async function RootPage() {
  const profile = await requireProfile()

  switch (profile.role) {
    case 'owner':   redirect('/dashboard')
    case 'staff':   redirect('/catalog')
    case 'technician': redirect('/service')
    case 'viewer':  redirect('/dashboard')
    default:        redirect('/catalog')
  }
}
