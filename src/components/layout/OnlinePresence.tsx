'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OnlineUser { id: string; name: string }

export default function OnlinePresence({ userId }: { userId: string }) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('online-presence', {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string }>()
        const users = Object.entries(state)
          .flatMap(([key, presences]) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (presences as any[]).map((p) => ({ id: key, name: (p.name as string) ?? '' }))
          )
          .filter(u => u.id !== userId)
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ name: 'User', online_at: new Date().toISOString() })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  if (onlineUsers.length === 0) return null

  return (
    <div className="fixed bottom-20 right-3 flex flex-col gap-1 z-30 pointer-events-none">
      {onlineUsers.slice(0, 3).map(u => (
        <div
          key={u.id}
          className="flex items-center gap-1.5 bg-surface-700/90 backdrop-blur
            border border-surface-500 rounded-full px-2.5 py-1 text-xs text-gray-300 shadow"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          {u.name || 'Colleague'}
        </div>
      ))}
    </div>
  )
}
