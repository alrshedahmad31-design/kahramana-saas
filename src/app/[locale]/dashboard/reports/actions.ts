'use server'

import { getSession }           from '@/lib/auth/session'
import { canAccessReports }     from '@/lib/auth/rbac'
import { createServiceClient }  from '@/lib/supabase/server'
import {
  validateSalesData,
  validateMenuData,
  validateCustomerData,
  validateCouponData,
  type ValidationResult,
  type ReportFiltersInput,
} from '@/lib/reports/validator'
import {
  getMetrics, getDailySales, getTopItems,
  getHourlyDistribution, getOperationalMetrics,
  getTopCustomers, getCouponAnalytics,
} from '@/lib/analytics/queries'
import {
  buildPrevRange, formatCurrency, calculateGrowth,
} from '@/lib/analytics/calculations'
import type { ReportType } from '@/lib/reports/templates'
import type { Json } from '@/lib/supabase/custom-types'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ReportSummaryItem {
  label_en: string
  label_ar: string
  value:    string
}

export interface ReportResult {
  type:        ReportType
  title_en:    string
  title_ar:    string
  generatedAt: string
  periodLabel: string
  filters:     ReportFiltersInput & { branchName: string | null }
  validation:  ValidationResult
  columns_en:  string[]
  columns_ar:  string[]
  rows:        (string | number)[][]
  summary:     ReportSummaryItem[]
}

export type ActionResult<T> =
  | { ok: true;  data:  T }
  | { ok: false; error: string }

