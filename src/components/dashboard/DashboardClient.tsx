'use client'

import { inr, formatDate } from '@/lib/utils'
import {
  FileText, Wrench, Package, RefreshCw,
  Clock, AlertTriangle, ChevronRight, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import type { Profile } from '@/types/database'

interface Stats {
  openQuotes:    number
  openJobs:      number
  monthRevenue:  number
  lowStockCount: number
  renewalsDue:   { id: string; item: string; expiry: string; amount: number | null }[]
  emdParked:     number
  tendersDue:    { id: string; title: string; deadline: string }[]
  lowStockItems: { id: string; name: string; stock_qty: number }[]
}

interface StatTileProps {
  icon:    React.ElementType
  label:   string
  value:   string | number
  sub?:    string
  href?:   string
  accent?: 'indigo' | 'green' | 'amber' | 'red'
}

function StatTile({ icon: Icon, label, value, sub, href, accent = 'indigo' }: StatTileProps) {
  const accents = {
    indigo: { icon: 'text-indigo-500',  bg: 'bg-indigo-50  dark:bg-indigo-950/30' },
    green:  { icon: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    amber:  { icon: 'text-amber-500',   bg: 'bg-amber-50   dark:bg-amber-950/30'  },
    red:    { icon: 'text-red-500',     bg: 'bg-red-50     dark:bg-red-950/30'    },
  }
  const a = accents[accent]

  const inner = (
    <div className="card flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${a.bg}`}>
        <Icon size={18} className={a.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-100 leading-none">{value}</p>
        {sub && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{sub}</p>}
      </div>
      {href && <ChevronRight size={14} className="text-gray-500 shrink-0" />}
    </div>
  )
  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

export default function DashboardClient({ profile, stats }: { profile: Profile; stats: Stats }) {
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 pt-5 pb-2 max-w-2xl mx-auto space-y-5">

      {/* Greeting */}
      <div>
        <p className="text-sm text-gray-500">{greeting}</p>
        <h1 className="text-2xl font-bold text-gray-100 leading-snug">
          {profile.name || 'Owner'}
        </h1>
      </div>

      {/* Revenue card */}
      <div className="brand-gradient rounded-xl p-5 shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-indigo-200 mb-1">Revenue this month</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              {inr(stats.monthRevenue)}
            </p>
            {stats.emdParked > 0 && (
              <p className="text-xs text-indigo-200 mt-1.5">
                EMD parked: {inr(stats.emdParked)}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
            <TrendingUp size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={FileText}  label="Open Quotes"  value={stats.openQuotes}
          href="/quotes" accent="indigo" />
        <StatTile icon={Wrench}    label="Open Jobs"    value={stats.openJobs}
          href="/service" accent="green" />
        <StatTile icon={Package}   label="Low Stock"    value={stats.lowStockCount}
          href="/catalog" accent={stats.lowStockCount > 0 ? 'amber' : 'indigo'} />
        <StatTile icon={RefreshCw} label="Renewals Due" value={stats.renewalsDue.length}
          href="/customers" accent={stats.renewalsDue.length > 0 ? 'amber' : 'indigo'} />
      </div>

      {/* Tenders closing soon */}
      {stats.tendersDue.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
              <Clock size={13} className="text-red-400" /> Tenders closing
            </h2>
            <Link href="/tenders" className="text-xs text-brand-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {stats.tendersDue.map(t => {
              const d = Math.ceil((new Date(t.deadline).getTime() - Date.now()) / 86400000)
              return (
                <Link key={t.id} href="/tenders"
                  className="card flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-200 truncate flex-1">{t.title}</p>
                  <span className={`text-xs font-semibold shrink-0 tabular-nums
                    ${d <= 1 ? 'text-red-400' : 'text-amber-400'}`}>
                    {d}d
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Renewals */}
      {stats.renewalsDue.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} className="text-amber-400" /> Renewals ≤30 days
          </h2>
          <div className="space-y-2">
            {stats.renewalsDue.map(r => (
              <div key={r.id} className="card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{r.item}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Due {formatDate(r.expiry)}</p>
                </div>
                {r.amount != null && (
                  <span className="text-sm font-semibold text-gray-100 shrink-0 tabular-nums">
                    {inr(r.amount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Low stock */}
      {stats.lowStockItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-1.5 mb-2">
            <Package size={13} className="text-amber-400" /> Low stock items
          </h2>
          <div className="divide-y divide-[var(--c-border)] rounded-xl overflow-hidden
            border border-[var(--c-border)] bg-[var(--c-card)]">
            {stats.lowStockItems.map(p => (
              <Link key={p.id} href={`/catalog/${p.id}`}
                className="flex items-center justify-between px-4 py-2.5
                  hover:bg-[var(--c-card-alt)] transition-colors">
                <p className="text-sm text-gray-200 truncate flex-1">{p.name}</p>
                <span className={`text-xs font-semibold ml-3 shrink-0 tabular-nums
                  ${p.stock_qty === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  {p.stock_qty === 0 ? 'Out of stock' : `${p.stock_qty} left`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 pb-2">
        <Link href="/quotes/new"
          className="btn-primary justify-center py-3 rounded-xl text-sm">
          <FileText size={15} /> New Quote
        </Link>
        <Link href="/service/new"
          className="btn-secondary justify-center py-3 rounded-xl text-sm">
          <Wrench size={15} /> New Job
        </Link>
      </div>

    </div>
  )
}
