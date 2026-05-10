import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getActiveBranches } from '@/lib/branches/queries'
import { translateUnit } from '@/lib/inventory/units'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
const DAYS_OPTIONS = [3, 7, 14, 30]

type ExpiryGroup = 'expired' | 'today' | 'week' | 'later'

function groupRows(rows: ExpiryReportRow[]): Record<ExpiryGroup, ExpiryReportRow[]> {
  return {
    expired:  rows.filter((r) => (r.days_remaining ?? 1) <= 0),
    today:    rows.filter((r) => (r.days_remaining ?? -1) > 0 && (r.days_remaining ?? -1) <= 1),
    week:     rows.filter((r) => (r.days_remaining ?? -1) > 1 && (r.days_remaining ?? -1) <= 7),
    later:    rows.filter((r) => (r.days_remaining ?? -1) > 7),
  }
}

const GROUP_LABELS: Record<ExpiryGroup, { ar: string; en: string; rowClass: string; headerClass: string }> = {
  expired: { ar: 'منتهي الصلاحية',  en: 'Expired',    rowClass: 'bg-brand-error/5', headerClass: 'text-brand-error border-brand-error/30' },
  today:   { ar: 'ينتهي اليوم',     en: 'Expiring Today', rowClass: 'bg-brand-gold/5', headerClass: 'text-brand-gold border-brand-gold/30' },
  week:    { ar: 'خلال أسبوع',      en: 'This Week',  rowClass: '', headerClass: 'text-brand-text border-brand-border' },
  later:   { ar: 'لاحقاً',          en: 'Later',      rowClass: '', headerClass: 'text-brand-muted border-brand-border' },
}

export default async function ExpiryReportPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'inventory.reports.expiry' })
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
  const days = Number(sp.days ?? 7)
  const supabase = await createClient()
  const branches = await getActiveBranches()
  const branchId = isGlobal
    ? (sp.branch ?? branches?.[0]?.id ?? '')
    : (user.branch_id ?? '')

  if (!branchId) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <ReportHeader title={t('title')} locale={locale} />
        <EmptyReport title={t('noBranch')} description={t('selectBranch')} />
      </div>
    )
  }

  const { data: rows } = await supabase.rpc('rpc_expiry_report', {
    p_branch_id: branchId,
    p_days_ahead: days,
  })

  const safeRows = (rows ?? []) as ExpiryReportRow[]
  const grouped = groupRows(safeRows)

  const atRiskValue = safeRows.reduce((s, r) => s + Number(r.stock_value_bhd ?? 0), 0)
  const expiredCount = grouped.expired.length

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ReportHeader
        title={t('title')}
        description={t('desc', { days })}
        locale={locale}
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
          <label className={`${font} text-xs text-brand-muted font-bold uppercase tracking-wider`}>{t('period')}</label>
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
        <StatCard label={t('atRiskValue')} value={`${atRiskValue.toFixed(3)} ${currency}`} highlight />
        <StatCard label={t('expired')} value={expiredCount.toString()} trend={expiredCount > 0 ? 'down' : 'neutral'} />
      </div>

      {safeRows.length === 0 ? (
        <EmptyReport
          title={t('noExpiring')}
          description={t('noExpiringDesc', { days })}
        />
      ) : (
        <div className="space-y-8">
          {(Object.entries(grouped) as [string, any[]][]).map(([group, items]) => {
            if (items.length === 0) return null
            
            return (
              <div key={group} className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border bg-brand-surface-2">
                  <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text uppercase tracking-wider flex items-center gap-2`}>
                    <span className={`w-2 h-2 rounded-full ${group === 'expired' ? 'bg-brand-error animate-pulse' : group === 'today' ? 'bg-brand-error' : group === 'week' ? 'bg-brand-gold' : 'bg-brand-success'}`} />
                    {t(`groupLabels.${group}`)} ({items.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-start">
                    <thead>
                      <tr className="bg-brand-surface-2/30">
                        <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('ingredient')}</th>
                        <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('qty')}</th>
                        <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('expires')}</th>
                        <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('daysLeft')}</th>
                        <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('valueBd')} ({currency})</th>
                        <th className={`px-5 py-3 text-center ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border/30">
                      {items.map((r, i) => (
                        <tr key={i} className="hover:bg-brand-surface-2 transition-colors group">
                          <td className={`px-5 py-3 ${font} text-sm font-bold text-brand-text group-hover:text-brand-gold transition-colors`}>{isAr ? r.name_ar : r.name_en}</td>
                          <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                            {Number(r.quantity_remaining ?? 0).toFixed(2)}
                            <span className={`${font} text-[10px] ms-1 text-brand-muted/70 font-medium`}>{translateUnit(r.unit ?? '', isAr)}</span>
                          </td>
                          <td className={`px-5 py-3 text-end ${font} text-xs text-brand-muted font-bold`}>
                            {r.expires_at ? new Date(r.expires_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB') : '—'}
                          </td>
                          <td className={`px-5 py-3 text-end font-satoshi text-sm font-black tabular-nums ${(r.days_remaining ?? 0) <= 0 ? 'text-brand-error' : (r.days_remaining ?? 0) <= 7 ? 'text-brand-gold' : 'text-brand-success'}`}>
                            {r.days_remaining ?? '—'}
                          </td>
                          <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-gold tabular-nums">{Number(r.stock_value_bhd ?? 0).toFixed(3)}</td>
                          <td className="px-5 py-3 text-center">
                            <Link
                              href={`${prefix}/dashboard/inventory/waste/new?ingredient_id=${r.ingredient_id}&quantity=${r.quantity_remaining}`}
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
