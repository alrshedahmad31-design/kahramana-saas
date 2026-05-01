import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import MenuEngineeringMatrix from './MenuEngineeringMatrix'

interface MenuEngineeringRow {
  menu_item_slug: string
  name_ar: string
  name_en: string
  total_sold: number
  revenue_bhd: number
  cost_bhd: number
  profit_bhd: number
  margin_pct: number | null
  ideal_cost_pct: number | null
  is_above_ideal_cost: boolean
  category: string
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
const PERIOD_OPTIONS = [7, 14, 30, 60, 90]

export default async function MenuEngineeringPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const period = Number(sp.period ?? 30)
  const supabase = await createClient()

  const { data: branches } = await supabase.from('branches').select('id, name_ar').eq('is_active', true)

  const branchId = isGlobal
    ? (sp.branch ?? branches?.[0]?.id ?? '')
    : (user.branch_id ?? '')

  if (!branchId) {
    return (
      <div className="space-y-6">
        <ReportHeader title={isAr ? 'هندسة القائمة' : 'Menu Engineering'} locale={locale} />
        <EmptyReport
          title={isAr ? 'لا يوجد فرع محدد' : 'No branch selected'}
          description={isAr ? 'الرجاء اختيار فرع لعرض هندسة القائمة' : 'Please select a branch to view menu engineering'}
        />
      </div>
    )
  }

  const { data: rows, error } = await supabase.rpc('rpc_menu_engineering', {
    p_branch_id: branchId,
    p_period_days: period,
  })

  const safeRows = (rows ?? []) as MenuEngineeringRow[]

  return (
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'هندسة القائمة' : 'Menu Engineering'}
        description={isAr ? 'مصفوفة Stars/Puzzles/Plowhorses/Dogs' : 'Stars / Puzzles / Plowhorses / Dogs matrix'}
        locale={locale}
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-4">
        {isGlobal && (
          <select
            name="branch"
            defaultValue={branchId}
            className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none"
          >
            {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2">
          <label className="font-satoshi text-xs text-brand-muted">{isAr ? 'الفترة:' : 'Period:'}</label>
          {PERIOD_OPTIONS.map((p) => (
            <a
              key={p}
              href={`?period=${p}${branchId ? `&branch=${branchId}` : ''}`}
              className={`rounded-lg px-3 py-1.5 font-satoshi text-xs font-medium transition-colors ${period === p ? 'bg-brand-gold text-brand-black' : 'border border-brand-border text-brand-muted hover:border-brand-gold hover:text-brand-gold'}`}
            >
              {p}d
            </a>
          ))}
        </div>
        {isGlobal && (
          <button type="submit" className="rounded-lg bg-brand-gold px-4 py-1.5 font-satoshi text-xs font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors">
            {isAr ? 'تطبيق' : 'Apply'}
          </button>
        )}
      </form>

      {error && (
        <div className="rounded-xl border border-brand-error bg-brand-error/10 px-4 py-3">
          <p className="font-satoshi text-sm text-brand-error">{error.message}</p>
        </div>
      )}

      {safeRows.length === 0 ? (
        <EmptyReport
          title={isAr ? 'لا توجد بيانات' : 'No data'}
          description={isAr ? 'لا توجد مبيعات مسجّلة في هذه الفترة' : 'No sales recorded for this period'}
        />
      ) : (
        <MenuEngineeringMatrix rows={safeRows} />
      )}
    </div>
  )
}
