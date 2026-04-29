import { createServiceClient } from '@/lib/supabase/server'
import { BH_TIMEZONE } from './calculations'

// ── Enterprise analytics return types ────────────────────────────────────────

export interface CustomerSegmentSummary {
  segment: 'vip' | 'regular' | 'occasional' | 'one_time'
  customer_count: number
  total_revenue:  number
  avg_order_value: number
}

export interface TopCustomer {
  customer_phone:     string
  customer_name:      string | null
  order_count:        number
  total_spent_bhd:    number
  avg_order_value_bhd: number
  first_order_at:     string
  last_order_at:      string
  segment:            'vip' | 'regular' | 'occasional' | 'one_time'
}

export interface MenuItemPerformanceRow {
  item_id:          string
  name_ar:          string
  name_en:          string
  total_quantity:   number
  order_count:      number
  total_revenue:    number
  avg_price:        number
  estimated_profit: number
}

export interface CouponAnalyticsRow {
  id:                     string
  code:                   string
  type:                   string
  value:                  number
  campaign_name:          string | null
  usage_count:            number
  usage_limit:            number | null
  is_active:              boolean
  revenue_with_coupon:    number
  total_discount_given:   number
  order_count_from_coupon: number
  net_revenue:            number
  roi_percent:            number | null
}

export interface OrderSourceRow {
  source:      string
  order_count: number
  revenue:     number
}

export interface OperationalMetricsData {
  totalOrders:              number
  cancelledOrders:          number
  cancellationRate:         number
  avgFulfillmentMinutes:    number
  ordersWithFulfillmentData: number
}

export interface SecondaryMetricsData {
  totalItemsSold:          number
  newCustomersInPeriod:    number
  repeatCustomersInPeriod: number
  repeatRate:              number
}

// ── Base return types ─────────────────────────────────────────────────────────

export interface MetricsData {
  totalRevenue:      number
  orderCount:        number
  avgOrderValue:     number
  uniqueCustomers:   number
  prevTotalRevenue:  number
  prevOrderCount:    number
  prevAvgOrderValue: number
  prevUniqueCustomers: number
}

export interface DailySalesRow {
  order_date:           string  // 'YYYY-MM-DD'
  branch_id:            string
  order_count:          number
  total_revenue_bhd:    number
  avg_order_value_bhd:  number
}

export interface TopItemRow {
  menu_item_slug:    string
  name_ar:           string
  name_en:           string
  total_quantity:    number
  total_revenue_bhd: number
  order_count:       number
}

export interface HourlyRow {
  hour_of_day:          number  // 0–23 Bahrain time
  order_count:          number
  total_revenue_bhd:    number
  avg_order_value_bhd:  number
}

export interface BranchSummary {
  branch_id:         string
  order_count:       number
  total_revenue_bhd: number
}

export interface SalesReportRow {
  order_date:        string
  branch_id:         string
  order_count:       number
  total_revenue_bhd: string
  avg_order_bhd:     string
}

export interface MenuReportRow {
  name_en:           string
  name_ar:           string
  total_quantity:    number
  total_revenue_bhd: string
  order_count:       number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString()
}

function excludedStatuses() {
  return ['cancelled', 'payment_failed'] as const
}

// ── Metrics (current + previous period for growth % comparison) ───────────────

