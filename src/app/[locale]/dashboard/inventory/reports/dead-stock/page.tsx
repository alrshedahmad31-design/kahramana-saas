import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getActiveBranches } from '@/lib/branches/queries'
import { translateUnit } from '@/lib/inventory/units'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import DeadStockBarChart from './DeadStockChart'

interface DeadStockRow {
  ingredient_id: string
  name_ar: string
  name_en: string
  unit: string | null
  on_hand: number
  last_movement_at: string | null
  days_inactive: number
  stock_value_bhd: number
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
const DAYS_OPTIONS = [14, 30, 60, 90]

export default async function DeadStockPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'inventory.reports.deadStock' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const sp = await searchParams
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const days = Number(sp.days ?? 30)
  const supabase = await createClient()

  const branches = await getActiveBranches()
  const branchId = isGlobal
    ? (sp.branch ?? branches?.[0]?.id ?? '')
    : (user.branch_id ?? '')

  if (!branchId) {
    return (
      <div className="space-y-6">
        <ReportHeader title={isAr ? 'المخزون الراكد' : 'Dead Stock'} />
        <EmptyReport title={isAr ? 'لا يوجد فرع' : 'No branch'} description={isAr ? 'الرجاء اختيار فرع' : 'Please select a branch'} />
      </div>
    )
  }

  const { data: rows } = await supabase.rpc('rpc_dead_stock_report', {
    p_branch_id: branchId,
    p_days_no_move: days,
  })

  const safeRows = (rows ?? []) as DeadStockRow[]
  const totalValue = safeRows.reduce((s, r) => s + Number(r.stock_value_bhd ?? 0), 0)

  const chartData = [...safeRows]
    .sort((a, b) => Number(b.stock_value_bhd) - Number(a.stock_value_bhd))
    .slice(0, 10)
    .map((r) => ({ name: r.name_ar, value: Number(r.stock_value_bhd) }))

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ReportHeader
        title={t('title')}
        description={t('desc', { days })}
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm hover:shadow-md transition-all">
        {isGlobal && (
          <select
            name="branch"
            defaultValue={branchId}
            className={`rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 ${font} text-xs text-brand-text focus:border-brand-gold focus:outline-none min-w-[200px] transition-colors`}
          >
            {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{isAr ? b.name_ar : b.name_en}</option>)}
          </select>
        )}
        <div className="flex items-center gap-3">
          <label className={`${font} text-xs text-brand-muted font-bold uppercase tracking-wider`}>{t('noMovement')}</label>
          <div className="flex gap-1">
            {DAYS_OPTIONS.map((d) => (
              <a
                key={d}
                href={`?days=${d}${isGlobal ? `&branch=${branchId}` : ''}`}
                className={`rounded-lg px-3 py-1.5 font-satoshi text-xs font-black transition-all ${days === d ? 'bg-brand-gold text-brand-black shadow-md' : 'border border-brand-border text-brand-muted hover:border-brand-gold hover:text-brand-gold'}`}
              >
                {d}d
              </a>
            ))}
          </div>
        </div>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label={t('totalValue')} value={`${totalValue.toFixed(3)} ${currency}`} highlight />
        <StatCard label={t('itemCount')} value={safeRows.length.toString()} />
      </div>

      {safeRows.length === 0 ? (
        <EmptyReport
          title={t('emptyTitle')}
          description={t('emptyDesc', { days })}
        />
      ) : (
        <>
          {chartData.length > 0 && <DeadStockBarChart data={chartData} />}

          <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface shadow-sm hover:shadow-md transition-all">
            <table className="w-full text-start">
              <thead>
                <tr className="bg-brand-surface-2">
                  <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('ingredient')}</th>
                  <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('onHand')}</th>
                  <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('lastMove')}</th>
                  <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('daysInactive')}</th>
                  <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('valueBd')} ({currency})</th>
                  <th className={`px-5 py-3 text-center ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/30">
                {safeRows.map((r) => (
                  <tr key={r.ingredient_id} className="hover:bg-brand-surface-2 transition-colors group">
                    <td className={`px-5 py-3 ${font} text-sm font-bold text-brand-text group-hover:text-brand-gold transition-colors`}>{isAr ? r.name_ar : r.name_en}</td>
                    <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                      {Number(r.on_hand).toFixed(2)} 
                      <span className={`${font} text-[10px] ms-1 text-brand-muted/70 font-medium`}>{translateUnit(r.unit ?? '', isAr)}</span>
                    </td>
                    <td className={`px-5 py-3 text-end ${font} text-xs text-brand-muted`}>
                      {r.last_movement_at ? new Date(r.last_movement_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB') : '—'}
                    </td>
                    <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-error tabular-nums">{r.days_inactive}</td>
                    <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-gold tabular-nums">{Number(r.stock_value_bhd).toFixed(3)}</td>
                    <td className="px-5 py-3 text-center">
                      <Link
                        href={`${prefix}/dashboard/inventory/waste/new?ingredient_id=${r.ingredient_id}&quantity=${r.on_hand}`}
                        className={`${font} text-[10px] font-black uppercase tracking-widest text-brand-gold hover:text-brand-gold/80 transition-colors bg-brand-surface border border-brand-border/50 px-3 py-1 rounded-md shadow-sm`}
                      >
                        {t('logWaste')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
