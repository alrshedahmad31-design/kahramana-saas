import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import CountApproveButton from '../../CountApproveButton'
import { approveCountSession } from '../../actions'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

function varianceBadgeClass(pct: number | null) {
  if (pct === null) return 'text-brand-muted'
  const abs = Math.abs(pct)
  if (abs < 5) return 'text-green-400'
  if (abs < 10) return 'text-brand-gold'
  return 'text-red-400'
}

export default async function CountSessionPage({ params }: PageProps) {
  const { locale, id } = await params
  const sessionName = decodeURIComponent(id)
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const canApprove = ['owner', 'general_manager', 'branch_manager'].includes(session.role ?? '')

  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('inventory_counts')
    .select(
      `id, branch_id, ingredient_id, system_qty, actual_qty, variance, variance_pct,
       counted_by, counted_at, approved_by, count_session,
       ingredient:ingredients(name_ar, name_en, unit),
       branch:branches(name_ar),
       counter:staff_basic!inventory_counts_counted_by_fkey(name),
       approver:staff_basic!inventory_counts_approved_by_fkey(name)`,
    )
    .eq('count_session', sessionName)
    .order('ingredient_id')

  if (!rows || rows.length === 0) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
        <p className="font-satoshi text-sm text-brand-muted">
          {isAr ? 'لم يتم العثور على جلسة الجرد' : 'Count session not found'}
        </p>
      </div>
    )
  }

  type Row = {
    id: string
    branch_id: string
    ingredient_id: string
    system_qty: number
    actual_qty: number
    variance: number | null
    variance_pct: number | null
    counted_by: string
    counted_at: string
    approved_by: string | null
    count_session: string
    ingredient: { name_ar: string; name_en: string; unit: string } | null
    branch: { name_ar: string } | null
    counter: { name: string } | null
    approver: { name: string } | null
  }

  const typedRows = rows as Row[]
  const first = typedRows[0]
  const isApproved = typedRows.some((r) => r.approved_by)
  const branchId = first.branch_id

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">{sessionName}</h1>
          <div className="flex flex-wrap gap-4 mt-1">
            <p className="font-satoshi text-sm text-brand-muted">
              {isAr ? 'الفرع:' : 'Branch:'}{' '}
              <span className="text-brand-text">{(first.branch as { name_ar: string } | null)?.name_ar ?? branchId}</span>
            </p>
            <p className="font-satoshi text-sm text-brand-muted">
              {isAr ? 'التاريخ:' : 'Date:'}{' '}
              <span className="text-brand-text">
                {new Date(first.counted_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { timeZone: 'Asia/Bahrain' })}
              </span>
            </p>
            <p className="font-satoshi text-sm text-brand-muted">
              {isAr ? 'عُدَّ بواسطة:' : 'Counted by:'}{' '}
              <span className="text-brand-text">{(first.counter as { name: string } | null)?.name ?? '—'}</span>
            </p>
            {isApproved && (
              <p className="font-satoshi text-sm text-brand-muted">
                {isAr ? 'وافق عليه:' : 'Approved by:'}{' '}
                <span className="text-green-400">
                  {(typedRows.find((r) => r.approver)?.approver as { name: string } | null)?.name ?? '—'}
                </span>
              </p>
            )}
          </div>
        </div>
        {!isApproved && canApprove && (
          <CountApproveButton
            sessionName={sessionName}
            branchId={branchId}
            locale={locale}
            approveAction={approveCountSession}
          />
        )}
      </div>

      {/* Status badge */}
      <div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-satoshi font-medium ${
            isApproved
              ? 'bg-green-500/10 text-green-400'
              : 'bg-brand-gold/10 text-brand-gold'
          }`}
        >
          {isApproved ? (isAr ? 'مُوافَق عليه' : 'Approved') : (isAr ? 'بانتظار الموافقة' : 'Pending Approval')}
        </span>
      </div>

      {/* Table */}
      <div className="border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-brand-surface-2">
            <tr>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'المكوّن' : 'Ingredient'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'نظام' : 'System'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'فعلي' : 'Actual'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الفرق' : 'Variance'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'نسبة الفرق' : 'Variance %'}
              </th>
            </tr>
          </thead>
          <tbody>
            {typedRows.map((row) => {
              const ingr = row.ingredient as { name_ar: string; name_en: string; unit: string } | null
              const variance = row.variance ?? (row.actual_qty - row.system_qty)
              return (
                <tr key={row.id} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {isAr ? ingr?.name_ar : ingr?.name_en ?? ingr?.name_ar}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                    {row.system_qty} {ingr?.unit}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {row.actual_qty} {ingr?.unit}
                  </td>
                  <td className={`px-4 py-3 font-satoshi text-sm font-semibold ${varianceBadgeClass(row.variance_pct)}`}>
                    {variance >= 0 ? '+' : ''}{variance.toFixed(2)} {ingr?.unit}
                  </td>
                  <td className={`px-4 py-3 font-satoshi text-sm font-semibold ${varianceBadgeClass(row.variance_pct)}`}>
                    {row.variance_pct !== null
                      ? `${row.variance_pct >= 0 ? '+' : ''}${row.variance_pct.toFixed(1)}%`
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
