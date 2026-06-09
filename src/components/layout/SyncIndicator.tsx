'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils'

interface SyncLog {
  id:            string
  status:        'running' | 'success' | 'error'
  completed_at:  string | null
  started_at:    string
  items_synced:  number
  serials_synced: number
  error_msg:     string | null
}

export default function SyncIndicator({ storeId }: { storeId: string }) {
  const [last,     setLast]     = useState<SyncLog | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [requested, setRequested] = useState(false)

  const fetchLast = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('sync_log')
      .select('id,status,completed_at,started_at,items_synced,serials_synced,error_msg')
      .eq('store_id', storeId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()
    if (data) setLast(data as SyncLog)
  }, [storeId])

  // Initial fetch
  useEffect(() => { fetchLast() }, [fetchLast])

  // Realtime: update whenever sync_log changes
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel('sync-log-watch')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'sync_log',
        filter: `store_id=eq.${storeId}`,
      }, () => fetchLast())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [storeId, fetchLast])

  async function triggerSync() {
    setLoading(true)
    setRequested(false)
    try {
      const res = await fetch('/api/sync/trigger', { method: 'POST' })
      if (res.ok) setRequested(true)
    } finally {
      setLoading(false)
      // Auto-clear the "requested" indicator after 10s
      setTimeout(() => setRequested(false), 10_000)
    }
  }

  const isRunning = last?.status === 'running'
  const isError   = last?.status === 'error'
  const timeStr   = last?.completed_at
    ? timeAgo(last.completed_at)
    : last?.started_at ? timeAgo(last.started_at) : null

  return (
    <div className="flex items-center gap-1.5">
      {/* Status dot + last sync time */}
      {last ? (
        <span className="hidden xs:flex items-center gap-1 text-[11px] text-[var(--fg-3)]">
          {isRunning ? (
            <RefreshCw size={10} className="animate-spin text-brand-400" />
          ) : isError ? (
            <AlertCircle size={10} className="text-red-400" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          )}
          {isRunning ? 'Syncing…' : timeStr ?? '—'}
        </span>
      ) : (
        <span className="hidden xs:flex items-center gap-1 text-[11px] text-[var(--fg-3)]">
          <WifiOff size={10} />
          No sync yet
        </span>
      )}

      {/* Sync Now button */}
      <button
        onClick={triggerSync}
        disabled={loading || isRunning}
        title={requested ? 'Request sent — agent will sync within 5s' : 'Sync now'}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors
          ${requested
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'text-[var(--fg-3)] hover:bg-[var(--c-card-alt)] hover:text-[var(--fg-1)]'}
          disabled:opacity-40`}
      >
        <RefreshCw size={14} className={loading || isRunning ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
