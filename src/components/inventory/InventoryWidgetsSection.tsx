import { createServiceClient } from '@/lib/supabase/server'
import LowStockWidget      from './LowStockWidget'
import ExpiryCalendarWidget from './ExpiryCalendarWidget'
import WasteEscalationWidget from './WasteEscalationWidget'
import StockValueWidget    from './StockValueWidget'
import type { LowStockAlert, ExpiryReportRow, InventoryValuationRow } from '@/lib/supabase/custom-types'

interface Props {
  branchId: string | null
  isGlobal: boolean
  prefix:   string
  isAr:     boolean
  currency: string
}

interface DailyPoint {
  date:  string
  value: number
}

async function fetchInventoryDashboardData(branchId: string | null) {
  const supabase = await createServiceClient()

  // Build parallel promises — skip branch-specific queries when no branchId
  const lowStockPromise = branchId
    ? supabase.rpc('rpc_low_stock_alerts', { p_branch_id: branchId })
    : Promise.resolve({ data: [] as LowStockAlert[], error: null })

  const expiryPromise = branchId
    ? supabase.rpc('rpc_expiry_report', { p_branch_id: branchId, p_days_ahead: 7 })
    : Promise.resolve({ data: [] as ExpiryReportRow[], error: null })

  const wasteQuery = supabase
    .from('waste_log')
    .select('escalation_level')
    .is('approved_by', null)
    .is('rejected_by', null)

  const wastePromise = branchId
    ? wasteQuery.eq('branch_id', branchId)
    : wasteQuery

  const valuationQuery = supabase
    .from('v_inventory_valuation')
    .select('branch_id, branch_name, category, ingredient_count, total_value_bhd, reserved_value_bhd')
    .order('total_value_bhd', { ascending: false })

  const valuationPromise = branchId
    ? valuationQuery.eq('branch_id', branchId)
    : valuationQuery

  // Trend: daily purchase totals last 14 days
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const trendQuery = supabase
    .from('inventory_movements')
    .select('performed_at, unit_cost, quantity')
    .eq('movement_type', 'purchase')
    .gte('performed_at', twoWeeksAgo.toISOString())

  const trendPromise = branchId
    ? trendQuery.eq('branch_id', branchId)
    : trendQuery

  const [lowStockRes, expiryRes, wasteRes, valuationRes, trendRes] = await Promise.all([
    lowStockPromise,
    expiryPromise,
    wastePromise,
    valuationPromise,
    trendPromise,
  ])

  const lowStockItems = (lowStockRes.data ?? []) as LowStockAlert[]
  const expiryItems   = (expiryRes.data ?? [])   as ExpiryReportRow[]

  // Count waste by escalation level
  const wasteCounts = { level_0: 0, level_1: 0, level_2: 0 }
  for (const row of (wasteRes.data ?? []) as Array<{ escalation_level: number }>) {
    if (row.escalation_level === 0) wasteCounts.level_0++
    else if (row.escalation_level === 1) wasteCounts.level_1++
    else if (row.escalation_level === 2) wasteCounts.level_2++
  }

  // Group valuation by branch
  const valuationMap = new Map<string, InventoryValuationRow>()
  for (const row of (valuationRes.data ?? []) as InventoryValuationRow[]) {
    const existing = valuationMap.get(row.branch_id)
    if (existing) {
      existing.total_value_bhd    += row.total_value_bhd
      existing.reserved_value_bhd += row.reserved_value_bhd
      existing.ingredient_count   += row.ingredient_count
    } else {
      valuationMap.set(row.branch_id, { ...row })
    }
  }
  const valuations = Array.from(valuationMap.values())

  // Build 14-day trend from purchases
  const trendByDate = new Map<string, number>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    trendByDate.set(d.toLocaleDateString('en-CA'), 0)
  }
  for (const mv of (trendRes.data ?? []) as Array<{ performed_at: string; unit_cost: number | null; quantity: number }>) {
    const key = new Date(mv.performed_at).toLocaleDateString('en-CA')
    if (trendByDate.has(key)) {
      trendByDate.set(key, (trendByDate.get(key) ?? 0) + (mv.unit_cost ?? 0) * mv.quantity)
    }
  }
  const trendPoints: DailyPoint[] = Array.from(trendByDate.entries()).map(([date, value]) => ({ date, value }))

  // Food cost today: consumption movements today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const foodCostQuery = supabase
    .from('inventory_movements')
    .select('unit_cost, quantity')
    .eq('movement_type', 'consumption')
    .gte('performed_at', todayStart.toISOString())

  const { data: foodCostRows } = branchId
    ? await foodCostQuery.eq('branch_id', branchId)
    : await foodCostQuery

  const foodCostToday = (foodCostRows ?? []).reduce(
    (s: number, r: { unit_cost: number | null; quantity: number }) => s + (r.unit_cost ?? 0) * r.quantity,
    0,
  )
  const totalStockValue = valuations.reduce((s, v) => s + v.total_value_bhd, 0)

  return { lowStockItems, expiryItems, wasteCounts, valuations, trendPoints, foodCostToday, totalStockValue }
}

export default async function InventoryWidgetsSection({ branchId, prefix, isAr, currency }: Props) {
  const { lowStockItems, expiryItems, wasteCounts, valuations, trendPoints, foodCostToday, totalStockValue } =
    await fetchInventoryDashboardData(branchId)

  return (
    <div className="flex flex-col gap-4">
      {/* Inventory KPI strip */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-brand-border bg-gradient-to-br from-brand-surface to-brand-surface-2 p-4 flex flex-col gap-1">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
            {isAr ? 'تكلفة الطعام اليوم' : "Today's Food Cost"}
          </p>
          <p className="font-satoshi font-black text-2xl text-brand-gold tabular-nums leading-none">
            {foodCostToday.toFixed(3)}
            <span className="text-xs font-medium text-brand-muted ms-1">{currency}</span>
          </p>
        </div>
        <div className="rounded-xl border border-brand-border bg-gradient-to-br from-brand-surface to-brand-surface-2 p-4 flex flex-col gap-1">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
            {isAr ? 'قيمة المخزون' : 'Stock Value'}
          </p>
          <p className="font-satoshi font-black text-2xl text-brand-gold tabular-nums leading-none">
            {totalStockValue.toFixed(3)}
            <span className="text-xs font-medium text-brand-muted ms-1">{currency}</span>
          </p>
        </div>
      </div>

      {/* 2×2 widget grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LowStockWidget      items={lowStockItems}  prefix={prefix} locale={isAr ? 'ar' : 'en'} />
        <ExpiryCalendarWidget rows={expiryItems}    prefix={prefix} isAr={isAr} />
        <WasteEscalationWidget counts={wasteCounts}  prefix={prefix} isAr={isAr} />
        <StockValueWidget    valuations={valuations} trendPoints={trendPoints} currency={currency} isAr={isAr} />
      </div>
    </div>
  )
}
