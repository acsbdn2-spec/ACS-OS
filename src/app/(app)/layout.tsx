import { requireProfile } from '@/lib/auth/session'
import BottomNav from '@/components/layout/BottomNav'
import StoreHeader from '@/components/layout/StoreHeader'
import OnlinePresence from '@/components/layout/OnlinePresence'
import OfflineBanner from '@/components/layout/OfflineBanner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()

  return (
    <div className="flex flex-col min-h-screen bg-surface-900">
      <OfflineBanner />
      <StoreHeader profile={profile} />
      <main className="flex-1 overflow-y-auto pb-nav scroll-touch">
        {children}
      </main>
      <BottomNav role={profile.role} />
      <OnlinePresence userId={profile.id} />
    </div>
  )
}
