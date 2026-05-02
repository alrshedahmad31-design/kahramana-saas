import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import type { BudgetVsActual, InventoryBudgetRow } from '@/lib/supabase/custom-types'
import BudgetProgressBar from '@/components/inventory/budget/BudgetProgressBar'
import BudgetAlertBanner from '@/components/inventory/budget/BudgetAlertBanner'
import BudgetTrendChart from '@/components/inventory/budget/BudgetTrendChart'
import BudgetSetForm from '@/components/inventory/budget/BudgetSetForm'

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

interface PageProps {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string; year?: string; month?: string }>
}

export const dynamic = 'force-dynamic'


const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default async function BudgetPage({ params, searchParams }: PageProps) {
  const { locale }                   = await params
  const { branch, year: qYear, month: qMonth } = await searchParams
  const isAr  = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const canWrite = isGlobal || user.role === 'branch_manager'

  const now       = new Date()
  const year      = qYear  ? parseInt(qYear)  : now.getFullYear()
  const month     = qMonth ? parseInt(qMonth) : now.getMonth() + 1

  const supabase = createServiceClient()

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name_ar, name_en')
    .eq('is_active', true)
    .order('name_ar')

  const activeBranchId: string | null =
    branch ?? (isGlobal ? null : (user.branch_id ?? null)) ?? (branches?.[0]?.id ?? null)

  if (!activeBranchId) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
        <p className="font-satoshi text-sm text-brand-muted">
          {isAr ? 'لا يوجد فرع محدد' : 'No branch selected'}
        </p>
      </div>
    )
  }

  // Parallel fetch: current month vs actual + full year trend
  const [vsActualRes, trendRes, budgetRowRes] = await Promise.all([
    supabase.rpc('rpc_budget_vs_actual', { p_branch_id: activeBranchId, p_year: year, p_month: month }),
    supabase.rpc('rpc_budget_trend',     { p_branch_id: activeBranchId, p_year: year }),
    supabase.from('inventory_budgets')
      .select('*')
      .eq('branch_id', activeBranchId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
  ])

  const vsActual = (vsActualRes.data?.[0] ?? null) as BudgetVsActual | null
  const trend    = (trendRes.data ?? []) as BudgetVsActual[]
  const budgetRow = (budgetRowRes.data ?? null) as InventoryBudgetRow | null

  const monthName = isAr ? MONTHS_AR[month - 1] : MONTHS_EN[month - 1]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'ميزانية المخزون' : 'Inventory Budget'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? `${monthName} ${year}` : `${monthName} ${year}`}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Branch selector */}
          {isGlobal && branches && branches.length > 1 && (
            <form method="GET" className="flex gap-2">
              <input type="hidden" name="year"  value={year} />
              <input type="hidden" name="month" value={month} />
              <select
                name="branch"
                defaultValue={activeBranchId}
                className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
              >
                {branches.map((b: { id: string; name_ar: string; name_en: string | null }) => (
                  <option key={b.id} value={b.id}>{isAr ? b.name_ar : (b.name_en ?? b.name_ar)}</option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-brand-surface-2 px-3 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors">
                {isAr ? 'تطبيق' : 'Apply'}
              </button>
            </form>
          )}

          {/* Month/year navigation */}
          <form method="GET" className="flex gap-2">
            <input type="hidden" name="branch" value={activeBranchId} />
            <select
              name="month"
              defaultValue={month}
              className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{isAr ? MONTHS_AR[m - 1] : MONTHS_EN[m - 1]}</option>
              ))}
            </select>
            <input
              name="year"
              type="number"
              defaultValue={year}
              className="w-20 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
              dir="ltr"
            />
            <button type="submit" className="rounded-lg bg-brand-surface-2 px-3 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors">
              {isAr ? 'عرض' : 'View'}
            </button>
          </form>
        </div>
      </div>

      {/* Alert banner (over budget) */}
      {vsActual && (
        <BudgetAlertBanner
          spendVariance={Number(vsActual.spend_variance_bhd)}
          wasteVariance={Number(vsActual.waste_variance_bhd)}
          isAr={isAr}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: progress bars */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* KPI strip */}
          {vsActual && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
                  <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الإنفاق الفعلي' : 'Actual Spend'}</p>
                  <p className="font-cairo text-xl font-black text-brand-gold mt-1">{Number(vsActual.actual_spend_bhd).toFixed(3)}</p>
                  <p className="font-satoshi text-xs text-brand-muted">BD</p>
                </div>
                <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
                  <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'تكلفة الطعام' : 'Food Cost %'}</p>
                  <p className={`font-cairo text-xl font-black mt-1 ${Number(vsActual.actual_food_cost_pct) > Number(vsActual.food_cost_target_pct) ? 'text-red-400' : 'text-brand-gold'}`}>
                    {Number(vsActual.actual_food_cost_pct).toFixed(1)}%
                  </p>
                  <p className="font-satoshi text-xs text-brand-muted">{isAr ? `الهدف: ${Number(vsActual.food_cost_target_pct).toFixed(1)}%` : `Target: ${Number(vsActual.food_cost_target_pct).toFixed(1)}%`}</p>
                </div>
                <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
                  <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الإيرادات' : 'Revenue'}</p>
                  <p className="font-cairo text-xl font-black text-brand-gold mt-1">{Number(vsActual.actual_revenue_bhd).toFixed(3)}</p>
                  <p className="font-satoshi text-xs text-brand-muted">BD</p>
                </div>
                <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
                  <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'تكلفة البضاعة' : 'COGS'}</p>
                  <p className="font-cairo text-xl font-black text-brand-gold mt-1">{Number(vsActual.actual_cogs_bhd).toFixed(3)}</p>
                  <p className="font-satoshi text-xs text-brand-muted">BD</p>
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-4">
                <h3 className="font-satoshi font-bold text-sm text-brand-text">
                  {isAr ? 'نسبة الاستخدام' : 'Budget Utilization'}
                </h3>
                <BudgetProgressBar
                  label={isAr ? 'ميزانية المشتريات' : 'Purchase Budget'}
                  used={Number(vsActual.actual_spend_bhd)}
                  budget={Number(vsActual.purchase_budget_bhd)}
                  isAr={isAr}
                />
                <BudgetProgressBar
                  label={isAr ? 'ميزانية الهدر' : 'Waste Budget'}
                  used={Number(vsActual.actual_waste_bhd)}
                  budget={Number(vsActual.waste_budget_bhd)}
                  colorClass="bg-red-500/60"
                  isAr={isAr}
                />
              </div>
            </>
          )}

          {/* Trend chart */}
          {trend.length > 0 && (
            <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
              <h3 className="font-satoshi font-bold text-sm text-brand-text mb-4">
                {isAr ? `مقارنة الميزانية بالفعلي — ${year}` : `Budget vs Actual — ${year}`}
              </h3>
              <BudgetTrendChart rows={trend} isAr={isAr} />
            </div>
          )}
        </div>

        {/* Right: set budget form */}
        {canWrite && (
          <div className="lg:col-span-1">
            <BudgetSetForm
              branchId={activeBranchId}
              year={year}
              month={month}
              existing={budgetRow ? {
                purchase_budget_bhd:  Number(budgetRow.purchase_budget_bhd),
                food_cost_target_pct: Number(budgetRow.food_cost_target_pct),
                waste_budget_bhd:     Number(budgetRow.waste_budget_bhd),
              } : undefined}
              isAr={isAr}
            />
          </div>
        )}
      </div>
    </div>
  )
}
