import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { approveWaste, rejectWaste } from './actions'
import WasteActionButtons from './WasteActionButtons'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ status?: string; branch?: string; reason?: string; page?: string }>
}

function getReasonLabel(reason: string, isAr: boolean): string {
  const ar: Record<string, string> = {
    expired:         'منتهي الصلاحية',
    damaged:         'تالف',
    spillage:        'انسكاب',
    overproduction:  'إنتاج زائد',
    quality:         'جودة سيئة',
    returned:        'مُرجَّع',
    theft_suspected: 'شبهة سرقة',
    prep_error:      'خطأ في التحضير',
    over_portioning: 'إفراط في التقديم',
    other:           'أخرى',
  }
  const en: Record<string, string> = {
    expired:         'Expired',
    damaged:         'Damaged',
    spillage:        'Spillage',
    overproduction:  'Overproduction',
    quality:         'Poor Quality',
    returned:        'Returned',
    theft_suspected: 'Theft Suspected',
    prep_error:      'Prep Error',
    over_portioning: 'Over-portioning',
    other:           'Other',
  }
  return (isAr ? ar : en)[reason] ?? reason
}

function escalationBadge(level: number) {
  if (level === 3) return 'bg-brand-surface-2 text-brand-muted line-through'
  if (level === 2) return 'bg-red-500/10 text-red-400'
  if (level === 1) return 'bg-brand-gold/10 text-brand-gold'
  return 'bg-brand-surface-2 text-brand-muted'
}

function escalationLabel(level: number, isAr: boolean): string {
  if (level === 3) return isAr ? 'مغلق تلقائياً'       : 'Auto-closed'
  if (level === 2) return isAr ? 'مُصعَّد للمالك'      : 'Escalated to owner'
  if (level === 1) return isAr ? 'مُصعَّد للمدير العام' : 'Escalated to GM'
  return isAr ? 'مستوى المدير' : 'Branch level'
}

