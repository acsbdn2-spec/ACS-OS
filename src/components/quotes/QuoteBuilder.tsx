'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, Trash2, Send, FileText, X,
  AlertTriangle, Loader2, Package, ChevronDown, QrCode
} from 'lucide-react'
import { inr, gstBreakdown, cn, debounce } from '@/lib/utils'
import { buildFuseIndex, fuseSearch } from '@/lib/fuzzy'
import toast from 'react-hot-toast'
import type { Profile } from '@/types/database'
import CounterPricePanel from '@/components/quotes/CounterPricePanel'
import UpiQrModal from '@/components/quotes/UpiQrModal'

interface ProductRow { id: string; name: string; cat?: string | null; sell?: number | null; gst_pct?: number; stock?: number | null; market_ref?: number | null }
interface CustomerRow { id: string; name: string; phone: string | null; rate_contract: Record<string,number> | null }
interface BundleRow { id: string; name: string; lines: QuoteLine[] }
interface QuoteLine { product_id: string; product_name: string; qty: number; unit_price: number; gst_pct: number }

export default function QuoteBuilder({
  profile, products, customers, bundles, existingQuote
}: {
  profile: Profile
  products: ProductRow[]
  customers: CustomerRow[]
  bundles: BundleRow[]
  existingQuote: null | { id: string; lines: QuoteLine[]; customer_id: string | null; quote_type: string }
}) {
  const router = useRouter()
  const isOwner = profile.role === 'owner'

  const [lines, setLines] = useState<QuoteLine[]>(existingQuote?.lines ?? [])
  const [customerId, setCustomerId] = useState<string>(existingQuote?.customer_id ?? '')
  const [quoteType, setQuoteType] = useState<'quote'|'proforma'>(existingQuote?.quote_type as 'quote'|'proforma' ?? 'quote')
  const [productQuery, setProductQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showCounter, setShowCounter] = useState(false)
  const [showUpi, setShowUpi] = useState(false)
  const [saving, setSaving] = useState(false)
  const [floorWarnings, setFloorWarnings] = useState<Record<string, string>>({})

  // Auto-save draft every 10s
  const saveDraft = useCallback(
    debounce(async (draftLines: QuoteLine[], cid: string) => {
      await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: true, lines: draftLines, customer_id: cid || null,
          store_id: profile.store_id, quote_type: quoteType }),
      })
    }, 10000),
    [profile.store_id, quoteType]
  )

  useEffect(() => {
    if (lines.length > 0) saveDraft(lines, customerId)
  }, [lines, customerId, saveDraft])

  const fuse = useMemo(() => buildFuseIndex(products), [products])
  const searchResults = useMemo(() =>
    productQuery ? fuseSearch(fuse, productQuery).slice(0, 8) : products.slice(0, 8)
  , [fuse, productQuery, products])

  const { subtotal, totalGst, total } = useMemo(() => gstBreakdown(lines), [lines])
  const selectedCustomer = customers.find(c => c.id === customerId)

  function addProduct(p: ProductRow) {
    const contractPrice = selectedCustomer?.rate_contract?.[p.id]
    const price = contractPrice ?? p.sell ?? 0
    setLines(prev => {
      const existing = prev.findIndex(l => l.product_id === p.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 }
        return updated
      }
      return [...prev, { product_id: p.id, product_name: p.name, qty: 1, unit_price: price, gst_pct: p.gst_pct ?? 18 }]
    })
    setShowSearch(false)
    setProductQuery('')
  }

  function addBundle(b: BundleRow) {
    setLines(prev => {
      const next = [...prev]
      for (const l of b.lines) {
        const idx = next.findIndex(x => x.product_id === l.product_id)
        if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + l.qty }
        else next.push(l)
      }
      return next
    })
  }

  function updateLine(idx: number, field: keyof QuoteLine, value: string | number) {
    setLines(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
    // Check floor for price changes
    if (field === 'unit_price' && !isOwner) {
      const lineId = lines[idx].product_id
      fetch('/api/counter-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: lineId, price: Number(value) }),
      }).then(r => r.json()).then(d => {
        if (d.below_floor) {
          setFloorWarnings(prev => ({ ...prev, [lineId]: 'Below minimum price' }))
        } else {
          setFloorWarnings(prev => { const n = { ...prev }; delete n[lineId]; return n })
        }
      })
    }
  }

  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  async function submit() {
    if (lines.length === 0) { toast.error('Add at least one product'); return }
    if (Object.keys(floorWarnings).length > 0 && !isOwner) {
      toast.error('Some lines are below minimum price'); return
    }
    setSaving(true)
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: profile.store_id,
        customer_id: customerId || null,
        quote_type: quoteType,
        lines,
      }),
    })
    if (res.ok) {
      const q = await res.json()
      toast.success(`${quoteType === 'proforma' ? 'Proforma Invoice' : 'Quote'} #${q.number} created`)
      router.push(`/quotes/${q.id}`)
    } else {
      const e = await res.json()
      toast.error(e.error ?? 'Failed')
    }
    setSaving(false)
  }

  return (
    <div className="px-4 pt-3 pb-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-100">New Quote</h1>
        <div className="flex items-center gap-2">
          {/* Quote type toggle */}
          <select value={quoteType} onChange={e => setQuoteType(e.target.value as 'quote'|'proforma')}
            className="bg-surface-700 border border-surface-500 rounded-lg px-2 py-1.5 text-xs text-gray-300">
            <option value="quote">Quote</option>
            <option value="proforma">Proforma Invoice</option>
          </select>
        </div>
      </div>

      {/* Customer */}
      <div className="mb-4">
        <label className="label">Customer (optional)</label>
        <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="input">
          <option value="">Walk-in / No customer</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Product search */}
      <div className="relative mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={productQuery}
              onChange={e => { setProductQuery(e.target.value); setShowSearch(true) }}
              onFocus={() => setShowSearch(true)}
              className="input pl-9"
              placeholder="Add product to quote…"
            />
          </div>
          {bundles.length > 0 && (
            <div className="relative">
              <button className="btn-secondary px-3 flex items-center gap-1 text-sm">
                Bundles <ChevronDown size={14} />
              </button>
            </div>
          )}
        </div>

        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-700 border border-surface-500
            rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
            {searchResults.map(p => (
              <button key={p.id} onClick={() => addProduct(p)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-600 text-left border-b border-surface-600 last:border-0">
                <Package size={16} className="text-brand-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 truncate">{p.name}</p>
                  {p.cat && <p className="text-xs text-gray-500">{p.cat}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-100">{inr(p.sell ?? null)}</p>
                  {(p.stock ?? 0) <= 2 && (
                    <p className="text-[10px] text-amber-400">{p.stock === 0 ? 'Out' : `${p.stock} left`}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lines */}
      {lines.length > 0 ? (
        <div className="space-y-2 mb-4">
          {lines.map((line, idx) => (
            <div key={line.product_id} className="card">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{line.product_name}</p>
                  {floorWarnings[line.product_id] && (
                    <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
                      <AlertTriangle size={10} />{floorWarnings[line.product_id]}
                    </p>
                  )}
                </div>
                <button onClick={() => removeLine(idx)} className="text-gray-600 hover:text-red-400 shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <div className="w-20">
                  <label className="label">Qty</label>
                  <input type="number" min={1} value={line.qty}
                    onChange={e => updateLine(idx, 'qty', parseInt(e.target.value) || 1)}
                    className="input py-1.5 text-sm" inputMode="numeric" />
                </div>
                <div className="flex-1">
                  <label className="label">Unit Price (₹)</label>
                  <input type="number" min={0} value={line.unit_price}
                    onChange={e => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                    className={cn('input py-1.5 text-sm', floorWarnings[line.product_id] ? 'border-red-500' : '')}
                    inputMode="decimal" />
                </div>
                <div className="w-20">
                  <label className="label">GST %</label>
                  <input type="number" min={0} value={line.gst_pct}
                    onChange={e => updateLine(idx, 'gst_pct', parseFloat(e.target.value) || 0)}
                    className="input py-1.5 text-sm" inputMode="decimal" />
                </div>
              </div>
              <p className="text-right text-xs text-gray-400 mt-1">
                Line total: {inr(line.qty * line.unit_price * (1 + line.gst_pct / 100))}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600 text-sm border-2 border-dashed border-surface-600 rounded-2xl mb-4">
          Search and add products above
        </div>
      )}

      {/* Totals */}
      {lines.length > 0 && (
        <div className="card mb-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span><span>{inr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>GST</span><span>{inr(totalGst)}</span>
            </div>
            <div className="flex justify-between text-gray-100 font-bold text-base pt-2 border-t border-surface-600">
              <span>Total</span><span>{inr(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Counter-price tool */}
      <button onClick={() => setShowCounter(s => !s)}
        className="w-full mb-3 text-sm text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1.5 py-2">
        <Search size={14} /> Counter-price check (customer quoting a price?)
      </button>
      {showCounter && <CounterPricePanel products={products} />}

      {/* Actions */}
      <div className="space-y-2">
        <button onClick={submit} disabled={saving || lines.length === 0} className="btn-primary w-full py-4 text-base">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          {saving ? 'Saving…' : `Save ${quoteType === 'proforma' ? 'Proforma Invoice' : 'Quote'}`}
        </button>
        {total > 0 && (
          <button onClick={() => setShowUpi(true)} className="btn-secondary w-full py-3">
            <QrCode size={16} /> Show UPI QR (₹{total.toLocaleString('en-IN')})
          </button>
        )}
      </div>

      {showUpi && (
        <UpiQrModal
          amount={total}
          ref_no={`QUOTE-${Date.now()}`}
          onClose={() => setShowUpi(false)}
        />
      )}
    </div>
  )
}
