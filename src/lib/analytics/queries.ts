import { createServiceClient } from '@/lib/supabase/server'
import { BH_TIMEZONE } from './calculations'
import { HIDDEN_BRANCHES } from '@/constants/contact'

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

export interface CashReconciliationMetrics {
  totalExpected:   number
  totalActual:     number
  totalDifference: number
  handoverCount:   number
  pendingConfirmationCount: number
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

export interface LaborCostMetrics {
  total_revenue:         number
  total_labor_cost:      number
  labor_cost_percentage: number
  order_count:           number
  staff_count:           number
}

export interface AnalyticsMenuEngineeringRow {
  slug:                string
  name_ar:             string
  name_en:             string
  total_quantity:      number
  total_revenue:       number
  profit_per_item:     number
  total_profit:        number
  popularity_score:    number
  profitability_score: number
  classification:      'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'
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

    if (branchId) {
      q = q.eq('branch_id', branchId)
    } else if (HIDDEN_BRANCHES.length > 0) {
      q = q.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
    }

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
  if (branchId) {
    q = q.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    q = q.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

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

  if (branchId) {
    q = q.eq('orders.branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    q = q.not('orders.branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

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

export async function getHourlyDistribution(from?: Date, to?: Date, branchId?: string): Promise<HourlyRow[]> {
  const sb = createServiceClient()

  // If no date range provided fall back to the pre-aggregated view (all-time)
  if (!from || !to) {
    const { data, error } = await sb
      .from('hourly_order_distribution')
      .select('*')
      .order('hour_of_day', { ascending: true })
    if (error || !data) return []
    return data as HourlyRow[]
  }

  // Query orders directly so we can filter by date range (and optionally branch)
  let q = sb
    .from('orders')
    .select('created_at, total_bhd')
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .gte('created_at', toISO(from))
    .lte('created_at', toISO(to))
  if (branchId) {
    q = q.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    q = q.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

  const { data, error } = await q
  if (error || !data) return []

  // Aggregate client-side by Bahrain hour (UTC+3)
  const buckets = new Map<number, { count: number; revenue: number }>()
  for (const row of data) {
    const hour = (new Date(row.created_at).getUTCHours() + 3) % 24
    const b = buckets.get(hour) ?? { count: 0, revenue: 0 }
    b.count   += 1
    b.revenue += Number(row.total_bhd ?? 0)
    buckets.set(hour, b)
  }

  return Array.from({ length: 24 }, (_, h) => {
    const b = buckets.get(h) ?? { count: 0, revenue: 0 }
    return {
      hour_of_day:         h,
      order_count:         b.count,
      total_revenue_bhd:   b.revenue,
      avg_order_value_bhd: b.count > 0 ? b.revenue / b.count : 0,
    }
  })
}

// ── Branch comparison (summary per branch in the date range) ──────────────────

export async function getBranchSummaries(
  from:      Date,
  to:        Date,
  branchId?: string,
): Promise<BranchSummary[]> {
  const sb = createServiceClient()
  let q = sb
    .from('orders')
    .select('branch_id, total_bhd')
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .gte('created_at', toISO(from))
    .lte('created_at', toISO(to))

  if (branchId) {
    q = q.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    q = q.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

  const { data, error } = await q

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
// Global path uses customer_segments_view (over customer_lifetime_value).
// Scoped path re-aggregates from orders for a single branch since the view
// has no branch_id column.

function classifySegment(orderCount: number): CustomerSegmentSummary['segment'] {
  if (orderCount >= 20) return 'vip'
  if (orderCount >= 5)  return 'regular'
  if (orderCount >= 2)  return 'occasional'
  return 'one_time'
}

export async function getCustomerSegmentSummary(branchId?: string): Promise<CustomerSegmentSummary[]> {
  const sb = createServiceClient()

  if (!branchId) {
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

  // Scoped: aggregate per-phone from orders within this branch
  const { data, error } = await sb
    .from('orders')
    .select('customer_phone, total_bhd')
    .eq('branch_id', branchId)
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .not('customer_phone', 'is', null)

  if (error || !data) return []

  const perPhone = new Map<string, { count: number; total: number }>()
  for (const row of data) {
    const phone = row.customer_phone as string | null
    if (!phone) continue
    const existing = perPhone.get(phone) ?? { count: 0, total: 0 }
    existing.count += 1
    existing.total += Number(row.total_bhd ?? 0)
    perPhone.set(phone, existing)
  }

  const segMap = new Map<CustomerSegmentSummary['segment'], { count: number; total: number; aovSum: number; aovN: number }>()
  for (const { count, total } of perPhone.values()) {
    const seg = classifySegment(count)
    const aov = count > 0 ? total / count : 0
    const existing = segMap.get(seg) ?? { count: 0, total: 0, aovSum: 0, aovN: 0 }
    existing.count  += 1
    existing.total  += total
    existing.aovSum += aov
    existing.aovN   += 1
    segMap.set(seg, existing)
  }

  return Array.from(segMap.entries()).map(([segment, agg]) => ({
    segment,
    customer_count:  agg.count,
    total_revenue:   agg.total,
    avg_order_value: agg.aovN > 0 ? agg.aovSum / agg.aovN : 0,
  }))
}

// ── Top customers by lifetime value ──────────────────────────────────────────

export async function getTopCustomers(limit = 10, branchId?: string): Promise<TopCustomer[]> {
  const sb = createServiceClient()

  if (!branchId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from('customer_segments_view')
      .select('customer_phone,customer_name,order_count,total_spent_bhd,avg_order_value_bhd,first_order_at,last_order_at,segment')
      .order('total_spent_bhd', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as TopCustomer[]
  }

  // Scoped: aggregate from orders within this branch
  const { data, error } = await sb
    .from('orders')
    .select('customer_phone, customer_name, total_bhd, created_at')
    .eq('branch_id', branchId)
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .not('customer_phone', 'is', null)

  if (error || !data) return []

  type Agg = { phone: string; name: string | null; count: number; total: number; first: string; last: string }
  const perPhone = new Map<string, Agg>()
  for (const row of data) {
    const phone = row.customer_phone as string | null
    if (!phone) continue
    const total = Number(row.total_bhd ?? 0)
    const created = String(row.created_at)
    const existing = perPhone.get(phone)
    if (existing) {
      existing.count += 1
      existing.total += total
      if (created < existing.first) existing.first = created
      if (created > existing.last)  existing.last  = created
      if (!existing.name && row.customer_name) existing.name = row.customer_name as string
    } else {
      perPhone.set(phone, {
        phone,
        name:  (row.customer_name as string | null) ?? null,
        count: 1,
        total,
        first: created,
        last:  created,
      })
    }
  }

  return Array.from(perPhone.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((a) => ({
      customer_phone:      a.phone,
      customer_name:       a.name,
      order_count:         a.count,
      total_spent_bhd:     a.total,
      avg_order_value_bhd: a.count > 0 ? a.total / a.count : 0,
      first_order_at:      a.first,
      last_order_at:       a.last,
      segment:             classifySegment(a.count),
    }))
}

// ── Menu item performance (from matview) ──────────────────────────────────────
// Global path uses the matview (all-time, all branches).
// Scoped path re-aggregates from order_items joined to orders within branch
// and optional date range. Profit estimate keeps the matview's 65% margin.

export async function getMenuItemPerformance(
  limit     = 60,
  branchId?: string,
  from?:     Date,
  to?:       Date,
): Promise<MenuItemPerformanceRow[]> {
  const sb = createServiceClient()

  if (!branchId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from('menu_item_performance')
      .select('*')
      .order('total_revenue', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as MenuItemPerformanceRow[]
  }

  let q = sb
    .from('order_items')
    .select('menu_item_slug, name_ar, name_en, quantity, item_total_bhd, unit_price_bhd, orders!inner(branch_id, status, created_at)')
    .eq('orders.branch_id', branchId)
    .not('orders.status', 'in', `(${excludedStatuses().join(',')})`)
  if (from) q = q.gte('orders.created_at', toISO(from))
  if (to)   q = q.lte('orders.created_at', toISO(to))

  const { data, error } = await q
  if (error || !data) return []

  const map = new Map<string, MenuItemPerformanceRow & { _priceSum: number; _priceN: number }>()
  for (const row of data) {
    const slug = row.menu_item_slug as string
    const qty  = Number(row.quantity ?? 0)
    const rev  = Number(row.item_total_bhd ?? 0)
    const unit = Number(row.unit_price_bhd ?? 0)
    const existing = map.get(slug)
    if (existing) {
      existing.total_quantity   += qty
      existing.order_count      += 1
      existing.total_revenue    += rev
      existing.estimated_profit += rev * 0.65
      existing._priceSum        += unit
      existing._priceN          += 1
      existing.avg_price         = existing._priceSum / existing._priceN
    } else {
      map.set(slug, {
        item_id:          slug,
        name_ar:          row.name_ar as string,
        name_en:          row.name_en as string,
        total_quantity:   qty,
        order_count:      1,
        total_revenue:    rev,
        avg_price:        unit,
        estimated_profit: rev * 0.65,
        _priceSum:        unit,
        _priceN:          1,
      })
    }
  }

  return Array.from(map.values())
    .map(({ _priceSum: _s, _priceN: _n, ...row }) => row)
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, limit)
}

// ── Coupon analytics (from view) ──────────────────────────────────────────────
// Global path uses coupon_analytics_view. Scoped path joins coupons × orders
// filtered to a single branch.

export async function getCouponAnalytics(branchId?: string): Promise<CouponAnalyticsRow[]> {
  const sb = createServiceClient()

  if (!branchId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from('coupon_analytics_view')
      .select('*')
      .order('revenue_with_coupon', { ascending: false })

    if (error || !data) return []
    return data as CouponAnalyticsRow[]
  }

  // Scoped: fetch coupons, then aggregate matching orders within branch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const couponRes = await (sb as any)
    .from('coupons')
    .select('id, code, type, value, campaign_name, usage_count, usage_limit, is_active')
  if (couponRes.error || !couponRes.data) return []
  const coupons = couponRes.data as Array<Pick<CouponAnalyticsRow,
    'id' | 'code' | 'type' | 'value' | 'campaign_name' | 'usage_count' | 'usage_limit' | 'is_active'>>

  const { data: ordersData, error: ordersErr } = await sb
    .from('orders')
    .select('coupon_id, total_bhd, coupon_discount_bhd')
    .eq('branch_id', branchId)
    .not('coupon_id', 'is', null)
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
  if (ordersErr || !ordersData) return []

  const perCoupon = new Map<string, { rev: number; disc: number; count: number }>()
  for (const row of ordersData) {
    const id = row.coupon_id as string | null
    if (!id) continue
    const agg = perCoupon.get(id) ?? { rev: 0, disc: 0, count: 0 }
    agg.rev   += Number(row.total_bhd ?? 0)
    agg.disc  += Number(row.coupon_discount_bhd ?? 0)
    agg.count += 1
    perCoupon.set(id, agg)
  }

  return coupons
    .map((c) => {
      const agg = perCoupon.get(c.id) ?? { rev: 0, disc: 0, count: 0 }
      const net = agg.rev - agg.disc
      const roi = agg.disc === 0 ? null : Math.round((net / agg.disc) * 1000) / 10
      return {
        ...c,
        revenue_with_coupon:     agg.rev,
        total_discount_given:    agg.disc,
        order_count_from_coupon: agg.count,
        net_revenue:             net,
        roi_percent:             roi,
      }
    })
    .sort((a, b) => b.revenue_with_coupon - a.revenue_with_coupon)
}

// ── Order source breakdown ────────────────────────────────────────────────────
// Global path uses order_source_summary view. Scoped path re-aggregates orders
// directly for a single branch.

export async function getOrderSourceBreakdown(branchId?: string): Promise<OrderSourceRow[]> {
  const sb = createServiceClient()

  if (!branchId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from('order_source_summary')
      .select('*')
      .order('revenue', { ascending: false })

    if (error || !data) return []
    return data as OrderSourceRow[]
  }

  const { data, error } = await sb
    .from('orders')
    .select('source, total_bhd')
    .eq('branch_id', branchId)
    .not('status', 'in', `(${excludedStatuses().join(',')})`)

  if (error || !data) return []

  const map = new Map<string, OrderSourceRow>()
  for (const row of data) {
    const raw = (row.source as string | null) ?? ''
    const src = raw.trim() === '' ? 'web' : raw.trim()
    const existing = map.get(src)
    if (existing) {
      existing.order_count += 1
      existing.revenue     += Number(row.total_bhd ?? 0)
    } else {
      map.set(src, { source: src, order_count: 1, revenue: Number(row.total_bhd ?? 0) })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
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
  if (branchId) {
    q = q.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    q = q.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

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

// ── Cash Reconciliation Metrics (Handover discrepancies) ──────────────────────

export async function getCashReconciliationMetrics(
  from:      Date,
  to:        Date,
  branchId?: string,
): Promise<CashReconciliationMetrics> {
  const sb = createServiceClient()

  let q = sb
    .from('cash_handovers')
    .select('expected_amount, actual_amount, difference, manager_confirmed')
    .gte('created_at', toISO(from))
    .lte('created_at', toISO(to))

  if (branchId) {
    q = q.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    q = q.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

  const { data, error } = await q
  if (error || !data) {
    return { totalExpected: 0, totalActual: 0, totalDifference: 0, handoverCount: 0, pendingConfirmationCount: 0 }
  }

  const totalExpected = data.reduce((s, r) => s + Number(r.expected_amount), 0)
  const totalActual   = data.reduce((s, r) => s + Number(r.actual_amount),   0)
  const totalDifference = data.reduce((s, r) => s + Number(r.difference),    0)
  const pendingConfirmationCount = data.filter((r) => !r.manager_confirmed).length

  return {
    totalExpected,
    totalActual,
    totalDifference,
    handoverCount: data.length,
    pendingConfirmationCount,
  }
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
  if (branchId) {
    periodQ = periodQ.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    periodQ = periodQ.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

  let prevQ = sb
    .from('orders')
    .select('customer_phone')
    .not('status', 'in', `(${excludedStatuses().join(',')})`)
    .lt('created_at', toISO(from))
    .not('customer_phone', 'is', null)
  if (branchId) {
    prevQ = prevQ.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    prevQ = prevQ.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

  let itemsQ = sb
    .from('order_items')
    .select('quantity, orders!inner(created_at, status)')
    .not('orders.status', 'in', `(${excludedStatuses().join(',')})`)
    .gte('orders.created_at', toISO(from))
    .lte('orders.created_at', toISO(to))
  if (branchId) {
    itemsQ = itemsQ.eq('orders.branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    itemsQ = itemsQ.not('orders.branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

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

// ── Labor Cost vs Revenue ────────────────────────────────────────────────────

export async function getLaborCostMetrics(
  from:      Date,
  to:        Date,
  branchId?: string,
): Promise<LaborCostMetrics | null> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('get_labor_cost_metrics', {
    p_from_date: toISO(from),
    p_to_date:   toISO(to),
    p_branch_id: branchId ?? undefined,
  })

  if (error || !data || data.length === 0) return null
  return data[0] as LaborCostMetrics
}

// ── Menu Engineering Matrix ───────────────────────────────────────────────────

export async function getMenuEngineeringMatrix(
  from:      Date,
  to:        Date,
  branchId?: string,
): Promise<AnalyticsMenuEngineeringRow[]> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('get_menu_engineering_matrix', {
    p_from_date: toISO(from),
    p_to_date:   toISO(to),
    p_branch_id: branchId ?? undefined,
  })

  if (error || !data) return []
  return data as AnalyticsMenuEngineeringRow[]
}
