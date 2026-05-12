import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { requireDashboardSection, isDashboardGuardError } from '@/lib/auth/dashboard-guards'
import { getDashboardData } from '@/lib/dashboard/stats'
import {
  getMetrics,
  getOperationalMetrics,
  getBranchSummaries,
  getOrderSourceBreakdown,
  getSecondaryMetrics,
  getLaborCostMetrics,
} from '@/lib/analytics/queries'
import { BH_TIMEZONE } from '@/lib/analytics/calculations'
import { createServiceClient } from '@/lib/supabase/server'
import { HIDDEN_BRANCHES, isHiddenBranch } from '@/constants/contact'

import OwnerDashboardClient from '@/components/dashboard/owner/OwnerDashboardClient'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ locale: string }> }

// ── Bahrain-timezone period helpers ──────────────────────────────────────────
function bhDayStart(daysAgo = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const s = d.toLocaleDateString('en-CA', { timeZone: BH_TIMEZONE })
  return new Date(`${s}T00:00:00+03:00`)
}

function bhMonthStart(monthsAgo = 0): Date {
  const todayBh = new Date()
    .toLocaleDateString('en-CA', { timeZone: BH_TIMEZONE })
  const [y, m] = todayBh.split('-').map(Number)
  const target = new Date(Date.UTC(y, (m - 1) - monthsAgo, 1))
  const yy = target.getUTCFullYear()
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0')
  return new Date(`${yy}-${mm}-01T00:00:00+03:00`)
}

// ── Inline food-cost summary (mirrors reports/page.tsx; month-to-date) ───────
async function fetchFoodCostThisMonth(
  branchId: string | null,
): Promise<{ foodCostBhd: number; revenueBhd: number }> {
  const supabase = createServiceClient()
  const monthStartIso = bhMonthStart(0).toISOString()

  let foodCostQuery = supabase
    .from('inventory_movements')
    .select('unit_cost, quantity')
    .eq('movement_type', 'consumption')
    .gte('performed_at', monthStartIso)
  if (branchId) {
    foodCostQuery = foodCostQuery.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    foodCostQuery = foodCostQuery.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

  let revenueQuery = supabase
    .from('orders')
    .select('total_bhd')
    .in('status', ['delivered', 'completed'])
    .gte('created_at', monthStartIso)
  if (branchId) {
    revenueQuery = revenueQuery.eq('branch_id', branchId)
  } else if (HIDDEN_BRANCHES.length > 0) {
    revenueQuery = revenueQuery.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
  }

  const [foodCostRes, revenueRes] = await Promise.all([foodCostQuery, revenueQuery])

  const foodCostBhd = (foodCostRes.data ?? []).reduce(
    (s: number, r: { unit_cost: number | null; quantity: number }) =>
      s + Number(r.unit_cost ?? 0) * Number(r.quantity),
    0,
  )
  const revenueBhd = (revenueRes.data ?? []).reduce(
    (s: number, r: { total_bhd: number | null }) => s + Number(r.total_bhd ?? 0),
    0,
  )

  return { foodCostBhd, revenueBhd }
}

export default async function OwnerDashboardPage({ params }: Props) {
  const { locale } = await params

  let user
  try {
    user = await requireDashboardSection('owner')
  } catch (err) {
    if (isDashboardGuardError(err)) {
      redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')
    }
    throw err
  }

  const t = await getTranslations('common')
  const isAr     = locale === 'ar'
  const prefix   = locale === 'en' ? '/en' : ''
  const currency = t('currency')

  // Owner + GM can see all branches; branch_manager would be scoped (but section is owner-only)
  const branchId = user.branch_id ?? undefined

  // Period boundaries (Bahrain time)
  const todayStart   = bhDayStart(0)
  const yesterdayStart = bhDayStart(1)
  const now          = new Date()

  const weekStart    = bhDayStart(6)            // 7-day window incl. today
  const prevWeekTo   = new Date(weekStart.getTime() - 1)
  const prevWeekFrom = bhDayStart(13)

  const monthStart        = bhMonthStart(0)
  const prevMonthStart    = bhMonthStart(1)
  const prevMonthEnd      = new Date(monthStart.getTime() - 1)

  // Fetch everything in parallel
  const supabase = createServiceClient()
  const branchesPromise = supabase
    .from('branches')
    .select('id, name_ar, name_en')
    .eq('is_active', true)

  const [
    dashboard,
    metricsToday,
    metricsWeek,
    metricsMonth,
    opsToday,
    opsMonth,
    branchSummariesToday,
    branchSummariesMonth,
    orderSources,
    secondaryMonth,
    labor,
    foodCost,
    branchesRaw,
  ] = await Promise.all([
    getDashboardData(branchId ?? null),
    getMetrics(todayStart, now, yesterdayStart, todayStart, branchId),
    getMetrics(weekStart, now, prevWeekFrom, prevWeekTo, branchId),
    getMetrics(monthStart, now, prevMonthStart, prevMonthEnd, branchId),
    getOperationalMetrics(todayStart, now, branchId),
    getOperationalMetrics(monthStart, now, branchId),
    getBranchSummaries(todayStart, now),
    getBranchSummaries(monthStart, now),
    getOrderSourceBreakdown(),
    getSecondaryMetrics(monthStart, now, branchId),
    getLaborCostMetrics(monthStart, now, branchId),
    fetchFoodCostThisMonth(branchId ?? null),
    branchesPromise,
  ])

  const branches = (branchesRaw.data ?? [])
    .filter((b) => !isHiddenBranch(b.id))

  return (
    <OwnerDashboardClient
      locale={locale}
      isAr={isAr}
      prefix={prefix}
      currency={currency}
      dashboard={dashboard}
      metricsToday={metricsToday}
      metricsWeek={metricsWeek}
      metricsMonth={metricsMonth}
      opsToday={opsToday}
      opsMonth={opsMonth}
      branchSummariesToday={branchSummariesToday}
      branchSummariesMonth={branchSummariesMonth}
      orderSources={orderSources}
      secondaryMonth={secondaryMonth}
      labor={labor}
      foodCost={foodCost}
      branches={branches}
    />
  )
}
