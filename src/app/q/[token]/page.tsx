import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { inr, gstBreakdown, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select(`*, customers(name,phone,email,address,gstin),
      quote_lines(qty,unit_price,gst_pct,products!product_id(name,cat)),
      stores(name,address,gstin,phone,email)`)
    .eq('public_token', token)
    .single()

  if (!quote) notFound()

  if (quote.token_expires_at && new Date(quote.token_expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <p className="text-gray-500">This quote link has expired. Please contact the shop.</p>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lines = (quote.quote_lines ?? []) as any[]
  const { subtotal, totalGst, total } = gstBreakdown(lines)

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 max-w-2xl mx-auto font-sans">
      {/* Letterhead */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-4">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-black text-gray-900">
              {quote.stores?.name ?? 'Advanced Computer System'}
            </h1>
            <p className="text-sm text-gray-500">{quote.stores?.address}</p>
            <p className="text-sm text-gray-500">{quote.stores?.phone} · {quote.stores?.email}</p>
            {quote.stores?.gstin && <p className="text-xs text-gray-400">GSTIN: {quote.stores.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              {quote.quote_type === 'proforma' ? 'Proforma Invoice' : 'Quotation'}
            </p>
            <p className="text-2xl font-black text-gray-900">#{quote.number}</p>
            <p className="text-xs text-gray-500">{formatDate(quote.created_at)}</p>
          </div>
        </div>

        {/* Bill to */}
        {quote.customers && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-400 mb-1">Bill To</p>
            <p className="font-semibold text-gray-800">{quote.customers.name}</p>
            {quote.customers.phone && <p className="text-sm text-gray-600">{quote.customers.phone}</p>}
            {quote.customers.address && <p className="text-sm text-gray-500">{quote.customers.address}</p>}
            {quote.customers.gstin && <p className="text-xs text-gray-400">GSTIN: {quote.customers.gstin}</p>}
          </div>
        )}

        {/* Lines */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b text-gray-400 text-xs uppercase">
              <th className="text-left pb-2">Item</th>
              <th className="text-right pb-2">Qty</th>
              <th className="text-right pb-2">Rate</th>
              <th className="text-right pb-2">GST</th>
              <th className="text-right pb-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2">
                  <p className="font-medium text-gray-800">{l.products?.name}</p>
                  {l.products?.cat && <p className="text-xs text-gray-400">{l.products.cat}</p>}
                </td>
                <td className="text-right py-2 text-gray-600">{l.qty}</td>
                <td className="text-right py-2 text-gray-600">{inr(l.unit_price)}</td>
                <td className="text-right py-2 text-gray-600">{l.gst_pct}%</td>
                <td className="text-right py-2 font-semibold text-gray-800">
                  {inr(l.qty * l.unit_price * (1 + l.gst_pct / 100))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
          <div className="flex justify-between text-gray-500"><span>GST</span><span>{inr(totalGst)}</span></div>
          <div className="flex justify-between text-gray-900 font-black text-lg border-t pt-2 mt-2">
            <span>Total</span><span>{inr(total)}</span>
          </div>
        </div>

        {/* Accept button */}
        {!quote.accepted && quote.status === 'open' && (
          <form action={`/api/quotes/${quote.id}/accept`} method="POST" className="mt-6">
            <input type="hidden" name="token" value={token} />
            <button type="submit"
              className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-3 font-semibold text-base transition">
              ✓ Accept this Quote
            </button>
          </form>
        )}

        {quote.accepted && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 text-center text-green-700 font-semibold">
            ✓ Quote Accepted
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        This quote is valid for 7 days from issue date. Contact us to place your order.
      </p>
    </div>
  )
}
