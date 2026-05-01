import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { ExpiryReportRow } from '@/lib/supabase/custom-types'
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
  const sp = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const days = Number(sp.days ?? 7)
  const supabase = await createClient()

  const { data: branches } = await supabase.from('branches').select('id, name_ar').eq('is_active', true)
  const branchId = isGlobal
    ? (sp.branch ?? branches?.[0]?.id ?? '')
    : (user.branch_id ?? '')

  if (!branchId) {
    return (
      <div className="space-y-6">
        <ReportHeader title={isAr ? 'تقرير الصلاحية' : 'Expiry Report'} locale={locale} />
        <EmptyReport title={isAr ? 'لا يوجد فرع' : 'No branch'} description={isAr ? 'الرجاء اختيار فرع' : 'Please select a branch'} />
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
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'تقرير الصلاحية' : 'Expiry Report'}
        description={isAr ? `المخزون المنتهي والقريب من الانتهاء خلال ${days} يوماً` : `Expired and expiring stock within ${days} days`}
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
          {DAYS_OPTIONS.map((d) => (
            <a
              key={d}
              href={`?days=${d}${branchId ? `&branch=${branchId}` : ''}`}
              className={`rounded-lg px-3 py-1.5 font-satoshi text-xs font-medium transition-colors ${days === d ? 'bg-brand-gold text-brand-black' : 'border border-brand-border text-brand-muted hover:border-brand-gold hover:text-brand-gold'}`}
            >
              {d}d
            </a>
          ))}
        </div>
        {isGlobal && (
          <button type="submit" className="rounded-lg bg-brand-gold px-4 py-1.5 font-satoshi text-xs font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors">
            {isAr ? 'تطبيق' : 'Apply'}
          </button>
        )}
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label={isAr ? 'قيمة المخزون المعرّض للخطر' : 'At-Risk Value'} value={`BD ${atRiskValue.toFixed(3)}`} highlight trend={atRiskValue > 0 ? 'down' : 'neutral'} />
        <StatCard label={isAr ? 'منتهية الصلاحية' : 'Expired'} value={expiredCount} trend={expiredCount > 0 ? 'down' : 'neutral'} />
      </div>

      {safeRows.length === 0 ? (
        <EmptyReport
          title={isAr ? 'لا توجد أصناف قريبة من الانتهاء' : 'No expiring items'}
          description={isAr ? `لا توجد أصناف تنتهي خلال ${days} يوماً` : `No items expiring within ${days} days`}
        />
      ) : (
        <div className="space-y-4">
          {(Object.entries(grouped) as [ExpiryGroup, ExpiryReportRow[]][]).map(([group, items]) => {
            if (items.length === 0) return null
            const labels = GROUP_LABELS[group]
            return (
              <div key={group} className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-3 border-b border-brand-border`}>
                  <h3 className={`font-cairo text-sm font-black ${labels.headerClass}`}>
                    {isAr ? labels.ar : labels.en} ({items.length})
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border bg-brand-surface-2">
                      <th className="px-4 py-2 text-start font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                      <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'الكمية' : 'Qty'}</th>
                      <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'تاريخ الانتهاء' : 'Expires'}</th>
                      <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'الأيام المتبقية' : 'Days Left'}</th>
                      <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'القيمة BD' : 'Value BD'}</th>
                      <th className="px-4 py-2 text-center font-satoshi text-xs font-semibold text-brand-muted">{isAr ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, i) => (
                      <tr key={i} className={`border-b border-brand-border/30 hover:bg-brand-surface-2 transition-colors ${labels.rowClass}`}>
                        <td className="px-4 py-2 font-satoshi text-brand-text">{r.name_ar}</td>
                        <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-muted">{Number(r.quantity_remaining ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-2 text-end font-satoshi text-xs text-brand-muted">
                          {r.expires_at ? new Date(r.expires_at).toLocaleDateString('ar-IQ') : '—'}
                        </td>
                        <td className={`px-4 py-2 text-end font-satoshi tabular-nums font-semibold ${(r.days_remaining ?? 1) <= 0 ? 'text-brand-error' : (r.days_remaining ?? 99) <= 3 ? 'text-brand-gold' : 'text-brand-muted'}`}>
                          {r.days_remaining ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-error font-semibold">
                          {Number(r.stock_value_bhd ?? 0).toFixed(3)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Link
                            href={`${prefix}/dashboard/inventory/waste/new?ingredient_id=${r.ingredient_id}&quantity=${r.quantity_remaining}`}
                            className="inline-flex rounded-lg border border-brand-border px-2 py-1 font-satoshi text-xs text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
                          >
                            {isAr ? 'تسجيل هدر' : 'Log Waste'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
