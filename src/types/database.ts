// Auto-derived from 001_initial_schema.sql
// Extend as new phases add tables

export type Role = 'owner' | 'staff' | 'viewer' | 'technician'
export type Lang = 'en' | 'bn'
export type SerialStatus = 'available' | 'reserved' | 'sold' | 'rma' | 'loaner'
export type QuoteStatus = 'open' | 'win' | 'lost'
export type QuoteType = 'quote' | 'proforma'
export type JobStatus =
  | 'received' | 'diagnosed' | 'estimate_sent' | 'approved'
  | 'in_repair' | 'testing' | 'ready' | 'delivered' | 'cancelled'
export type WaStatus = 'queued' | 'sent' | 'failed' | 'manual'
export type WaProvider = 'manual' | 'aisensy' | 'interakt' | 'wati'
export type StockMoveType = 'in' | 'out' | 'adjust' | 'reserve' | 'unreserve' | 'transfer_in' | 'transfer_out'

export interface Store {
  id: string
  created_at: string
  name: string
  address: string | null
  gstin: string | null
  phone: string | null
  email: string | null
}

export interface Profile {
  id: string
  created_at: string
  user_id: string
  role: Role
  store_id: string
  name: string
  lang: Lang
  phone: string | null
  is_active: boolean
}

export interface Product {
  id: string
  created_at: string
  store_id: string
  name: string
  norm_name: string
  cat: string | null
  cost: number | null       // owner only
  sell: number | null
  floor: number | null      // owner only
  tender_floor: number | null  // owner only
  market_ref: number | null
  market_match: string | null
  gst_pct: number
  stock_qty: number
  reserved_qty: number
  low_stock_threshold: number
  archived: boolean
  busy_item_id: string | null
  last_synced: string | null
}

// Staff-safe product (from products_public view)
export interface ProductPublic {
  id: string
  store_id: string
  name: string
  norm_name: string
  cat: string | null
  sell: number | null
  gst_pct: number
  stock: number
  reserved_qty: number
  low_stock_threshold: number
  market_ref: number | null
  archived: boolean
}

export interface Serial {
  id: string
  created_at: string
  product_id: string
  serial_no: string
  status: SerialStatus
  purchase_date: string | null
  warranty_months: number
  sold_to: string | null
  sold_date: string | null
  busy_serial_id: string | null
  last_synced: string | null
}

export interface Customer {
  id: string
  created_at: string
  store_id: string
  name: string
  phone: string | null
  email: string | null
  gstin: string | null
  address: string | null
  dob: string | null
  anniversary: string | null
  note: string | null
  rate_contract: Record<string, number> | null
  portal_enabled: boolean
  portal_phone: string | null
  opt_out_wa: boolean
}

export interface Quote {
  id: string
  created_at: string
  store_id: string
  number: number
  customer_id: string | null
  by_user: string
  status: QuoteStatus
  total: number | null
  source_tender_id: string | null
  public_token: string | null
  token_expires_at: string | null
  accepted: boolean
  quote_type: QuoteType
  draft_data: QuoteDraft | null
  draft_saved_at: string | null
}

export interface QuoteDraft {
  customer_id?: string
  lines?: QuoteLineDraft[]
  note?: string
}

export interface QuoteLineDraft {
  product_id: string
  product_name: string
  qty: number
  unit_price: number
  gst_pct: number
}

export interface QuoteLine {
  id: string
  quote_id: string
  product_id: string
  qty: number
  unit_price: number
  gst_pct: number
  serial_id: string | null
}

export interface Sale {
  id: string
  created_at: string
  quote_id: string | null
  store_id: string
  customer_id: string | null
  by_user: string
  date: string
  total: number
  invoice_no: string | null
  invoice_type: 'sale' | 'return'
}

export interface JobCard {
  id: string
  created_at: string
  store_id: string
  number: number
  customer_id: string
  device_desc: string
  condition_in: string | null
  accessories: string[] | null
  complaint: string
  intake_photos: string[] | null
  status: JobStatus
  assigned_to: string | null
  estimate_amount: number | null
  labour_charge: number
  final_amount: number | null
  approved_at: string | null
  ready_at: string | null
  delivered_at: string | null
  public_token: string
  token_expires_at: string | null
  is_outside: boolean
  outside_vendor: string | null
  outside_sent_date: string | null
  outside_expected: string | null
  sla_days: number
  is_warranty_claim: boolean
}

export interface ActivityLog {
  id: string
  created_at: string
  user_id: string
  store_id: string
  action: string
  entity: string
  entity_id: string | null
  detail: Record<string, unknown> | null
  ts: string
}

// API response wrappers
export interface ApiOk<T> { ok: true; data: T }
export interface ApiErr { ok: false; error: string }
export type ApiResult<T> = ApiOk<T> | ApiErr
