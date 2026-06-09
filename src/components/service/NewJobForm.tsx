'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile } from '@/types/database'

const schema = z.object({
  customer_id:    z.string().min(1, 'Customer required'),
  device_desc:    z.string().min(2, 'Describe the device'),
  complaint:      z.string().min(5, 'Describe the complaint'),
  condition_in:   z.string().optional(),
  assigned_to:    z.string().optional(),
  is_warranty_claim: z.boolean().default(false),
  is_outside:     z.boolean().default(false),
  outside_vendor: z.string().optional(),
  sla_days:       z.coerce.number().min(1).default(5),
})
type Form = z.infer<typeof schema>

const ACCESSORIES = ['Charger','Bag','Mouse','Keyboard','Power cable','SIM card','Memory card','Other']

export default function NewJobForm({ profile, customers, technicians }: {
  profile: Profile
  customers: { id: string; name: string; phone: string | null }[]
  technicians: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [accessories, setAccessories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { sla_days: 5, is_warranty_claim: false, is_outside: false },
  })
  const isOutside = watch('is_outside')

  function toggleAcc(a: string) {
    setAccessories(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  async function onSubmit(data: Form) {
    setSaving(true)
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, accessories, store_id: profile.store_id }),
    })
    if (res.ok) {
      const job = await res.json()
      toast.success(`Job #${job.number} created`)
      router.push(`/service/${job.id}`)
    } else {
      const e = await res.json()
      toast.error(e.error ?? 'Failed')
    }
    setSaving(false)
  }

  return (
    <div className="px-4 pt-3 pb-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100 mb-4">New Job Card</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Customer */}
        <div>
          <label className="label">Customer *</label>
          <select {...register('customer_id')} className="input">
            <option value="">Select customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
            ))}
          </select>
          {errors.customer_id && <p className="text-red-400 text-xs mt-1">{errors.customer_id.message}</p>}
        </div>

        {/* Device */}
        <div>
          <label className="label">Device *</label>
          <input {...register('device_desc')} className="input" placeholder="e.g. Dell Laptop Inspiron 15, HP LaserJet" />
          {errors.device_desc && <p className="text-red-400 text-xs mt-1">{errors.device_desc.message}</p>}
        </div>

        {/* Complaint */}
        <div>
          <label className="label">Complaint *</label>
          <textarea {...register('complaint')} className="input min-h-[80px] resize-none"
            placeholder="Describe what the customer is reporting…" />
          {errors.complaint && <p className="text-red-400 text-xs mt-1">{errors.complaint.message}</p>}
        </div>

        {/* Condition */}
        <div>
          <label className="label">Condition on intake</label>
          <input {...register('condition_in')} className="input" placeholder="e.g. cracked screen, no power, physically ok" />
        </div>

        {/* Accessories */}
        <div>
          <label className="label">Accessories received</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ACCESSORIES.map(a => (
              <button type="button" key={a} onClick={() => toggleAcc(a)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  accessories.includes(a)
                    ? 'bg-brand-600 border-brand-500 text-white'
                    : 'bg-surface-700 border-surface-500 text-gray-400'
                }`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Assign + SLA */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Assign to</label>
            <select {...register('assigned_to')} className="input">
              <option value="">Unassigned</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">SLA (days)</label>
            <input {...register('sla_days')} type="number" className="input" inputMode="numeric" />
          </div>
        </div>

        {/* Flags */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" {...register('is_warranty_claim')} className="rounded" />
            Warranty claim
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" {...register('is_outside')} className="rounded" />
            Outside repair
          </label>
        </div>

        {isOutside && (
          <div>
            <label className="label">Outside vendor</label>
            <input {...register('outside_vendor')} className="input" placeholder="Vendor / OEM service center name" />
          </div>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full py-4">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          {saving ? 'Creating…' : 'Create Job Card'}
        </button>
      </form>
    </div>
  )
}
