'use client'

import { useState, useMemo } from 'react'
import { Search, ScanLine, Barcode, X } from 'lucide-react'
import { warrantyStatus, formatDate, cn } from '@/lib/utils'
import ScannerModal from '@/components/scanner/ScannerModal'
import type { Profile } from '@/types/database'

interface SerialRow {
  id: string
  serial_no: string
  status: string
  purchase_date: string | null
  warranty_months: number
  busy_serial_id: string | null
  products: { id: string; name: string; cat: string | null } | null
}

export default function SerialsClient({
  serials, profile
}: {
  serials: SerialRow[]
  profile: Profile
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showScanner, setShowScanner] = useState(false)

  const filtered = useMemo(() => {
    return serials.filter(s => {
      const q = query.toLowerCase()
      const matchQ = !q ||
        s.serial_no.toLowerCase().includes(q) ||
        s.products?.name.toLowerCase().includes(q) ||
        (s.busy_serial_id ?? '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      return matchQ && matchStatus
    })
  }, [serials, query, statusFilter])

  const statusColors: Record<string, string> = {
    available: 'badge-green', sold: 'badge-gray',
    reserved: 'badge-blue', rma: 'badge-amber', loaner: 'badge-brand',
  }

  function onScan(code: string) {
    setShowScanner(false)
    setQuery(code)
  }

  return (
    <div className="px-4 pt-3 max-w-2xl mx-auto">
      {/* Search */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="input pl-9 pr-9"
            placeholder="Serial number, product name…"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => setShowScanner(true)} className="btn-secondary px-3">
          <ScanLine size={20} />
        </button>
      </div>

      {/* Status chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
        {['all', 'available', 'sold', 'reserved', 'rma', 'loaner'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'shrink-0 text-xs px-3 py-1.5 rounded-full border transition capitalize',
              statusFilter === s
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'bg-surface-700 border-surface-500 text-gray-400 hover:text-gray-200'
            )}
          >
            {s === 'all' ? `All (${serials.length})` : s}
          </button>
        ))}
      </div>

      {/* Serial list */}
      <div className="space-y-2">
        {filtered.map(s => {
          const ws = warrantyStatus(s.purchase_date, s.warranty_months)
          return (
            <div key={s.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Barcode size={18} className="text-gray-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-gray-100">{s.serial_no}</p>
                    <p className="text-xs text-gray-500 truncate">{s.products?.name ?? 'Unknown product'}</p>
                    {s.busy_serial_id && (
                      <p className="text-[10px] text-gray-600">Busy: {s.busy_serial_id}</p>
                    )}
                  </div>
                </div>
                <span className={cn(statusColors[s.status] ?? 'badge-gray', 'shrink-0')}>{s.status}</span>
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs">
                <span className={cn(
                  ws.color === 'green' ? 'text-green-400' :
                  ws.color === 'amber' ? 'text-amber-400' : 'text-red-400'
                )}>
                  {ws.label}
                </span>
                {s.purchase_date && (
                  <span className="text-gray-500">Purchased {formatDate(s.purchase_date)}</span>
                )}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <Barcode size={36} className="mx-auto mb-2 opacity-30" />
            No serials found
          </div>
        )}
      </div>

      {showScanner && <ScannerModal onScan={onScan} onClose={() => setShowScanner(false)} />}
    </div>
  )
}