export async function getMetrics(
  from:      Date,
  to:        Date,
  prevFrom:  Date,
  prevTo:    Date,
  branchId?: string,
): Promise<MetricsData> {
  const sb = createServiceClient()

  async function periodMetrics(pFrom: Date, pTo: Date) {
    let q = sb
      .from('orders')
      .select('total_bhd, customer_phone')
      .not('status', 'in', `(${excludedStatuses().join(',')})`)
      .gte('created_at', toISO(pFrom))
      .lte('created_at', toISO(pTo))

    if (branchId) q = q.eq('branch_id', branchId)

    const { data, error } = await q
    if (error || !data) return { totalRevenue: 0, orderCount: 0, avgOrderValue: 0, uniqueCustomers: 0 }

    const totalRevenue  = data.reduce((s, r) => s + (r.total_bhd ?? 0), 0)
    const orderCount    = data.length
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0
    const uniqueCustomers = new Set(data.map((r) => r.customer_phone).filter(Boolean)).size

    return { totalRevenue, orderCount, avgOrderValue, uniqueCustomers }
  }

  const [curr, prev] = await Promise.all([
    periodMetrics(from, to),
    periodMetrics(prevFrom, prevTo),
  ])

  return {
    totalRevenue:        curr.totalRevenue,
    orderCount:          curr.orderCount,
    avgOrderValue:       curr.avgOrderValue,
    uniqueCustomers:     curr.uniqueCustomers,
    prevTotalRevenue:    prev.totalRevenue,
    prevOrderCount:      prev.orderCount,
    prevAvgOrderValue:   prev.avgOrderValue,
    prevUniqueCustomers: prev.uniqueCustomers,
  }
}

// ── Daily sales (date-filtered — queries orders table directly for flexibility) ─

