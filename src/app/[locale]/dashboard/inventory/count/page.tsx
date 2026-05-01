import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CountApproveButton from './CountApproveButton'
import { approveCountSession } from './actions'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string }>
}

export default async function CountPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = session.role === 'owner' || session.role === 'general_manager'
  const canApprove = ['owner', 'general_manager', 'branch_manager'].includes(session.role ?? '')

  const supabase = await createClient()

  let query = supabase
    .from('inventory_counts')
    .select(
      'count_session, branch_id, counted_at, approved_by, ingredient_id, variance, variance_pct, branch:branches(name_ar)',
    )
    .order('counted_at', { ascending: false })

  if (!isGlobal) {
    query = query.eq('branch_id', session.branch_id ?? '')
  }

  const { data: rawRows } = await query

  // Group by count_session
  type CountRow = {
    count_session: string
    branch_id: string
    counted_at: string
    approved_by: string | null
    ingredient_id: string
    variance: number | null
    variance_pct: number | null
    branch: { name_ar: string } | null
  }

  const rows = (rawRows ?? []) as CountRow[]

  const sessionMap = new Map<
    string,
    {
      count_session: string
      branch_id: string
      branch_name: string
      counted_at: string
      items: number
      totalVariance: number
      isApproved: boolean
    }
  >()

  for (const row of rows) {
    const key = `${row.count_session}::${row.branch_id}`
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        count_session: row.count_session,
        branch_id:     row.branch_id,
        branch_name:   (row.branch as { name_ar: string } | null)?.name_ar ?? row.branch_id,
        counted_at:    row.counted_at,
        items:         0,
        totalVariance: 0,
        isApproved:    false,
      })
    }
    const s = sessionMap.get(key)!
    s.items += 1
    s.totalVariance += Math.abs(row.variance ?? 0)
    if (row.approved_by) s.isApproved = true
  }

  const sessions = [...sessionMap.values()].sort(
    (a, b) => new Date(b.counted_at).getTime() - new Date(a.counted_at).getTime(),
  )

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'جرد المخزون' : 'Inventory Count'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? 'جلسات الجرد والمطابقة' : 'Count sessions and reconciliation'}
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/inventory/count/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
        >
          {isAr ? '+ جرد جديد' : '+ New Count'}
        </Link>
      </div>

      {/* Sessions table */}
      <div className="border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-brand-surface-2">
            <tr>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الجلسة' : 'Session'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الفرع' : 'Branch'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'العناصر' : 'Items'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'مجموع الفروقات' : 'Total Variance'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'التاريخ' : 'Date'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الحالة' : 'Status'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'إجراء' : 'Action'}
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center font-satoshi text-sm text-brand-muted">
                  {isAr ? 'لا توجد جلسات جرد' : 'No count sessions found'}
                </td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr
                key={`${s.count_session}::${s.branch_id}`}
                className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`${prefix}/dashboard/inventory/count/session/${encodeURIComponent(s.count_session)}`}
                    className="font-satoshi text-sm text-brand-gold hover:underline"
                  >
                    {s.count_session}
                  </Link>
                </td>
                <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{s.branch_name}</td>
                <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{s.items}</td>
                <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                  {s.totalVariance.toFixed(2)}
                </td>
                <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">
                  {new Date(s.counted_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${
                      s.isApproved
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-brand-gold/10 text-brand-gold'
                    }`}
                  >
                    {s.isApproved
                      ? (isAr ? 'مُوافَق عليه' : 'Approved')
                      : (isAr ? 'بانتظار الموافقة' : 'Pending')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {!s.isApproved && canApprove && (
                    <CountApproveButton
                      sessionName={s.count_session}
                      branchId={s.branch_id}
                      locale={locale}
                      approveAction={approveCountSession}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
