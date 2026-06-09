'use client'

import Link from 'next/link'
import { FileText, Plus, ChevronRight, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { inr, formatDate, cn } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface QuoteRow {
  id: string
  number: number
  status: string
  quote_type: string
  total: number | null
  created_at: string
  customers: { name: string; phone: string | null } | null
  profiles: { name: string } | null
}

export default function QuoteListClient({ quotes, profile }: { quotes: QuoteRow[]; profile: Profile }) {
  const canWrite = ['owner','staff'].includes(profile.role)

  const statusIcon = { open: Clock, win: CheckCircle2, lost: XCircle }
  const statusColor = { open: 'text-brand-400', win: 'text-green-400', lost: 'text-gray-500' }

  return (
    <div className="px-4 pt-3 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-100">Quotes</h1>
        {canWrite && (
          <Link href="/quotes/new" className="btn-primary py-2 px-4 text-sm">
            <Plus size={16} /> New
          </Link>
        )}
      </div>

      {/* Tab-style filter can go here in a future iteration */}

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-600">
          <FileText size={40} className="mb-3 opacity-30" />
          <p>No quotes yet</p>
          {canWrite && (
            <Link href="/quotes/new" className="btn-primary mt-4 text-sm">Create first quote</Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map(q => {
            const Icon = statusIcon[q.status as keyof typeof statusIcon] ?? Clock
            const color = statusColor[q.status as keyof typeof statusColor] ?? 'text-gray-400'
            return (
              <Link key={q.id} href={`/quotes/${q.id}`}
                className="card flex items-center gap-3 active:scale-[0.99] transition">
                <Icon size={22} className={cn(color, 'shrink-0')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-100">
                      #{q.number}
                    </span>
                    {q.quote_type === 'proforma' && (
                      <span className="badge-blue text-[10px]">PI</span>
                    )}
                    {q.customers && (
                      <span className="text-sm text-gray-300 truncate">{q.customers.name}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDate(q.created_at)}
                    {q.profiles && ` · ${q.profiles.name}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-100">{inr(q.total)}</p>
                  <p className={cn('text-xs capitalize', color)}>{q.status}</p>
                </div>
                <ChevronRight size={16} className="text-gray-600 shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
