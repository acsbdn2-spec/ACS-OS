'use client'

import { useState } from 'react'
import { Search, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { inr } from '@/lib/utils'

interface ProductRow { id: string; name: string }

export default function CounterPricePanel({ products }: { products: ProductRow[] }) {
  const [productId, setProductId] = useState('')
  const [customerPrice, setCustomerPrice] = useState('')
  const [result, setResult] = useState<{ canMatch: boolean; suggestedPrice?: number; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function check() {
    if (!productId || !customerPrice) return
    setLoading(true)
    const res = await fetch('/api/counter-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, price: parseFloat(customerPrice) }),
    })
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <div className="card mb-4 bg-surface-700 space-y-3">
      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Counter-Price Check</p>
      <p className="text-xs text-gray-500">Customer is quoting a price — check if we can match it.</p>

      <select value={productId} onChange={e => setProductId(e.target.value)} className="input">
        <option value="">Select product</option>
        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div className="flex gap-2">
        <input
          type="number" value={customerPrice} onChange={e => setCustomerPrice(e.target.value)}
          className="input flex-1" placeholder="Customer's price (₹)" inputMode="decimal"
        />
        <button onClick={check} disabled={loading || !productId || !customerPrice}
          className="btn-primary px-4">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </button>
      </div>

      {result && (
        <div className={`rounded-xl p-3 flex items-start gap-2 text-sm ${
          result.canMatch ? 'bg-green-900/30 text-green-300' : 'bg-red-900/20 text-red-300'}`}>
          {result.canMatch
            ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            : <XCircle size={16} className="shrink-0 mt-0.5" />}
          <div>
            <p className="font-semibold">{result.canMatch ? 'Can match' : 'Cannot match'}</p>
            <p>{result.message}</p>
            {result.canMatch && result.suggestedPrice && (
              <p className="font-bold mt-1">Offer: {inr(result.suggestedPrice)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
