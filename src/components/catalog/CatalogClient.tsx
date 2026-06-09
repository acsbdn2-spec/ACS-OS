'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildFuseIndex, fuseSearch } from '@/lib/fuzzy'
import { inr, stockStatus, formatDateTime } from '@/lib/utils'
import {
  Search, Plus, ScanLine, RefreshCw, Package,
  ChevronRight, AlertTriangle, X
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import ScannerModal from '@/components/scanner/ScannerModal'
import AddProductModal from '@/components/catalog/AddProductModal'
import type { Profile } from '@/types/database'
import { useRouter } from 'next/navigation'

interface ProductRow {
  id: string
  store_id: string
  name: string
  norm_name: string
  cat?: string | null
  sell?: number | null
  cost?: number | null
  stock?: number | null
  stock_qty?: number | null
  reserved_qty?: number | null
  low_stock_threshold?: number | null
  market_ref?: number | null
  gst_pct?: number
  archived?: boolean
}

interface Props {
  products: ProductRow[]
  profile: Profile
  lastSynced: string | null
}

export default function CatalogClient({ products: initial, profile, lastSynced }: Props) {
  const router = useRouter()
  const [products, setProducts] = useState<ProductRow[]>(initial)
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [showScanner, setShowScanner] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const isOwner = profile.role === 'owner'
  const canWrite = ['owner', 'staff'].includes(profile.role)

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('catalog-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'products',
        filter: `store_id=eq.${profile.store_id}`,
      }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.store_id, router])

  // Fuse index
  const fuse = useMemo(() => buildFuseIndex(products), [products])

  // Categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.cat ?? '').filter(Boolean))
    return ['all', ...Array.from(cats).sort()]
  }, [products])

  const filtered = useMemo(() => {
    let list: ProductRow[] = query ? fuseSearch(fuse, query) : products
    if (catFilter !== 'all') list = list.filter(p => p.cat === catFilter)
    return list
  }, [query, fuse, products, catFilter])

  function onScan(code: string) {
    setShowScanner(false)
    setQuery(code)
  }

  const stockBadge = useCallback((p: ProductRow) => {
    const qty = (p.stock ?? p.stock_qty) ?? 0
    const low = p.low_stock_threshold ?? 2
    const s = stockStatus(qty, low)
    return (
      <span className={cn(
        'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
        s.color === 'red'   ? 'bg-red-900/50 text-red-300' :
        s.color === 'amber' ? 'bg-amber-900/50 text-amber-300' :
        'bg-green-900/50 text-green-300'
      )}>
        {s.label}
      </span>
    )
  }, [])

  return (
    <div className="px-4 pt-3 max-w-2xl mx-auto">
      {/* Sync indicator */}
      {lastSynced && (
        <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2">
          <RefreshCw size={10} />
          Stock synced {formatDateTime(lastSynced)}
        </div>
      )}

      {/* Search bar + scanner */}
      <div className="relative flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="input pl-9 pr-9"
            placeholder="Search — hp 24f, keyboard, seagate…"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="btn-secondary px-3"
          title="Scan barcode / QR"
        >
          <ScanLine size={20} />
        </button>
        {canWrite && (
          <button onClick={() => setShowAdd(true)} className="btn-primary px-3">
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={cn(
              'shrink-0 text-xs px-3 py-1.5 rounded-full border transition',
              catFilter === cat
                ? 'bg-brand-600 border-brand-500 text-white'
                : 'bg-surface-700 border-surface-500 text-gray-400 hover:text-gray-200'
            )}
          >
            {cat === 'all' ? `All (${products.length})` : cat}
          </button>
        ))}
      </div>

      {/* Product list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600">
          <Package size={40} className="mb-3 opacity-30" />
          <p>No products found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Link
              key={p.id}
              href={`/catalog/${p.id}`}
              className="card flex items-center gap-3 active:scale-[0.99] transition"
            >
              <div className="w-10 h-10 rounded-xl bg-surface-700 flex items-center justify-center shrink-0">
                <Package size={18} className="text-brand-400" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100 truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.cat && <span className="text-[10px] text-gray-500">{p.cat}</span>}
                  {stockBadge(p)}
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-100">{inr(p.sell ?? null)}</p>
                {isOwner && p.cost != null && (
                  <p className="text-[10px] text-gray-500">Cost {inr(p.cost)}</p>
                )}
              </div>

              <ChevronRight size={16} className="text-gray-600 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Low stock alert banner */}
      {(() => {
        const lowCount = products.filter(p => {
          const qty = (p.stock ?? p.stock_qty) ?? 0
          const low = p.low_stock_threshold ?? 2
          return qty > 0 && qty <= low
        }).length
        return lowCount > 0 ? (
          <div className="mt-4 flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl p-3 text-amber-400 text-sm">
            <AlertTriangle size={16} className="shrink-0" />
            {lowCount} item(s) low on stock
          </div>
        ) : null
      })()}

      {showScanner && <ScannerModal onScan={onScan} onClose={() => setShowScanner(false)} />}
      {showAdd && (
        <AddProductModal
          profile={profile}
          existingNames={products.map(p => p.norm_name)}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); router.refresh() }}
        />
      )}
    </div>
  )
}
