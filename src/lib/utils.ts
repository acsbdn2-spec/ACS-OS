import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInDays, addMonths } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Money formatting ──────────────────────────────────────────
export function inr(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount)
}

export function inrDecimal(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2,
  }).format(amount)
}

// ── Date helpers ──────────────────────────────────────────────
export function formatDate(d: string | Date | null): string {
  if (!d) return '—'
  return format(new Date(d), 'dd MMM yyyy')
}

export function formatDateTime(d: string | Date | null): string {
  if (!d) return '—'
  return format(new Date(d), 'dd MMM yyyy, h:mm a')
}

export function timeAgo(d: string | Date | null): string {
  if (!d) return '—'
  return formatDistanceToNow(new Date(d), { addSuffix: true })
}

// ── Warranty helpers ──────────────────────────────────────────
export function warrantyExpiry(purchaseDate: string | null, months: number): Date | null {
  if (!purchaseDate) return null
  return addMonths(new Date(purchaseDate), months)
}

export function warrantyStatus(purchaseDate: string | null, months: number) {
  const expiry = warrantyExpiry(purchaseDate, months)
  if (!expiry) return { label: 'Unknown', color: 'gray', inWarranty: false }
  const daysLeft = differenceInDays(expiry, new Date())
  if (daysLeft > 0) {
    return {
      label: `In warranty till ${formatDate(expiry.toISOString())} (${daysLeft}d left)`,
      color: daysLeft > 30 ? 'green' : 'amber',
      inWarranty: true,
    }
  }
  return {
    label: `Expired ${Math.abs(daysLeft)}d ago (${formatDate(expiry.toISOString())})`,
    color: 'red',
    inWarranty: false,
  }
}

// ── GST helpers ───────────────────────────────────────────────
export function withGst(price: number, gstPct: number) {
  const gst = (price * gstPct) / 100
  return { base: price, gst, total: price + gst }
}

export function gstBreakdown(lines: { qty: number; unit_price: number; gst_pct: number }[]) {
  let subtotal = 0, totalGst = 0
  for (const l of lines) {
    const base = l.qty * l.unit_price
    subtotal += base
    totalGst += (base * l.gst_pct) / 100
  }
  return { subtotal, totalGst, total: subtotal + totalGst }
}

// ── Normalize name (mirrors Postgres function) ────────────────
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// ── UPI QR URL ────────────────────────────────────────────────
export function upiPaymentUrl(opts: {
  vpa: string; name: string; amount: number; ref: string
}): string {
  const params = new URLSearchParams({
    pa: opts.vpa, pn: opts.name,
    am: opts.amount.toFixed(2),
    tr: opts.ref, tn: `ACS Invoice ${opts.ref}`,
  })
  return `upi://pay?${params}`
}

// ── Stock status helper ───────────────────────────────────────
export function stockStatus(qty: number, low: number = 2) {
  if (qty === 0)  return { label: 'Out of stock', color: 'red' }
  if (qty <= low) return { label: `Low stock (${qty})`, color: 'amber' }
  return { label: `${qty} in stock`, color: 'green' }
}

// ── Debounce ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// ── Unguessable token ─────────────────────────────────────────
export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

// ── Truncate text ─────────────────────────────────────────────
export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}
