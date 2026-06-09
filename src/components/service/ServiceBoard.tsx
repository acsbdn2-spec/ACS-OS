'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Wrench, Clock, ChevronRight, AlertTriangle } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { differenceInDays } from 'date-fns'
import type { Profile } from '@/types/database'

interface JobRow {
  id: string; number: number; status: string
  device_desc: string; complaint: string
  created_at: string; ready_at: string | null; sla_days: number
  is_warranty_claim: boolean; is_outside: boolean
  customers: { name: string; phone: string | null } | null
  profiles: { name: string } | null
}

const STATUS_ORDER = ['received','diagnosed','estimate_sent','approved','in_repair','testing','ready']
const STATUS_LABEL: Record<string, string> = {
  received: 'Received', diagnosed: 'Diagnosed', estimate_sent: 'Estimate Sent',
  approved: 'Approved', in_repair: 'In Repair', testing: 'Testing', ready: 'Ready ✓',
}
const STATUS_COLOR: Record<string, string> = {
  received: 'bg-gray-700', diagnosed: 'bg-blue-900/50', estimate_sent: 'bg-amber-900/50',
  approved: 'bg-brand-900/50', in_repair: 'bg-purple-900/50',
  testing: 'bg-cyan-900/50', ready: 'bg-green-900/50',
}

export default function ServiceBoard({ jobs, doneJobs, profile }: {
  jobs: JobRow[]; doneJobs: JobRow[]; profile: Profile
}) {
  const [view, setView] = useState<'board'|'list'>('board')
  const [showDone, setShowDone] = useState(false)
  const canWrite = ['owner','staff','technician'].includes(profile.role)

  function ageDays(job: JobRow) {
    return differenceInDays(new Date(), new Date(job.created_at))
  }
  function isSlaBreached(job: JobRow) {
    return ageDays(job) > job.sla_days
  }

  const grouped: Record<string, JobRow[]> = {}
  for (const s of STATUS_ORDER) grouped[s] = jobs.filter(j => j.status === s)

  return (
    <div className="px-4 pt-3 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Service</h1>
          <p className="text-xs text-gray-500">{jobs.length} open job{jobs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(v => v === 'board' ? 'list' : 'board')}
            className="btn-secondary py-1.5 px-3 text-xs">
            {view === 'board' ? 'List' : 'Board'}
          </button>
          {canWrite && (
            <Link href="/service/new" className="btn-primary py-2 px-3 text-sm">
              <Plus size={16} /> New Job
            </Link>
          )}
        </div>
      </div>

      {/* SLA alerts */}
      {jobs.filter(isSlaBreached).length > 0 && (
        <div className="mb-3 flex items-center gap-2 bg-red-900/20 border border-red-800/30 rounded-xl p-3 text-red-400 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          {jobs.filter(isSlaBreached).length} job(s) overdue SLA
        </div>
      )}

      {/* Board view */}
      {view === 'board' ? (
        <div className="space-y-4">
          {STATUS_ORDER.filter(s => grouped[s].length > 0).map(status => (
            <div key={status}>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2 ${STATUS_COLOR[status]} text-gray-200`}>
                {STATUS_LABEL[status]} ({grouped[status].length})
              </div>
              <div className="space-y-2">
                {grouped[status].map(job => (
                  <JobCard key={job.id} job={job} ageDays={ageDays(job)} slaBreached={isSlaBreached(job)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} ageDays={ageDays(job)} slaBreached={isSlaBreached(job)} showStatus />
          ))}
        </div>
      )}

      {/* Done jobs */}
      {doneJobs.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowDone(s => !s)}
            className="text-sm text-gray-500 hover:text-gray-300 flex items-center gap-1">
            {showDone ? '▾' : '▸'} Recently completed ({doneJobs.length})
          </button>
          {showDone && (
            <div className="mt-2 space-y-2 opacity-60">
              {doneJobs.map(job => <JobCard key={job.id} job={job} ageDays={0} slaBreached={false} showStatus />)}
            </div>
          )}
        </div>
      )}

      {jobs.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <p>No open jobs</p>
          {canWrite && (
            <Link href="/service/new" className="btn-primary mt-4 text-sm">Create first job card</Link>
          )}
        </div>
      )}
    </div>
  )
}

function JobCard({ job, ageDays, slaBreached, showStatus }: {
  job: JobRow; ageDays: number; slaBreached: boolean; showStatus?: boolean
}) {
  return (
    <Link href={`/service/${job.id}`}
      className={cn('card flex items-start gap-3 active:scale-[0.99] transition',
        slaBreached ? 'border-red-800/50' : '')}>
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold',
        slaBreached ? 'bg-red-900/50 text-red-300' : 'bg-surface-600 text-gray-400')}>
        #{job.number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-gray-100 truncate">{job.device_desc}</p>
          {job.is_warranty_claim && <span className="badge-green text-[9px]">Warranty</span>}
          {job.is_outside && <span className="badge-amber text-[9px]">Outside</span>}
        </div>
        <p className="text-xs text-gray-500 truncate">{job.customers?.name ?? 'Unknown'}</p>
        <p className="text-xs text-gray-600 truncate">{job.complaint}</p>
        {showStatus && (
          <p className="text-[10px] text-brand-400 mt-0.5 capitalize">{job.status.replace('_',' ')}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-xs font-medium', slaBreached ? 'text-red-400' : 'text-gray-500')}>
          {ageDays}d
        </p>
        {job.profiles && (
          <p className="text-[10px] text-gray-600">{job.profiles.name}</p>
        )}
        <ChevronRight size={14} className="text-gray-600 mt-1 ml-auto" />
      </div>
    </Link>
  )
}