export default async function WastePage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { status = 'all', branch, page } = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const isGlobal = session.role === 'owner' || session.role === 'general_manager'
  const canApprove = ['owner', 'general_manager', 'branch_manager'].includes(session.role ?? '')

  const supabase = await createClient()
  const currentPage = Number(page ?? 1)
  const from = (currentPage - 1) * 20

  let query = supabase
    .from('waste_log')
    .select(
      `id, branch_id, quantity, reason, cost_bhd, escalation_level,
       reported_by, reported_at, approved_by, approved_at,
       rejected_by, rejected_at, rejection_note,
       ingredient:ingredients(name_ar, name_en, unit),
       reporter:staff_basic!waste_log_reported_by_fkey(name)`,
      { count: 'exact' },
    )
    .order('reported_at', { ascending: false })
    .range(from, from + 19)

  if (!isGlobal) {
    query = query.eq('branch_id', session.branch_id ?? '')
  } else if (branch) {
    query = query.eq('branch_id', branch)
  }

  if (status === 'pending') {
    query = query.is('approved_by', null).is('rejected_by', null)
  } else if (status === 'approved') {
    query = query.not('approved_by', 'is', null)
  } else if (status === 'rejected') {
    query = query.not('rejected_by', 'is', null)
  }

  const { data: wastes, count } = await query

  // I3 FIX: KPI totals from full DB queries, not from the paginated 20-row subset.
  const today      = new Date().toISOString().split('T')[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ data: todayRows }, { data: monthRows }] = await Promise.all([
    supabase.from('waste_log').select('cost_bhd').gte('reported_at', today),
    supabase.from('waste_log').select('cost_bhd').gte('reported_at', monthStart),
  ])

  const todayCost = todayRows?.reduce((s, r) => s + Number(r.cost_bhd), 0) ?? 0
  const monthCost = monthRows?.reduce((s, r) => s + Number(r.cost_bhd), 0) ?? 0

  const pendingCount = (wastes ?? []).filter(
    (w) => !w.approved_by && !w.rejected_by,
  ).length

  const totalPages = Math.ceil((count ?? 0) / 20)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'سجل الهدر' : 'Waste Log'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? 'متابعة وإدارة هدر المخزون' : 'Track and manage inventory waste'}
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/inventory/waste/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
        >
          {isAr ? '+ تسجيل هدر' : '+ Log Waste'}
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'بانتظار الموافقة' : 'Pending Approval'}
          </p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1">{pendingCount}</p>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'تكلفة اليوم' : "Today's Cost"}
          </p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1">
            {todayCost.toFixed(3)} BD
          </p>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'تكلفة الشهر' : 'Month Cost'}
          </p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1">
            {monthCost.toFixed(3)} BD
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => {
          const labels: Record<string, string> = {
            all: isAr ? 'الكل' : 'All',
            pending: isAr ? 'بانتظار الموافقة' : 'Pending',
            approved: isAr ? 'موافق عليه' : 'Approved',
            rejected: isAr ? 'مرفوض' : 'Rejected',
          }
          const isActive = status === s
          return (
            <Link
              key={s}
              href={`?status=${s}${branch ? `&branch=${branch}` : ''}`}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg font-satoshi text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/30'
                  : 'border border-brand-border text-brand-muted hover:border-brand-gold hover:text-brand-gold'
              }`}
            >
              {labels[s]}
            </Link>
          )
        })}
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
                {isAr ? 'الكمية' : 'Qty'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'السبب' : 'Reason'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'التكلفة' : 'Cost'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'التصعيد' : 'Escalation'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'المبلّغ' : 'Reporter'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الوقت' : 'Time'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الحالة' : 'Status'}
              </th>
              {canApprove && (
                <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                  {isAr ? 'إجراء' : 'Action'}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {(wastes ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={canApprove ? 9 : 8}
                  className="px-4 py-8 text-center font-satoshi text-sm text-brand-muted"
                >
                  {isAr ? 'لا توجد سجلات' : 'No records found'}
                </td>
              </tr>
            )}
            {(wastes ?? []).map((w) => {
              const isPending = !w.approved_by && !w.rejected_by
              const ingr = w.ingredient as { name_ar: string; name_en: string; unit: string } | null
              const reporter = w.reporter as { name: string } | null
              const statusKey = !w.approved_by && !w.rejected_by
                ? 'pending'
                : w.approved_by
                  ? 'approved'
                  : 'rejected'
              const statusBadge = {
                pending:  'bg-brand-gold/10 text-brand-gold',
                approved: 'bg-green-500/10 text-green-400',
                rejected: 'bg-red-500/10 text-red-400',
              }[statusKey]
              const statusLabel = {
                pending:  isAr ? 'بانتظار الموافقة' : 'Pending',
                approved: isAr ? 'موافق عليه' : 'Approved',
                rejected: isAr ? 'مرفوض' : 'Rejected',
              }[statusKey]

              return (
                <tr
                  key={w.id}
                  className={`border-t border-brand-border hover:bg-brand-surface-2 transition-colors ${
                    isPending ? 'ring-1 ring-inset ring-brand-gold/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {isAr ? ingr?.name_ar : ingr?.name_en ?? ingr?.name_ar}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {w.quantity} {ingr?.unit ?? ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium bg-brand-surface-2 text-brand-text">
                      {getReasonLabel(w.reason, isAr)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {(w.cost_bhd ?? 0).toFixed(3)} BD
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${escalationBadge(w.escalation_level ?? 0)}`}
                    >
                      {escalationLabel(w.escalation_level ?? 0, isAr)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                    {reporter?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">
                    {w.reported_at ? new Date(w.reported_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${statusBadge}`}>
                      {statusLabel}
                    </span>
                  </td>
                  {canApprove && (
                    <td className="px-4 py-3">
                      {isPending && (
                        <WasteActionButtons
                          id={w.id}
                          locale={locale}
                          approveAction={approveWaste}
                          rejectAction={rejectWaste}
                        />
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-satoshi text-sm text-brand-muted">
            {isAr
              ? `${from + 1}–${Math.min(from + 20, count ?? 0)} من ${count}`
              : `${from + 1}–${Math.min(from + 20, count ?? 0)} of ${count}`}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`?status=${status}&page=${currentPage - 1}`}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                {isAr ? 'السابق' : 'Previous'}
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`?status=${status}&page=${currentPage + 1}`}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                {isAr ? 'التالي' : 'Next'}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
