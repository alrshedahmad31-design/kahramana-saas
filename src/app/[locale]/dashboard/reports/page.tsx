import { redirect } from 'next/navigation'
import Link         from 'next/link'
import { getSession } from '@/lib/auth/session'
import { canAccessReports } from '@/lib/auth/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import ReportsClient from './ReportsClient'
import type { DishCogsRow } from '@/lib/supabase/custom-types'

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export const dynamic = 'force-dynamic'

interface InventorySummary {
  thisMonthFoodCostBhd: number
  thisMonthRevenueBhd:  number
  thisMonthWasteBhd:    number
  topCostDrivers:       Pick<DishCogsRow, 'name_ar' | 'name_en' | 'cost_bhd' | 'margin_pct'>[]
}

async function fetchInventorySummary(branchId: string | null): Promise<InventorySummary> {
  const supabase = await createServiceClient()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bahrain',
  }).format(new Date())
  const [bahrainYear, bahrainMonth] = today.split('-')
  const monthStartIso = `${bahrainYear}-${bahrainMonth}-01T00:00:00+03:00`

  let foodCostQuery = supabase
    .from('inventory_movements')
    .select('unit_cost, quantity')
    .eq('movement_type', 'consumption')
    .gte('performed_at', monthStartIso)
  if (branchId) foodCostQuery = foodCostQuery.eq('branch_id', branchId)

  let wasteQuery = supabase
    .from('waste_log')
    .select('cost_bhd')
    .not('approved_by', 'is', null)
    .gte('reported_at', monthStartIso)
  if (branchId) wasteQuery = wasteQuery.eq('branch_id', branchId)

  let revenueQuery = supabase
    .from('orders')
    .select('total_bhd')
    .in('status', ['delivered', 'completed'])
    .gte('created_at', monthStartIso)
  if (branchId) revenueQuery = revenueQuery.eq('branch_id', branchId)

  const cogsQuery = supabase
    .from('v_dish_cogs')
    .select('slug, name_ar, name_en, cost_bhd, margin_pct')
    .order('cost_bhd', { ascending: false })
    .limit(3)

  const [foodCostRes, wasteRes, revenueRes, cogsRes] = await Promise.all([
    foodCostQuery, wasteQuery, revenueQuery, cogsQuery,
  ])

  const foodCostBhd = (foodCostRes.data ?? []).reduce(
    (s: number, r: { unit_cost: number | null; quantity: number }) => s + (r.unit_cost ?? 0) * r.quantity,
    0,
  )
  const wasteBhd = (wasteRes.data ?? []).reduce(
    (s: number, r: { cost_bhd: number | null }) => s + (r.cost_bhd ?? 0),
    0,
  )
  const revenueBhd = (revenueRes.data ?? []).reduce(
    (s: number, r: { total_bhd: number }) => s + r.total_bhd,
    0,
  )
  const topCostDrivers = ((cogsRes.data ?? []) as unknown as DishCogsRow[]).map(r => ({
    name_ar:    r.name_ar,
    name_en:    r.name_en,
    cost_bhd:   r.cost_bhd,
    margin_pct: r.margin_pct,
  }))

  return { thisMonthFoodCostBhd: foodCostBhd, thisMonthRevenueBhd: revenueBhd, thisMonthWasteBhd: wasteBhd, topCostDrivers }
}

function marginColor(pct: number | null) {
  if (pct === null) return 'text-brand-muted'
  if (pct >= 60) return 'text-brand-success'
  if (pct >= 40) return 'text-brand-gold'
  return 'text-red-400'
}

export default async function ReportsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams
  const isAr       = locale === 'ar'
  const prefix     = locale === 'en' ? '/en' : ''
  const currency   = isAr ? 'د.ب' : 'BD'

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessReports(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const isGlobal   = user.role === 'owner' || user.role === 'general_manager'
  const branchId   = isGlobal ? null : (user.branch_id ?? null)
  const inventory  = await fetchInventorySummary(branchId)
  const foodCostPct = inventory.thisMonthRevenueBhd > 0
    ? (inventory.thisMonthFoodCostBhd / inventory.thisMonthRevenueBhd) * 100
    : null

  return (
    <div className="flex flex-col gap-6">
      {/* ── Inventory Summary ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider">
            {isAr ? 'ملخص المخزون — هذا الشهر' : 'Inventory Summary — This Month'}
          </h2>
          <Link
            href={`${prefix}/dashboard/inventory/reports`}
            className="font-satoshi text-xs text-brand-gold hover:text-brand-goldLight transition-colors duration-150"
          >
            {isAr ? 'تقارير المخزون الكاملة ←' : 'Full inventory reports →'}
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
          {/* Food Cost % */}
          <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3">
            <p className="font-satoshi text-xs text-brand-muted mb-1">
              {isAr ? 'نسبة تكلفة الطعام' : 'Food Cost %'}
            </p>
            <p className={`font-satoshi font-black text-2xl tabular-nums ${foodCostPct === null ? 'text-brand-muted' : foodCostPct > 35 ? 'text-red-400' : 'text-brand-success'}`}>
              {foodCostPct !== null ? `${foodCostPct.toFixed(1)}%` : '—'}
            </p>
          </div>

          {/* Waste cost */}
          <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3">
            <p className="font-satoshi text-xs text-brand-muted mb-1">
              {isAr ? 'تكلفة الهدر' : 'Waste Cost'}
            </p>
            <p className="font-satoshi font-black text-2xl tabular-nums text-red-400">
              {inventory.thisMonthWasteBhd.toFixed(3)}
              <span className="text-xs font-medium text-brand-muted ms-1">{currency}</span>
            </p>
          </div>

          {/* Food cost absolute */}
          <div className="rounded-lg border border-brand-border bg-brand-surface-2 p-3">
            <p className="font-satoshi text-xs text-brand-muted mb-1">
              {isAr ? 'تكلفة الطعام' : 'Food Cost'}
            </p>
            <p className="font-satoshi font-black text-2xl tabular-nums text-brand-gold">
              {inventory.thisMonthFoodCostBhd.toFixed(3)}
              <span className="text-xs font-medium text-brand-muted ms-1">{currency}</span>
            </p>
          </div>
        </div>

        {/* Top 3 cost drivers */}
        {inventory.topCostDrivers.length > 0 && (
          <div>
            <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wider mb-2">
              {isAr ? 'أكبر 3 عوامل تكلفة' : 'Top 3 Cost Drivers'}
            </p>
            <div className="flex flex-col gap-2">
              {inventory.topCostDrivers.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-brand-border last:border-0">
                  <span className="font-satoshi text-sm text-brand-text truncate">
                    {isAr ? d.name_ar : d.name_en}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-satoshi text-xs tabular-nums text-brand-gold">
                      {d.cost_bhd.toFixed(3)} {currency}
                    </span>
                    {d.margin_pct !== null && (
                      <span className={`font-satoshi text-xs tabular-nums ${marginColor(d.margin_pct)}`}>
                        {d.margin_pct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Main reports client ───────────────────────────────────────────────── */}
      <ReportsClient
        locale={locale}
        initialRange={sp.range ?? '30d'}
        initialFrom={sp.from}
        initialTo={sp.to}
      />
    </div>
  )
}