export async function getDailySales(
  from:      Date,
  to:        Date,
  branchId?: string,
): Promise<DailySalesRow[]> {
  const sb = createServiceClient()

  let q = sb
    .from('orders')
    .select('created_at, branch_id, total_bhd')
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .gte('created_at', toISO(from))
    .lte('created_at', toISO(to))
    .order('created_at', { ascending: true })

  if (branchId) q = q.eq('branch_id', branchId)

  const { data, error } = await q
  if (error || !data) return []

  // Group client-side into per-date-per-branch buckets
  const map = new Map<string, DailySalesRow>()

  for (const row of data) {
    const date = new Date(row.created_at)
      .toLocaleDateString('en-CA', { timeZone: BH_TIMEZONE }) // 'YYYY-MM-DD'
    const key    = `${date}::${row.branch_id}`
    const amount = row.total_bhd ?? 0
    const existing = map.get(key)

    if (existing) {
      existing.order_count        += 1
      existing.total_revenue_bhd  += amount
      existing.avg_order_value_bhd = existing.total_revenue_bhd / existing.order_count
    } else {
      map.set(key, {
        order_date:          date,
        branch_id:           row.branch_id,
        order_count:         1,
        total_revenue_bhd:   amount,
        avg_order_value_bhd: amount,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.order_date.localeCompare(b.order_date),
  )
}

// ── Top items (from materialized view — all-time, filtered by period via orders join) ─

export async function getTopItems(
  from:      Date,
  to:        Date,
  limit      = 10,
  branchId?: string,
): Promise<TopItemRow[]> {
  const sb = createServiceClient()

  // For date-filtered top items we query order_items + orders join
  let q = sb
    .from('order_items')
    .select('menu_item_slug, name_ar, name_en, quantity, item_total_bhd, orders!inner(created_at, branch_id, status)')
    .not('orders.status', 'in', `(${excludedStatuses().join(',')})`)
    .gte('orders.created_at', toISO(from))
    .lte('orders.created_at', toISO(to))

  if (branchId) q = q.eq('orders.branch_id', branchId)

  const { data, error } = await q
  if (error || !data) return []

  const map = new Map<string, TopItemRow>()

  for (const row of data) {
    const slug = row.menu_item_slug
    const existing = map.get(slug)
    if (existing) {
      existing.total_quantity    += row.quantity
      existing.total_revenue_bhd += row.item_total_bhd ?? 0
      existing.order_count       += 1
    } else {
      map.set(slug, {
        menu_item_slug:    slug,
        name_ar:           row.name_ar,
        name_en:           row.name_en,
        total_quantity:    row.quantity,
        total_revenue_bhd: row.item_total_bhd ?? 0,
        order_count:       1,
      })
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, limit)
}

// ── Hourly distribution (from matview — all-time; queried by hour) ────────────

export async function getHourlyDistribution(): Promise<HourlyRow[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('hourly_order_distribution')
    .select('*')
    .order('hour_of_day', { ascending: true })

  if (error || !data) return []
  return data as HourlyRow[]
}

// ── Branch comparison (summary per branch in the date range) ──────────────────

export async function getBranchSummaries(from: Date, to: Date): Promise<BranchSummary[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('orders')
    .select('branch_id, total_bhd')
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .gte('created_at', toISO(from))
    .lte('created_at', toISO(to))

  if (error || !data) return []

  const map = new Map<string, BranchSummary>()
  for (const row of data) {
    const existing = map.get(row.branch_id)
    if (existing) {
      existing.order_count       += 1
      existing.total_revenue_bhd += row.total_bhd ?? 0
    } else {
      map.set(row.branch_id, {
        branch_id:         row.branch_id,
        order_count:       1,
        total_revenue_bhd: row.total_bhd ?? 0,
      })
    }
  }
  return Array.from(map.values())
}

// ── Report data exports ───────────────────────────────────────────────────────

export async function getSalesReportData(
  from: Date,
  to:   Date,
): Promise<SalesReportRow[]> {
  const rows = await getDailySales(from, to)
  return rows.map((r) => ({
    order_date:        r.order_date,
    branch_id:         r.branch_id,
    order_count:       r.order_count,
    total_revenue_bhd: r.total_revenue_bhd.toFixed(3),
    avg_order_bhd:     r.avg_order_value_bhd.toFixed(3),
  }))
}

export async function getMenuReportData(
  from: Date,
  to:   Date,
): Promise<MenuReportRow[]> {
  const rows = await getTopItems(from, to, 50)
  return rows.map((r) => ({
    name_en:           r.name_en,
    name_ar:           r.name_ar,
    total_quantity:    r.total_quantity,
    total_revenue_bhd: r.total_revenue_bhd.toFixed(3),
    order_count:       r.order_count,
  }))
}

// ── Customer segment summary ──────────────────────────────────────────────────

export async function getCustomerSegmentSummary(): Promise<CustomerSegmentSummary[]> {
  const sb = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('customer_segments_view')
    .select('segment, total_spent_bhd, avg_order_value_bhd')

  if (error || !data) return []

  const map = new Map<string, CustomerSegmentSummary>()
  for (const row of data as { segment: string; total_spent_bhd: number; avg_order_value_bhd: number }[]) {
    const seg = row.segment as CustomerSegmentSummary['segment']
    const existing = map.get(seg)
    if (existing) {
      existing.customer_count += 1
      existing.total_revenue  += row.total_spent_bhd ?? 0
    } else {
      map.set(seg, {
        segment:       seg,
        customer_count: 1,
        total_revenue:  row.total_spent_bhd ?? 0,
        avg_order_value: row.avg_order_value_bhd ?? 0,
      })
    }
  }
  return Array.from(map.values())
}

// ── Top customers by lifetime value ──────────────────────────────────────────

export async function getTopCustomers(limit = 10): Promise<TopCustomer[]> {
  const sb = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('customer_segments_view')
    .select('customer_phone,customer_name,order_count,total_spent_bhd,avg_order_value_bhd,first_order_at,last_order_at,segment')
    .order('total_spent_bhd', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as TopCustomer[]
}

// ── Menu item performance (from matview) ──────────────────────────────────────

export async function getMenuItemPerformance(limit = 60): Promise<MenuItemPerformanceRow[]> {
  const sb = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('menu_item_performance')
    .select('*')
    .order('total_revenue', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as MenuItemPerformanceRow[]
}

// ── Coupon analytics (from view) ──────────────────────────────────────────────

export async function getCouponAnalytics(): Promise<CouponAnalyticsRow[]> {
  const sb = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('coupon_analytics_view')
    .select('*')
    .order('revenue_with_coupon', { ascending: false })

  if (error || !data) return []
  return data as CouponAnalyticsRow[]
}

// ── Order source breakdown ────────────────────────────────────────────────────

export async function getOrderSourceBreakdown(): Promise<OrderSourceRow[]> {
  const sb = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('order_source_summary')
    .select('*')
    .order('revenue', { ascending: false })

  if (error || !data) return []
  return data as OrderSourceRow[]
}

// ── Operational metrics (live from orders table) ──────────────────────────────

export async function getOperationalMetrics(
  from:      Date,
  to:        Date,
  branchId?: string,
): Promise<OperationalMetricsData> {
  const sb = createServiceClient()

  let q = sb
    .from('orders')
    .select('status, created_at, updated_at')
    .gte('created_at', toISO(from))
    .lte('created_at', toISO(to))
  if (branchId) q = q.eq('branch_id', branchId)

  const { data, error } = await q
  if (error || !data) {
    return { totalOrders: 0, cancelledOrders: 0, cancellationRate: 0, avgFulfillmentMinutes: 0, ordersWithFulfillmentData: 0 }
  }

  const totalOrders     = data.length
  const cancelledOrders = data.filter((r) => r.status === 'cancelled' || r.status === 'payment_failed').length
  const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0

  const fulfillmentTimes = data
    .filter((r) => r.status === 'delivered' || r.status === 'completed')
    .map((r) => (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 60_000)
    .filter((m) => m > 0 && m < 300)

  const avgFulfillmentMinutes = fulfillmentTimes.length > 0
    ? fulfillmentTimes.reduce((s, m) => s + m, 0) / fulfillmentTimes.length
    : 0

  return { totalOrders, cancelledOrders, cancellationRate, avgFulfillmentMinutes, ordersWithFulfillmentData: fulfillmentTimes.length }
}

// ── Secondary metrics (new vs. repeat customers, items sold) ──────────────────

export async function getSecondaryMetrics(
  from:      Date,
  to:        Date,
  branchId?: string,
): Promise<SecondaryMetricsData> {
  const sb = createServiceClient()

  // Build two queries in parallel
  let periodQ = sb
    .from('orders')
    .select('customer_phone')
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .gte('created_at', toISO(from))
    .lte('created_at', toISO(to))
    .not('customer_phone', 'is', null)
  if (branchId) periodQ = periodQ.eq('branch_id', branchId)

  let prevQ = sb
    .from('orders')
    .select('customer_phone')
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .lt('created_at', toISO(from))
    .not('customer_phone', 'is', null)
  if (branchId) prevQ = prevQ.eq('branch_id', branchId)

  let itemsQ = sb
    .from('order_items')
    .select('quantity, orders!inner(created_at, status)')
    .not('orders.status', 'in', `(${excludedStatuses().join(',')})`)
    .gte('orders.created_at', toISO(from))
    .lte('orders.created_at', toISO(to))
  if (branchId) itemsQ = itemsQ.eq('orders.branch_id', branchId)

  const [periodRes, prevRes, itemsRes] = await Promise.all([periodQ, prevQ, itemsQ])

  const periodPhones = new Set((periodRes.data ?? []).map((r) => r.customer_phone).filter(Boolean))
  const prevPhones   = new Set((prevRes.data   ?? []).map((r) => r.customer_phone).filter(Boolean))

  const repeatCustomersInPeriod = [...periodPhones].filter((p) => prevPhones.has(p)).length
  const newCustomersInPeriod    = periodPhones.size - repeatCustomersInPeriod
  const repeatRate = periodPhones.size > 0 ? (repeatCustomersInPeriod / periodPhones.size) * 100 : 0

  const totalItemsSold = (itemsRes.data ?? []).reduce((s, r) => s + ((r.quantity as number) ?? 0), 0)

  return { totalItemsSold, newCustomersInPeriod, repeatCustomersInPeriod, repeatRate }
}

// ── Refresh materialized views (called from server action) ────────────────────

export async function refreshAnalyticsViews(): Promise<{ error: string | null }> {
  const sb = createServiceClient()
  const { error } = await sb.rpc('refresh_analytics_views' as never)
  return { error: error?.message ?? null }
}
