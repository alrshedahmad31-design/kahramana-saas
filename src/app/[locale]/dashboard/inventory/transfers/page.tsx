import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TransferPageClient from './TransferPageClient'
import { createTransfer } from './actions'

// Branch IDs are UUIDs. Anything else is rejected before being interpolated
// into the PostgREST .or() expression — the DSL is parsed server-side and
// raw input would let a caller widen the predicate.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string; status?: string; page?: string }>
}

export default async function TransfersPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { branch, status, page } = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const isGlobal = session.role === 'owner' || session.role === 'general_manager'
  const supabase = await createClient()

  const currentPage = Number(page ?? 1)
  const from = (currentPage - 1) * 20

  let query = supabase
    .from('inventory_transfers')
    .select(
      `id, quantity, status, transferred_at, received_at, notes,
       from_branch:branches!inventory_transfers_from_branch_id_fkey(name_ar),
       to_branch:branches!inventory_transfers_to_branch_id_fkey(name_ar),
       ingredient:ingredients(name_ar, unit),
       transferred_by_staff:staff_basic!inventory_transfers_transferred_by_fkey(name)`,
      { count: 'exact' },
    )
    .order('transferred_at', { ascending: false })
    .range(from, from + 19)

  if (!isGlobal) {
    // session.branch_id is server-derived, but assert UUID shape anyway so a
    // future regression that lets a non-UUID value reach here can't break
    // out of the .or() expression.
    const sBranch = session.branch_id && UUID_RE.test(session.branch_id) ? session.branch_id : null
    if (sBranch) {
      query = query.or(
        `from_branch_id.eq.${sBranch},to_branch_id.eq.${sBranch}`,
      )
    } else {
      // Scoped role without a branch must see nothing rather than everything.
      query = query.eq('from_branch_id', '00000000-0000-0000-0000-000000000000')
    }
  } else if (branch && UUID_RE.test(branch)) {
    query = query.or(`from_branch_id.eq.${branch},to_branch_id.eq.${branch}`)
  }

  // Allowlist of legal status enum values — anything else is dropped so it
  // can't be used to inject DSL via .eq() (.eq accepts arbitrary strings).
  const STATUS_ALLOWED = new Set(['pending', 'in_transit', 'received', 'cancelled'])
  if (status && STATUS_ALLOWED.has(status)) {
    query = query.eq('status', status)
  }

  const { data: transfers, count } = await query

  const { getActiveBranches } = await import('@/lib/branches/queries')
  // Fetch branches and stock for the transfer form
  const [branches, { data: stock }] = await Promise.all([
    getActiveBranches(),
    supabase.from('inventory_stock').select('branch_id, ingredient_id, on_hand'),
  ])

  // Build stockByBranch map
  type StockRow = { branch_id: string; ingredient_id: string; on_hand: number }
  const stockByBranch: Record<string, Record<string, number>> = {}
  for (const s of (stock ?? []) as StockRow[]) {
    if (!stockByBranch[s.branch_id]) stockByBranch[s.branch_id] = {}
    stockByBranch[s.branch_id][s.ingredient_id] = s.on_hand
  }

  // Fetch ingredients
  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name_ar, unit')
    .eq('is_active', true)
    .order('name_ar')

  const totalPages = Math.ceil((count ?? 0) / 20)

  const STATUS_BADGE: Record<string, string> = {
    pending:    'bg-brand-gold/10 text-brand-gold',
    in_transit: 'bg-blue-500/10 text-blue-400',
    received:   'bg-green-500/10 text-green-400',
    cancelled:  'bg-red-500/10 text-red-400',
  }

  const STATUS_LABEL_AR: Record<string, string> = {
    pending:    'قيد الانتظار',
    in_transit: 'في الطريق',
    received:   'مستلم',
    cancelled:  'ملغي',
  }

  const STATUS_LABEL_EN: Record<string, string> = {
    pending:    'Pending',
    in_transit: 'In transit',
    received:   'Received',
    cancelled:  'Cancelled',
  }

  const STATUS_LABEL = isAr ? STATUS_LABEL_AR : STATUS_LABEL_EN

  type TransferRow = {
    id: string
    quantity: number
    status: string
    transferred_at: string
    received_at: string | null
    notes: string | null
    from_branch: { name_ar: string } | null
    to_branch: { name_ar: string } | null
    ingredient: { name_ar: string; unit: string } | null
    transferred_by_staff: { name: string } | null
  }

  const typedTransfers = (transfers ?? []) as TransferRow[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'التحويلات بين الفروع' : 'Branch Transfers'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? 'تحويل المواد بين الفروع' : 'Transfer ingredients between branches'}
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'in_transit', 'received', 'cancelled'] as const).map((s) => {
          const label = s === 'all' ? (isAr ? 'الكل' : 'All') : (STATUS_LABEL[s] ?? s)
          const isActive = (status ?? 'all') === s
          return (
            <Link
              key={s}
              href={`?status=${s === 'all' ? '' : s}`}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg font-satoshi text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/30'
                  : 'border border-brand-border text-brand-muted hover:border-brand-gold hover:text-brand-gold'
              }`}
            >
              {label}
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
                {isAr ? 'من ← إلى' : 'From → To'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'المكوّن' : 'Ingredient'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الكمية' : 'Qty'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الحالة' : 'Status'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'المحوِّل' : 'Transferred By'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'التاريخ' : 'Date'}
              </th>
            </tr>
          </thead>
          <tbody>
            {typedTransfers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-satoshi text-sm text-brand-muted">
                  {isAr ? 'لا توجد تحويلات' : 'No transfers'}
                </td>
              </tr>
            )}
            {typedTransfers.map((t) => {
              const fromB = t.from_branch as { name_ar: string } | null
              const toB   = t.to_branch as { name_ar: string } | null
              const ingr  = t.ingredient as { name_ar: string; unit: string } | null
              const staff = t.transferred_by_staff as { name: string } | null
              return (
                <tr key={t.id} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    <span>{fromB?.name_ar ?? '—'}</span>
                    <span className="mx-1 text-brand-muted">{isAr ? '←' : '→'}</span>
                    <span>{toB?.name_ar ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {ingr?.name_ar ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {t.quantity} {ingr?.unit}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${STATUS_BADGE[t.status] ?? 'bg-brand-surface-2 text-brand-muted'}`}
                    >
                      {isAr ? STATUS_LABEL_AR[t.status] ?? t.status : t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                    {staff?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">
                    {new Date(t.transferred_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')}
                  </td>
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
                href={`?page=${currentPage - 1}`}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                {isAr ? 'السابق' : 'Previous'}
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`?page=${currentPage + 1}`}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                {isAr ? 'التالي' : 'Next'}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Transfer form modal trigger (client component) */}
      <TransferPageClient
        branches={branches ?? []}
        ingredients={(ingredients ?? []) as Array<{ id: string; name_ar: string; unit: string }>}
        stockByBranch={stockByBranch}
        defaultFromBranch={!isGlobal ? (session.branch_id ?? undefined) : undefined}
        locale={locale}
        action={createTransfer}
      />
    </div>
  )
}
