import { createServiceClient } from '@/lib/supabase/server'

export type ValidationLevel = 'error' | 'warning' | 'info'

export interface ValidationFlag {
  level:   ValidationLevel
  message: string
}

export interface ValidationResult {
  valid:       boolean
  flags:       ValidationFlag[]
  rowCount:    number
  dataSource:  string
}

export interface ReportFiltersInput {
  from:       string  // 'YYYY-MM-DD'
  to:         string  // 'YYYY-MM-DD'
  branchId?:  string
}

function toISO(dateStr: string, endOfDay = false): string {
  const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00'
  return `${dateStr}${suffix}+03:00`
}

// ── Sales validation ──────────────────────────────────────────────────────────

export async function validateSalesData(
  filters: ReportFiltersInput,
): Promise<ValidationResult> {
  const flags: ValidationFlag[] = []

  if (filters.from > filters.to) {
    flags.push({ level: 'error', message: 'End date cannot be before start date' })
    return { valid: false, flags, rowCount: 0, dataSource: 'orders' }
  }

  const sb   = createServiceClient()
  let   q    = sb
    .from('orders')
    .select('total_bhd, status, created_at')
    .gte('created_at', toISO(filters.from))
    .lte('created_at', toISO(filters.to, true))

  if (filters.branchId) q = q.eq('branch_id', filters.branchId)

  const { data, error } = await q
  if (error || !data) {
    flags.push({ level: 'error', message: 'Failed to connect to data source — check service role credentials' })
    return { valid: false, flags, rowCount: 0, dataSource: 'orders' }
  }

  const active = data.filter((r) => r.status !== 'cancelled' && r.status !== 'payment_failed')

  if (active.length === 0) {
    flags.push({ level: 'warning', message: 'No orders found for the selected period and filters' })
    return { valid: true, flags, rowCount: 0, dataSource: 'orders (live)' }
  }

  const totals = active.map((r) => r.total_bhd ?? 0)
  const avg    = totals.reduce((s, v) => s + v, 0) / totals.length
  const maxVal = Math.max(...totals)

  if (avg > 0 && maxVal > avg * 10) {
    flags.push({
      level:   'warning',
      message: `Unusual order detected: BD ${maxVal.toFixed(3)} (${Math.round(maxVal / avg)}× average) — verify manually`,
    })
  }

  const sumCheck = active.reduce((s, r) => s + (r.total_bhd ?? 0), 0)
  if (Math.abs(sumCheck - avg * active.length) > 0.01) {
    // Recalculate to verify
    const recheck = totals.reduce((s, v) => s + v, 0)
    if (Math.abs(recheck - sumCheck) > 0.01) {
      flags.push({ level: 'error', message: 'Revenue calculation mismatch — data integrity issue detected' })
    }
  }

  const now        = new Date().toISOString()
  const futureDates = data.filter((r) => r.created_at > now).length
  if (futureDates > 0) {
    flags.push({ level: 'warning', message: `${futureDates} order(s) have future timestamps — check system clock` })
  }

  return {
    valid:      flags.filter((f) => f.level === 'error').length === 0,
    flags,
    rowCount:   active.length,
    dataSource: 'orders (live)',
  }
}

// ── Menu items validation ─────────────────────────────────────────────────────

export async function validateMenuData(
  filters: ReportFiltersInput,
): Promise<ValidationResult> {
  const flags: ValidationFlag[] = []

  const sb    = createServiceClient()
  const { data, error } = await sb
    .from('order_items')
    .select('menu_item_slug, quantity, item_total_bhd, orders!inner(status, created_at)')
    .not('orders.status', 'in', '(cancelled,payment_failed)')
    .gte('orders.created_at', toISO(filters.from))
    .lte('orders.created_at', toISO(filters.to, true))

  if (error || !data) {
    flags.push({ level: 'error', message: 'Failed to load menu item data' })
    return { valid: false, flags, rowCount: 0, dataSource: 'order_items' }
  }

  if (data.length === 0) {
    flags.push({ level: 'warning', message: 'No menu items sold in the selected period' })
    return { valid: true, flags, rowCount: 0, dataSource: 'order_items (live)' }
  }

  const zeroPrice = data.filter((r) => (r.item_total_bhd ?? 0) === 0 && (r.quantity ?? 0) > 0).length
  if (zeroPrice > 0) {
    flags.push({
      level:   'warning',
      message: `${zeroPrice} line item(s) have zero value — possible data entry errors`,
    })
  }

  return {
    valid:      flags.filter((f) => f.level === 'error').length === 0,
    flags,
    rowCount:   data.length,
    dataSource: 'order_items (live)',
  }
}

// ── Customer data validation ──────────────────────────────────────────────────

export async function validateCustomerData(): Promise<ValidationResult> {
  const flags: ValidationFlag[] = []

  const sb = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('customer_segments_view')
    .select('customer_phone')
    .limit(1)

  if (error) {
    flags.push({ level: 'error', message: 'Failed to access customer data view' })
    return { valid: false, flags, rowCount: 0, dataSource: 'customer_segments_view' }
  }

  if (!data || data.length === 0) {
    flags.push({ level: 'info', message: 'No identified customers yet — phone number is required for customer tracking' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (sb as any)
    .from('customer_segments_view')
    .select('*', { count: 'exact', head: true })

  return {
    valid:      true,
    flags,
    rowCount:   (count as number) ?? 0,
    dataSource: 'customer_segments_view (live)',
  }
}

// ── Coupon data validation ────────────────────────────────────────────────────

export async function validateCouponData(): Promise<ValidationResult> {
  const flags: ValidationFlag[] = []

  const sb = createServiceClient()
  const { count, error } = await sb
    .from('coupons')
    .select('*', { count: 'exact', head: true })

  if (error) {
    flags.push({ level: 'error', message: 'Failed to access coupon data' })
    return { valid: false, flags, rowCount: 0, dataSource: 'coupons' }
  }

  if ((count ?? 0) === 0) {
    flags.push({ level: 'info', message: 'No coupons created yet' })
  }

  return {
    valid:      true,
    flags,
    rowCount:   count ?? 0,
    dataSource: 'coupon_analytics_view (live)',
  }
}
