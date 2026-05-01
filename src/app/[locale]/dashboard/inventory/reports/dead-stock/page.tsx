import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'

interface DeadStockRow {
  ingredient_id: string
  name_ar: string
  name_en: string
  on_hand: number
  last_movement_at: string | null
  days_inactive: number
  stock_value_bhd: number
}
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import DeadStockBarChart from './DeadStockChart'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
const DAYS_OPTIONS = [14, 30, 60, 90]

export default async function DeadStockPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const days = Number(sp.days ?? 30)
  const supabase = await createClient()

  const { data: branches } = await supabase.from('branches').select('id, name_ar').eq('is_active', true)
  const branchId = isGlobal
    ? (sp.branch ?? branches?.[0]?.id ?? '')
    : (user.branch_id ?? '')

  if (!branchId) {
    return (
      <div className="space-y-6">
        <ReportHeader title={isAr ? 'المخزون الراكد' : 'Dead Stock'} locale={locale} />
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
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'المخزون الراكد' : 'Dead Stock Report'}
        description={isAr ? `أصناف لم تتحرك خلال ${days} يوماً` : `Items with no movement in ${days} days`}
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
          <label className="font-satoshi text-xs text-brand-muted">{isAr ? 'عدم الحركة:' : 'No movement:'}</label>
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
        <StatCard label={isAr ? 'قيمة المخزون الراكد' : 'Dead Stock Value'} value={`BD ${totalValue.toFixed(3)}`} highlight trend={totalValue > 0 ? 'down' : 'neutral'} />
        <StatCard label={isAr ? 'عدد الأصناف' : 'Item Count'} value={safeRows.length} />
      </div>

      {safeRows.length === 0 ? (
        <EmptyReport
          title={isAr ? 'لا يوجد مخزون راكد' : 'No dead stock'}
          description={isAr ? `لا توجد أصناف بدون حركة خلال ${days} يوماً` : `No items without movement in ${days} days`}
        />
      ) : (
        <>
          {chartData.length > 0 && <DeadStockBarChart data={chartData} />}

          <div className="overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface-2">
                  <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                  <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الكمية' : 'On Hand'}</th>
                  <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'آخر حركة' : 'Last Move'}</th>
                  <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'أيام الركود' : 'Days Inactive'}</th>
                  <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'القيمة BD' : 'Value BD'}</th>
                  <th className="px-4 py-3 text-center font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {safeRows.map((r) => (
                  <tr key={r.ingredient_id} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-3 font-satoshi text-brand-text">{r.name_ar}</td>
                    <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{Number(r.on_hand).toFixed(2)}</td>
                    <td className="px-4 py-3 text-end font-satoshi text-xs text-brand-muted">
                      {r.last_movement_at ? new Date(r.last_movement_at).toLocaleDateString('ar-IQ') : '—'}
                    </td>
                    <td className={`px-4 py-3 text-end font-satoshi tabular-nums font-semibold ${r.days_inactive > 60 ? 'text-brand-error' : 'text-brand-gold'}`}>
                      {r.days_inactive}
                    </td>
                    <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-error font-semibold">
                      {Number(r.stock_value_bhd).toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`${prefix}/dashboard/inventory/waste/new?ingredient_id=${r.ingredient_id}&quantity=${r.on_hand}`}
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
        </>
      )}
    </div>
  )
}
