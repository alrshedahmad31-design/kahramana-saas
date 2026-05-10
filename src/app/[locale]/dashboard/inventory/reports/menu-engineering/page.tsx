import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getActiveBranches } from '@/lib/branches/queries'
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
  const t = await getTranslations({ locale, namespace: 'inventory.reports.menuEngineering' })
  const sp = await searchParams
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const period = Number(sp.period ?? 30)
  const supabase = await createClient()

  const branches = await getActiveBranches()

  const branchId = isGlobal
    ? (sp.branch ?? branches?.[0]?.id ?? '')
    : (user.branch_id ?? '')

  if (!branchId) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <ReportHeader title={t('title')} />
        <EmptyReport
          title={t('noBranch')}
          description={t('selectBranch')}
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <ReportHeader
        title={t('title')}
        description={t('desc')}
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm hover:shadow-md transition-all">
        {isGlobal && (
          <select
            name="branch"
            defaultValue={branchId}
            className={`rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 ${font} text-xs text-brand-text focus:border-brand-gold focus:outline-none min-w-[180px] transition-colors`}
          >
            {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{isAr ? b.name_ar : b.name_en}</option>)}
          </select>
        )}
        
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('period')}</label>
          <div className="flex bg-brand-surface-2 p-1 rounded-lg border border-brand-border gap-1">
            {PERIOD_OPTIONS.map((p) => (
              <a
                key={p}
                href={`?period=${p}${branchId ? `&branch=${branchId}` : ''}`}
                className={`rounded-md px-3 py-1 font-satoshi text-[10px] font-black transition-all ${period === p ? 'bg-brand-gold text-brand-black shadow-sm' : 'text-brand-muted hover:text-brand-gold'}`}
              >
                {p}D
              </a>
            ))}
          </div>
        </div>

        {isGlobal && (
          <button type="submit" className={`ms-auto rounded-lg bg-brand-gold px-4 py-1.5 ${font} text-xs font-black text-brand-black hover:bg-brand-gold/90 transition-all shadow-sm active:scale-95`}>
            {isAr ? 'تحديث' : 'Update'}
          </button>
        )}
      </form>

      {error && (
        <div className="rounded-xl border border-brand-error/20 bg-brand-error/5 p-4 animate-in slide-in-from-top-2">
          <p className={`${font} text-xs font-bold text-brand-error`}>{error.message}</p>
        </div>
      )}

      {safeRows.length === 0 ? (
        <EmptyReport
          title={t('noData')}
          description={t('noSalesDesc')}
        />
      ) : (
        <MenuEngineeringMatrix rows={safeRows} />
      )}
    </div>
  )
}