export interface ReportHistoryRow {
  id:            string
  report_name:   string
  report_type:   string
  generated_at:  string
  row_count:     number | null
  export_format: string | null
  filters:       Record<string, string> | null
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function resolveBranchName(branchId: string): Promise<string> {
  const sb       = createServiceClient()
  const { data } = await sb
    .from('branches')
    .select('name_en, name_ar')
    .eq('id', branchId)
    .single()
  return data ? `${data.name_en} / ${data.name_ar}` : branchId
}

async function logReport(params: {
  report_name:      string
  report_type:      string
  generated_by:     string
  filters:          ReportFiltersInput
  row_count:        number
  data_snapshot?:   Record<string, number | string>
  validation_flags: ValidationResult['flags']
  export_format?:   string
}): Promise<void> {
  const sb = createServiceClient()
  await sb.from('report_audit_log').insert({
    report_name:      params.report_name,
    report_type:      params.report_type,
    generated_by:     params.generated_by,
    filters:          params.filters as unknown as Json,
    row_count:        params.row_count,
    data_snapshot:    (params.data_snapshot ?? null) as Json,
    validation_flags: params.validation_flags as unknown as Json,
    export_format:    params.export_format ?? 'preview',
  })
}

function buildPeriodLabel(filters: ReportFiltersInput): string {
  const branch = filters.branchId ? '' : ' — All branches'
  return `${filters.from} → ${filters.to}${branch}`
}

function sign(n: number): string {
  return n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`
}

// ── Public actions ────────────────────────────────────────────────────────────

export async function getBranches(): Promise<{ id: string; name_en: string; name_ar: string }[]> {
  const user = await getSession()
  if (!user || !canAccessReports(user)) return []

  const sb       = createServiceClient()
  const { data } = await sb
    .from('branches')
    .select('id, name_en, name_ar')
    .eq('is_active', true)
    .order('name_en')

  return data ?? []
}

export async function getReportHistory(limit = 25): Promise<ReportHistoryRow[]> {
  const user = await getSession()
  if (!user || !canAccessReports(user)) return []

  const sb = createServiceClient()
  const { data } = await sb
    .from('report_audit_log')
    .select('id, report_name, report_type, generated_at, row_count, export_format, filters')
    .order('generated_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as ReportHistoryRow[]
}

export async function logExportFormat(
  reportType: string,
  format:     'csv' | 'excel' | 'pdf',
): Promise<void> {
  const user = await getSession()
  if (!user) return

  const sb = createServiceClient()
  await sb.from('report_audit_log').insert({
    report_name:   `${reportType} — ${format.toUpperCase()} export`,
    report_type:   reportType,
    generated_by:  user.id,
    export_format: format,
    filters:       null,
    row_count:     null,
  })
}

export async function generateReport(
  type:    ReportType,
  filters: ReportFiltersInput,
): Promise<ActionResult<ReportResult>> {
  const user = await getSession()
  if (!user || !canAccessReports(user)) {
    return { ok: false, error: 'Unauthorized — Owner or General Manager access required' }
  }

  try {
    switch (type) {
      case 'sales_summary':       return buildSalesSummary(filters, user.id)
      case 'menu_performance':    return buildMenuPerformance(filters, user.id)
      case 'customer_clv':        return buildCustomerCLV(user.id)
      case 'coupon_performance':  return buildCouponPerformance(user.id)
      case 'operational_summary': return buildOperationalSummary(filters, user.id)
      default:                    return { ok: false, error: 'Unknown report type' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { ok: false, error: msg }
  }
}

// ── Sales Summary ─────────────────────────────────────────────────────────────

async function buildSalesSummary(
  filters: ReportFiltersInput,
  userId:  string,
): Promise<ActionResult<ReportResult>> {
  const from  = new Date(`${filters.from}T00:00:00+03:00`)
  const to    = new Date(`${filters.to}T23:59:59+03:00`)
  const prev  = buildPrevRange({ from, to, label: 'custom' })

  const [validation, metrics, dailySales] = await Promise.all([
    validateSalesData(filters),
    getMetrics(from, to, prev.from, prev.to, filters.branchId),
    getDailySales(from, to, filters.branchId),
  ])

  const branchName = filters.branchId ? await resolveBranchName(filters.branchId) : null

  const rows: (string | number)[][] = dailySales.map((r) => [
    r.order_date,
    branchName ?? 'All branches',
    r.order_count,
    Number(r.total_revenue_bhd.toFixed(3)),
    Number(r.avg_order_value_bhd.toFixed(3)),
  ])

  const rg = calculateGrowth(metrics.totalRevenue,  metrics.prevTotalRevenue)
  const og = calculateGrowth(metrics.orderCount,    metrics.prevOrderCount)
  const ag = calculateGrowth(metrics.avgOrderValue, metrics.prevAvgOrderValue)

  const summary: ReportSummaryItem[] = [
    { label_en: 'Total Revenue',   label_ar: 'إجمالي الإيرادات',  value: `BD ${formatCurrency(metrics.totalRevenue)}`  },
    { label_en: 'Total Orders',    label_ar: 'إجمالي الطلبات',    value: String(metrics.orderCount)                    },
    { label_en: 'Avg Order Value', label_ar: 'متوسط قيمة الطلب',  value: `BD ${formatCurrency(metrics.avgOrderValue)}` },
    { label_en: 'Revenue Growth',  label_ar: 'نمو الإيرادات',      value: sign(rg)                                      },
    { label_en: 'Orders Growth',   label_ar: 'نمو الطلبات',        value: sign(og)                                      },
    { label_en: 'AOV Growth',      label_ar: 'نمو المتوسط',        value: sign(ag)                                      },
    { label_en: 'Customers',       label_ar: 'عملاء معروفون',      value: String(metrics.uniqueCustomers)               },
  ]

  await logReport({
    report_name:      'Sales Summary',
    report_type:      'sales_summary',
    generated_by:     userId,
    filters,
    row_count:        rows.length,
    data_snapshot:    { total_revenue: metrics.totalRevenue, total_orders: metrics.orderCount },
    validation_flags: validation.flags,
  })

  return {
    ok: true,
    data: {
      type:        'sales_summary',
      title_en:    'Sales Summary',
      title_ar:    'ملخص المبيعات',
      generatedAt: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bahrain' }),
      periodLabel: buildPeriodLabel(filters),
      filters:     { ...filters, branchName },
      validation,
      columns_en:  ['Date', 'Branch', 'Orders', 'Revenue (BD)', 'Avg Order (BD)'],
      columns_ar:  ['التاريخ', 'الفرع', 'الطلبات', 'الإيراد (د.ب)', 'متوسط الطلب (د.ب)'],
      rows,
      summary,
    },
  }
}

// ── Menu Performance ──────────────────────────────────────────────────────────

async function buildMenuPerformance(
  filters: ReportFiltersInput,
  userId:  string,
): Promise<ActionResult<ReportResult>> {
  const from = new Date(`${filters.from}T00:00:00+03:00`)
  const to   = new Date(`${filters.to}T23:59:59+03:00`)

  const [validation, items] = await Promise.all([
    validateMenuData(filters),
    getTopItems(from, to, 150, filters.branchId),
  ])

  const totalRevenue = items.reduce((s, r) => s + r.total_revenue_bhd, 0)
  const totalQty     = items.reduce((s, r) => s + r.total_quantity,    0)

  const rows: (string | number)[][] = items.map((r) => {
    const avgPrice = r.total_quantity > 0 ? r.total_revenue_bhd / r.total_quantity : 0
    return [
      r.name_en,
      r.name_ar,
      r.total_quantity,
      r.order_count,
      Number(r.total_revenue_bhd.toFixed(3)),
      Number(avgPrice.toFixed(3)),
      Number((r.total_revenue_bhd * 0.65).toFixed(3)),
    ]
  })

  const topItem = items[0]
  const summary: ReportSummaryItem[] = [
    { label_en: 'Unique Items',         label_ar: 'أصناف مختلفة',      value: String(items.length)                              },
    { label_en: 'Units Sold',           label_ar: 'وحدات مباعة',       value: totalQty.toLocaleString()                         },
    { label_en: 'Total Revenue',        label_ar: 'إجمالي الإيرادات',  value: `BD ${formatCurrency(totalRevenue)}`              },
    { label_en: 'Est. Profit (65%)',    label_ar: 'ربح تقديري (65%)',  value: `BD ${formatCurrency(totalRevenue * 0.65)}`        },
    { label_en: 'Top Item',            label_ar: 'الأكثر مبيعاً',     value: topItem?.name_en ?? '—'                           },
    { label_en: 'Top Item Revenue',    label_ar: 'إيراد الأول',        value: topItem ? `BD ${formatCurrency(topItem.total_revenue_bhd)}` : '—' },
  ]

  await logReport({
    report_name:      'Menu Performance',
    report_type:      'menu_performance',
    generated_by:     userId,
    filters,
    row_count:        rows.length,
    data_snapshot:    { unique_items: items.length, total_qty: totalQty, total_revenue: totalRevenue },
    validation_flags: validation.flags,
  })

  return {
    ok: true,
    data: {
      type:        'menu_performance',
      title_en:    'Menu Performance',
      title_ar:    'أداء المنيو',
      generatedAt: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bahrain' }),
      periodLabel: buildPeriodLabel(filters),
      filters:     { ...filters, branchName: null },
      validation,
      columns_en:  ['Item (EN)', 'Item (AR)', 'Units Sold', 'Orders', 'Revenue (BD)', 'Avg Price (BD)', 'Est. Profit (BD)'],
      columns_ar:  ['الصنف (EN)', 'الصنف (AR)', 'الكمية', 'الطلبات', 'الإيراد (د.ب)', 'متوسط السعر (د.ب)', 'الربح التقديري (د.ب)'],
      rows,
      summary,
    },
  }
}

// ── Customer CLV ──────────────────────────────────────────────────────────────

async function buildCustomerCLV(
  userId: string,
): Promise<ActionResult<ReportResult>> {
  const [validation, customers] = await Promise.all([
    validateCustomerData(),
    getTopCustomers(100),
  ])

  const rows: (string | number)[][] = customers.map((c) => [
    c.customer_phone,
    c.customer_name ?? '—',
    c.order_count,
    Number(c.total_spent_bhd.toFixed(3)),
    Number(c.avg_order_value_bhd.toFixed(3)),
    c.first_order_at ? new Date(c.first_order_at).toLocaleDateString('en-GB') : '—',
    c.last_order_at  ? new Date(c.last_order_at).toLocaleDateString('en-GB')  : '—',
    c.segment,
  ])

  const vip        = customers.filter((c) => c.segment === 'vip').length
  const regular    = customers.filter((c) => c.segment === 'regular').length
  const totalSpent = customers.reduce((s, c) => s + c.total_spent_bhd, 0)
  const top        = customers[0]

  const summary: ReportSummaryItem[] = [
    { label_en: 'Total Customers',   label_ar: 'إجمالي العملاء',    value: String(customers.length)                              },
    { label_en: 'VIP Customers',     label_ar: 'عملاء VIP',         value: String(vip)                                           },
    { label_en: 'Regular',           label_ar: 'منتظمون',           value: String(regular)                                       },
    { label_en: 'Total Revenue',     label_ar: 'إجمالي الإيرادات',  value: `BD ${formatCurrency(totalSpent)}`                    },
    { label_en: 'Top Spender',       label_ar: 'أعلى إنفاقاً',     value: top?.customer_name ?? top?.customer_phone ?? '—'      },
    { label_en: 'Top Spender Value', label_ar: 'قيمة الأول',        value: top ? `BD ${formatCurrency(top.total_spent_bhd)}` : '—' },
  ]

  await logReport({
    report_name:      'Customer Lifetime Value',
    report_type:      'customer_clv',
    generated_by:     userId,
    filters:          { from: 'all-time', to: 'all-time' },
    row_count:        rows.length,
    data_snapshot:    { total_customers: customers.length, vip_count: vip, total_revenue: totalSpent },
    validation_flags: validation.flags,
  })

  return {
    ok: true,
    data: {
      type:        'customer_clv',
      title_en:    'Customer Lifetime Value',
      title_ar:    'قيمة العملاء مدى الحياة',
      generatedAt: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bahrain' }),
      periodLabel: 'All time',
      filters:     { from: 'all-time', to: 'all-time', branchName: null },
      validation,
      columns_en:  ['Phone', 'Name', 'Orders', 'Total (BD)', 'Avg Order (BD)', 'First Order', 'Last Order', 'Segment'],
      columns_ar:  ['الهاتف', 'الاسم', 'الطلبات', 'الإجمالي (د.ب)', 'متوسط الطلب (د.ب)', 'أول طلب', 'آخر طلب', 'الشريحة'],
      rows,
      summary,
    },
  }
}

// ── Coupon Performance ────────────────────────────────────────────────────────

async function buildCouponPerformance(
  userId: string,
): Promise<ActionResult<ReportResult>> {
  const [validation, coupons] = await Promise.all([
    validateCouponData(),
    getCouponAnalytics(),
  ])

  const rows: (string | number)[][] = coupons.map((c) => [
    c.code,
    c.type,
    c.campaign_name ?? '—',
    c.usage_count,
    Number(c.revenue_with_coupon.toFixed(3)),
    Number(c.total_discount_given.toFixed(3)),
    Number(c.net_revenue.toFixed(3)),
    c.roi_percent !== null ? `${c.roi_percent.toFixed(1)}%` : '—',
  ])

  const totalRevenue  = coupons.reduce((s, c) => s + c.revenue_with_coupon,  0)
  const totalDiscount = coupons.reduce((s, c) => s + c.total_discount_given, 0)
  const totalUses     = coupons.reduce((s, c) => s + c.usage_count,          0)

  const summary: ReportSummaryItem[] = [
    { label_en: 'Total Coupons',     label_ar: 'إجمالي الكوبونات',    value: String(coupons.length)                            },
    { label_en: 'Active Coupons',    label_ar: 'كوبونات نشطة',        value: String(coupons.filter((c) => c.is_active).length) },
    { label_en: 'Total Uses',        label_ar: 'مرات الاستخدام',      value: String(totalUses)                                 },
    { label_en: 'Revenue Generated', label_ar: 'إيرادات الكوبونات',   value: `BD ${formatCurrency(totalRevenue)}`              },
    { label_en: 'Total Discount',    label_ar: 'إجمالي الخصومات',     value: `BD ${formatCurrency(totalDiscount)}`             },
    { label_en: 'Net Revenue',       label_ar: 'الصافي',               value: `BD ${formatCurrency(totalRevenue - totalDiscount)}` },
  ]

  await logReport({
    report_name:      'Coupon Performance',
    report_type:      'coupon_performance',
    generated_by:     userId,
    filters:          { from: 'all-time', to: 'all-time' },
    row_count:        rows.length,
    data_snapshot:    { total_coupons: coupons.length, total_uses: totalUses, total_revenue: totalRevenue },
    validation_flags: validation.flags,
  })

  return {
    ok: true,
    data: {
      type:        'coupon_performance',
      title_en:    'Coupon Performance',
      title_ar:    'أداء الكوبونات',
      generatedAt: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bahrain' }),
      periodLabel: 'All time',
      filters:     { from: 'all-time', to: 'all-time', branchName: null },
      validation,
      columns_en:  ['Code', 'Type', 'Campaign', 'Uses', 'Revenue (BD)', 'Discount (BD)', 'Net (BD)', 'ROI %'],
      columns_ar:  ['الكود', 'النوع', 'الحملة', 'الاستخدامات', 'الإيراد (د.ب)', 'الخصم (د.ب)', 'الصافي (د.ب)', 'العائد %'],
      rows,
      summary,
    },
  }
}

// ── Operational Summary ───────────────────────────────────────────────────────

async function buildOperationalSummary(
  filters: ReportFiltersInput,
  userId:  string,
): Promise<ActionResult<ReportResult>> {
  const from = new Date(`${filters.from}T00:00:00+03:00`)
  const to   = new Date(`${filters.to}T23:59:59+03:00`)

  const [hourly, ops] = await Promise.all([
    getHourlyDistribution(),
    getOperationalMetrics(from, to, filters.branchId),
  ])

  const rows: (string | number)[][] = hourly.map((r) => {
    const h = r.hour_of_day
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`
    return [
      `${String(h).padStart(2, '0')}:00  ${label}`,
      r.order_count,
      Number(r.total_revenue_bhd.toFixed(3)),
      Number(r.avg_order_value_bhd.toFixed(3)),
    ]
  })

  const peakRow = hourly.length
    ? hourly.reduce((p, r) => r.order_count > p.order_count ? r : p)
    : null
  const peakLabel = peakRow ? `${String(peakRow.hour_of_day).padStart(2, '0')}:00` : '—'
  const avgFulMsg = ops.avgFulfillmentMinutes > 0
    ? `${Math.round(ops.avgFulfillmentMinutes)} min`
    : 'No data yet'

  const summary: ReportSummaryItem[] = [
    { label_en: 'Total Orders',      label_ar: 'إجمالي الطلبات',    value: String(ops.totalOrders)                 },
    { label_en: 'Cancelled',         label_ar: 'طلبات ملغاة',       value: String(ops.cancelledOrders)             },
    { label_en: 'Cancellation Rate', label_ar: 'معدل الإلغاء',      value: `${ops.cancellationRate.toFixed(1)}%`   },
    { label_en: 'Avg Fulfillment',   label_ar: 'متوسط وقت التنفيذ', value: avgFulMsg                               },
    { label_en: 'Peak Hour',         label_ar: 'ذروة الطلبات',      value: peakLabel                               },
    { label_en: 'Peak Hour Orders',  label_ar: 'طلبات في الذروة',   value: String(peakRow?.order_count ?? 0)       },
  ]

  await logReport({
    report_name:      'Operational Summary',
    report_type:      'operational_summary',
    generated_by:     userId,
    filters,
    row_count:        rows.length,
    data_snapshot:    { total_orders: ops.totalOrders, cancellation_rate: ops.cancellationRate },
    validation_flags: [],
  })

  return {
    ok: true,
    data: {
      type:        'operational_summary',
      title_en:    'Operational Summary',
      title_ar:    'ملخص العمليات',
      generatedAt: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bahrain' }),
      periodLabel: buildPeriodLabel(filters),
      filters:     { ...filters, branchName: null },
      validation:  {
        valid:       true,
        flags:       [],
        rowCount:    rows.length,
        dataSource:  'orders + hourly_order_distribution',
      },
      columns_en:  ['Hour', 'Orders', 'Revenue (BD)', 'Avg Order (BD)'],
      columns_ar:  ['الساعة', 'الطلبات', 'الإيراد (د.ب)', 'متوسط الطلب (د.ب)'],
      rows,
      summary,
    },
  }
}
