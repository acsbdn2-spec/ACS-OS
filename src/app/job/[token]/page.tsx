import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDateTime, inr } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const STATUS_STEPS = [
  'received','diagnosed','estimate_sent','approved','in_repair','testing','ready','delivered'
]
const STATUS_LABEL: Record<string,string> = {
  received:'Received', diagnosed:'Diagnosed', estimate_sent:'Estimate Sent',
  approved:'Approved', in_repair:'In Repair', testing:'Testing & QC',
  ready:'Ready for Pickup ✓', delivered:'Delivered', cancelled:'Cancelled',
}

export default async function PublicJobPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: job } = await supabase
    .from('job_cards')
    .select('*, customers(name,phone), job_status_log(status,note,ts)')
    .eq('public_token', token)
    .single()

  if (!job) notFound()

  const expired = job.token_expires_at && new Date(job.token_expires_at) < new Date()
  if (expired) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center px-6">
        <div className="text-center text-gray-400">
          <p className="text-xl font-semibold mb-2">Link Expired</p>
          <p>Please contact the shop for an updated status link.</p>
          <a href="tel:+918170018080" className="block mt-4 text-brand-400">+91 81700 18080</a>
        </div>
      </div>
    )
  }

  const currentStep = STATUS_STEPS.indexOf(job.status)

  return (
    <div className="min-h-screen bg-surface-900 px-4 py-8 max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 brand-gradient rounded-xl flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-black text-lg">A</span>
        </div>
        <p className="text-gray-400 text-sm">Advanced Computer System</p>
        <p className="text-gray-600 text-xs">Burdwan, West Bengal</p>
      </div>

      {/* Job info */}
      <div className="card mb-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500">Job Card</p>
            <p className="text-2xl font-black text-gray-100">#{job.number}</p>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            job.status === 'ready' ? 'bg-green-900/50 text-green-300' :
            job.status === 'delivered' ? 'bg-gray-700 text-gray-400' :
            'bg-brand-900/50 text-brand-300'
          }`}>
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
        </div>
        <div className="mt-3 space-y-1 text-sm text-gray-300">
          <p><span className="text-gray-500">Device: </span>{job.device_desc}</p>
          <p><span className="text-gray-500">Customer: </span>{job.customers?.name}</p>
        </div>
      </div>

      {/* Estimate + approve */}
      {job.status === 'estimate_sent' && job.estimate_amount && (
        <div className="card mb-4 border-brand-700/50">
          <p className="text-sm text-gray-400 mb-1">Estimate for repair</p>
          <p className="text-2xl font-black text-gray-100">{inr(job.estimate_amount)}</p>
          <p className="text-xs text-gray-500 mt-1">Tap approve to proceed</p>
          <div className="flex gap-2 mt-3">
            <ApproveButton jobId={job.id} token={token} />
          </div>
        </div>
      )}

      {/* Progress steps */}
      <div className="card mb-4">
        <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Progress</p>
        <div className="space-y-2">
          {STATUS_STEPS.filter(s => s !== 'cancelled').map((step, i) => {
            const done = i <= currentStep
            const current = i === currentStep
            return (
              <div key={step} className={`flex items-center gap-3 text-sm ${
                done ? 'text-gray-100' : 'text-gray-600'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  current ? 'bg-brand-600 text-white' :
                  done ? 'bg-green-800 text-green-300' :
                  'bg-surface-700 text-gray-600'
                }`}>
                  {done && !current ? '✓' : i + 1}
                </div>
                {STATUS_LABEL[step]}
              </div>
            )
          })}
        </div>
      </div>

      {/* Status log */}
      {job.job_status_log?.length > 0 && (
        <div className="card">
          <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Updates</p>
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {[...job.job_status_log].reverse().map((log: any, i: number) => (
              <div key={i} className="text-xs">
                <span className="text-gray-100 capitalize">{STATUS_LABEL[log.status] ?? log.status}</span>
                {log.note && <span className="text-gray-500"> — {log.note}</span>}
                <p className="text-gray-600">{formatDateTime(log.ts)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact */}
      <div className="text-center mt-6">
        <a href="tel:+918170018080" className="text-brand-400 text-sm">+91 81700 18080</a>
        <p className="text-gray-600 text-xs mt-1">acsbdn@gmail.com</p>
      </div>
    </div>
  )
}

function ApproveButton({ jobId, token }: { jobId: string; token: string }) {
  return (
    <form action={`/api/jobs/${jobId}/approve`} method="POST">
      <input type="hidden" name="token" value={token} />
      <button type="submit"
        className="flex-1 bg-green-700 hover:bg-green-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition">
        ✓ Approve Repair
      </button>
    </form>
  )
}
