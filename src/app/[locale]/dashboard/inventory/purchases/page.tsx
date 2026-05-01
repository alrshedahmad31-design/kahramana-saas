import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ status?: string; branch?: string; page?: string }>
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-brand-surface-2 text-brand-muted',
  sent:      'bg-blue-500/10 text-blue-400',
  confirmed: 'bg-brand-gold/10 text-brand-gold',
  partial:   'bg-orange-500/10 text-orange-400',
  received:  'bg-green-500/10 text-green-400',
  cancelled: 'bg-red-500/10 text-red-400',
}

const STATUS_LABEL_AR: Record<string, string> = {
  draft:     'مسودة',
  sent:      'مُرسَل',
  confirmed: 'مؤكَّد',
  partial:   'مستلم جزئياً',
  received:  'مستلم',
  cancelled: 'ملغي',
}

export default async function PurchasesPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { status, branch, page } = await searchParams
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
    .from('purchase_orders')
    .select(
      `id, branch_id, status, expected_at, is_auto_generated, created_at, notes,
       supplier:suppliers(name_ar, name_en),
       branch:branches(name_ar),
       purchase_order_items(id, quantity_ordered, unit_cost)`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, from + 19)

  if (!isGlobal) {
    query = query.eq('branch_id', session.branch_id ?? '')
  } else if (branch) {
    query = query.eq('branch_id', branch)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data: orders, count } = await query

  type POItem = { id: string; quantity_ordered: number; unit_cost: number }
  type PORow = {
    id: string
    branch_id: string
    status: string
    expected_at: string | null
    is_auto_generated: boolean | null
    created_at: string
    notes: string | null
    supplier: { name_ar: string; name_en: string | null } | null
    branch: { name_ar: string } | null
    purchase_order_items: POItem[]
  }

  const typedOrders = (orders ?? []) as PORow[]

  // Auto-generated pending POs
  const autoPending = typedOrders.filter(
    (o) => o.is_auto_generated && o.status === 'draft',
  )

  const totalPages = Math.ceil((count ?? 0) / 20)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'طلبات الشراء' : 'Purchase Orders'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? 'إدارة الموردين وطلبات الشراء' : 'Manage suppliers and purchase orders'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`${prefix}/dashboard/inventory/purchases/suppliers`}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
          >
            {isAr ? 'الموردون' : 'Suppliers'}
          </Link>
          <Link
            href={`${prefix}/dashboard/inventory/purchases/new`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
          >
            {isAr ? '+ إنشاء طلب شراء' : '+ New PO'}
          </Link>
        </div>
      </div>

      {/* Auto-generated pending box */}
      {autoPending.length > 0 && (
        <div className="rounded-xl border border-brand-gold/30 bg-brand-gold/5 px-4 py-3">
          <p className="font-satoshi text-sm font-semibold text-brand-gold mb-1">
            {isAr ? `طلبات الشراء التلقائية المعلقة (${autoPending.length})` : `Pending Auto-POs (${autoPending.length})`}
          </p>
          <p className="font-satoshi text-xs text-brand-muted">
            {isAr
              ? 'تم إنشاؤها تلقائياً بناءً على مستويات المخزون.'
              : 'Auto-generated based on inventory levels.'}
            {' '}
            <Link
              href={`${prefix}/dashboard/inventory/purchases/auto`}
              className="text-brand-gold hover:underline"
            >
              {isAr ? 'عرض الكل' : 'View all'}
            </Link>
          </p>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'draft', 'sent', 'confirmed', 'partial', 'received', 'cancelled'] as const).map(
          (s) => {
            const label = s === 'all' ? (isAr ? 'الكل' : 'All') : (isAr ? STATUS_LABEL_AR[s] : s)
            const isActive = (status ?? 'all') === s
            return (
              <Link
                key={s}
                href={`?status=${s === 'all' ? '' : s}${branch ? `&branch=${branch}` : ''}`}
                className={`inline-flex items-center px-3 py-1.5 rounded-lg font-satoshi text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/30'
                    : 'border border-brand-border text-brand-muted hover:border-brand-gold hover:text-brand-gold'
                }`}
              >
                {label}
              </Link>
            )
          },
        )}
      </div>

      {/* Table */}
      <div className="border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-brand-surface-2">
            <tr>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'رقم الطلب' : 'PO #'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'المورد' : 'Supplier'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الفرع' : 'Branch'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الحالة' : 'Status'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الأصناف' : 'Items'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الإجمالي' : 'Total'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'التسليم المتوقع' : 'Expected'}
              </th>
            </tr>
          </thead>
          <tbody>
            {typedOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center font-satoshi text-sm text-brand-muted">
                  {isAr ? 'لا توجد طلبات شراء' : 'No purchase orders'}
                </td>
              </tr>
            )}
            {typedOrders.map((po) => {
              const totalValue = po.purchase_order_items.reduce(
                (sum, item) => sum + item.quantity_ordered * item.unit_cost,
                0,
              )
              const supplier = po.supplier as { name_ar: string; name_en: string | null } | null
              const branchObj = po.branch as { name_ar: string } | null

              return (
                <tr
                  key={po.id}
                  className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`${prefix}/dashboard/inventory/purchases/${po.id}`}
                      className="font-satoshi text-sm text-brand-gold hover:underline font-mono"
                    >
                      {po.id.slice(0, 8).toUpperCase()}
                    </Link>
                    {po.is_auto_generated && (
                      <span className="ms-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-satoshi font-medium bg-brand-gold/10 text-brand-gold">
                        {isAr ? 'تلقائي' : 'Auto'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {isAr ? supplier?.name_ar : supplier?.name_en ?? supplier?.name_ar ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {branchObj?.name_ar ?? po.branch_id}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${STATUS_BADGE[po.status] ?? 'bg-brand-surface-2 text-brand-muted'}`}
                    >
                      {isAr ? STATUS_LABEL_AR[po.status] ?? po.status : po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {po.purchase_order_items.length}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {totalValue.toFixed(3)} BD
                  </td>
                  <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">
                    {po.expected_at
                      ? new Date(po.expected_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')
                      : '—'}
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
                href={`?${status ? `status=${status}&` : ''}page=${currentPage - 1}`}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                {isAr ? 'السابق' : 'Previous'}
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`?${status ? `status=${status}&` : ''}page=${currentPage + 1}`}
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
