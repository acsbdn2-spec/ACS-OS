'use client'

import { useState } from 'react'
import { Users, Search, Plus, ChevronRight, Phone, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/types/database'

interface CustomerRow { id: string; name: string; phone: string | null; email: string | null; created_at: string }

export default function CustomersClient({ customers: initial, profile }: {
  customers: CustomerRow[]; profile: Profile
}) {
  const router = useRouter()
  const [customers, setCustomers] = useState(initial)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const canWrite = ['owner','staff'].includes(profile.role)

  const filtered = customers.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) ||
    (c.phone ?? '').includes(query)
  )

  async function addCustomer() {
    if (!newName.trim()) return
    setSaving(true)
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, phone: newPhone || null, email: newEmail || null }),
    })
    if (res.ok) {
      const c = await res.json()
      setCustomers(prev => [c, ...prev])
      setShowAdd(false); setNewName(''); setNewPhone(''); setNewEmail('')
      toast.success('Customer added')
      router.refresh()
    } else {
      const e = await res.json(); toast.error(e.error ?? 'Failed')
    }
    setSaving(false)
  }

  return (
    <div className="px-4 pt-3 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-100">Customers</h1>
        {canWrite && (
          <button onClick={() => setShowAdd(s => !s)} className="btn-primary py-2 px-4 text-sm">
            <Plus size={16} /> Add
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          className="input pl-9" placeholder="Name or phone…" />
      </div>

      {showAdd && (
        <div className="card mb-4 space-y-3">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            className="input" placeholder="Customer name *" />
          <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
            className="input" placeholder="Phone" type="tel" />
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
            className="input" placeholder="Email" type="email" />
          <button onClick={addCustomer} disabled={saving || !newName.trim()} className="btn-primary w-full">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Add Customer'}
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <Users size={36} className="mx-auto mb-2 opacity-30" />
          <p>No customers found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Link key={c.id} href={`/customers/${c.id}`}
              className="card flex items-center gap-3 active:scale-[0.99] transition">
              <div className="w-10 h-10 rounded-full bg-brand-900/50 flex items-center justify-center shrink-0 text-brand-400 font-bold text-sm">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100 truncate">{c.name}</p>
                {c.phone && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Phone size={10} />{c.phone}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-600 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
