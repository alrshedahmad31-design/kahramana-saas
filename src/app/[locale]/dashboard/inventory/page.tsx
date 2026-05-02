import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type {
  LowStockAlert,
  ExpiryReportRow,
  InventoryAlertRow,
  InventoryStockRow,
} from '@/lib/supabase/custom-types'
import LowStockWidget from '@/components/inventory/LowStockWidget'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function severityBadge(severity: string) {
  if (severity === 'critical') return 'bg-red-500/10 text-red-400'
  if (severity === 'warning') return 'bg-brand-gold/10 text-brand-gold'
  return 'bg-brand-gold/10 text-brand-gold'
}

export default async function InventoryOverviewPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { branch } = await searchParams
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)

  const roleAllowed = ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])
  if (!roleAllowed) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'

  const supabase = await createClient()

  // Fetch branches list (for global selector)
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name_ar, name_en')
    .eq('is_active', true)
    .order('name_ar')

  // Determine active branch
  const activeBranchId = branch ?? branches?.[0]?.id ?? null

  // Parallel fetches
  const [
    lowStockResult,
    expiryResult,
    alertsResult,
    stockResult,
    wasteResult,
  ] = await Promise.all([
    activeBranchId
      ? supabase.rpc('rpc_low_stock_alerts', { p_branch_id: activeBranchId }).limit(10)
      : Promise.resolve({ data: [] as LowStockAlert[], error: null }),
    activeBranchId
      ? supabase.rpc('rpc_expiry_report', { p_branch_id: activeBranchId, p_days_ahead: 7 })
      : Promise.resolve({ data: [] as ExpiryReportRow[], error: null }),
    supabase
      .from('inventory_alerts')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10),
    activeBranchId
      ? supabase
          .from('inventory_stock')
          .select('on_hand, ingredient:ingredients(cost_per_unit)')
          .eq('branch_id', activeBranchId)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    supabase
      .from('waste_log')
      .select('id')
      .is('approved_by', null),
  ])

  const lowStockItems = (lowStockResult.data ?? []) as LowStockAlert[]
  const expiryItems = (expiryResult.data ?? []) as ExpiryReportRow[]
  const alerts = (alertsResult.data ?? []) as InventoryAlertRow[]
  const stockRows = (stockResult.data ?? []) as Array<{ on_hand: number; ingredient: { cost_per_unit: number } | null }>
  const pendingWasteCount = (wasteResult.data ?? []).length

  // Calculate total stock value
  const totalStockValue = stockRows.reduce((sum, row) => {
    const cost = row.ingredient?.cost_per_unit ?? 0
    return sum + row.on_hand * cost
  }, 0)

  const lowStockCount = lowStockItems.length
  const expiringCount = expiryItems.filter((e) => e.days_remaining <= 7).length

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'إدارة المخزون' : 'Inventory Management'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? 'نظرة شاملة على مخزون المطعم' : 'Full overview of restaurant stock'}
          </p>
        </div>

        {/* Branch selector (global only) */}
        {isGlobal && branches && branches.length > 1 && (
          <form method="GET">
            <select
              name="branch"
              defaultValue={activeBranchId ?? ''}
              onChange={(e) => { /* handled by form submit */ }}
              className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.name_ar : (b.name_en ?? b.name_ar)}
                </option>
              ))}
            </select>
            <button type="submit" className="ms-2 rounded-lg bg-brand-surface-2 px-3 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors">
              {isAr ? 'تطبيق' : 'Apply'}
            </button>
          </form>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'قيمة المخزون' : 'Stock Value'}
          </p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1">
            {totalStockValue.toFixed(3)}
          </p>
          <p className="font-satoshi text-xs text-brand-muted mt-0.5">BD</p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'مخزون منخفض' : 'Low Stock'}
          </p>
          <p className={`font-cairo text-2xl font-black mt-1 ${lowStockCount > 0 ? 'text-red-400' : 'text-brand-text'}`}>
            {lowStockCount}
          </p>
          <p className="font-satoshi text-xs text-brand-muted mt-0.5">
            {isAr ? 'مكوّن' : 'ingredients'}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'تنتهي صلاحيتها' : 'Expiring Soon'}
          </p>
          <p className={`font-cairo text-2xl font-black mt-1 ${expiringCount > 0 ? 'text-brand-gold' : 'text-brand-text'}`}>
            {expiringCount}
          </p>
          <p className="font-satoshi text-xs text-brand-muted mt-0.5">
            {isAr ? 'خلال 7 أيام' : 'within 7 days'}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">
            {isAr ? 'هدر بانتظار الموافقة' : 'Pending Waste'}
          </p>
          <p className={`font-cairo text-2xl font-black mt-1 ${pendingWasteCount > 0 ? 'text-brand-gold' : 'text-brand-text'}`}>
            {pendingWasteCount}
          </p>
          <p className="font-satoshi text-xs text-brand-muted mt-0.5">
            {isAr ? 'سجل هدر' : 'waste logs'}
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: `${prefix}/dashboard/inventory/ingredients`, label: isAr ? 'المكونات' : 'Ingredients' },
          { href: `${prefix}/dashboard/inventory/prep-items`, label: isAr ? 'Prep Items' : 'Prep Items' },
          { href: `${prefix}/dashboard/inventory/recipes`, label: isAr ? 'الوصفات' : 'Recipes' },
          { href: `${prefix}/dashboard/inventory/stock`, label: isAr ? 'المخزون' : 'Stock Levels' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-center rounded-xl border border-brand-border bg-brand-surface p-4 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>

      {/* Low Stock Widget */}
      {lowStockItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-cairo text-lg font-black text-brand-text">
              {isAr ? 'مخزون منخفض' : 'Low Stock Alert'}
            </h2>
            <Link
              href={`${prefix}/dashboard/inventory/stock`}
              className="font-satoshi text-sm text-brand-gold hover:underline"
            >
              {isAr ? 'عرض الكل' : 'View All'}
            </Link>
          </div>
          <LowStockWidget items={lowStockItems.slice(0, 5)} locale={locale} prefix={prefix} />
        </div>
      )}

      {/* Expiry Alerts */}
      {expiryItems.length > 0 && (
        <div>
          <h2 className="font-cairo text-lg font-black text-brand-text mb-3">
            {isAr ? 'تنبيهات انتهاء الصلاحية' : 'Expiry Alerts'}
          </h2>
          <div className="border border-brand-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-surface-2">
                <tr>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'المكوّن' : 'Ingredient'}</th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الكمية' : 'Qty'}</th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'تاريخ الانتهاء' : 'Expires'}</th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الأيام المتبقية' : 'Days Left'}</th>
                </tr>
              </thead>
              <tbody>
                {expiryItems.map((item) => (
                  <tr
                    key={item.lot_id}
                    className={`border-t border-brand-border hover:bg-brand-surface-2 transition-colors
                      ${item.days_remaining <= 1 ? 'bg-red-500/5' : item.days_remaining <= 3 ? 'bg-brand-gold/5' : ''}`}
                  >
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{isAr ? item.name_ar : item.name_en}</td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{item.quantity_remaining}</td>
                    <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                      {new Date(item.expires_at).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium
                        ${item.days_remaining <= 1 ? 'bg-red-500/10 text-red-400' : item.days_remaining <= 3 ? 'bg-brand-gold/10 text-brand-gold' : 'bg-brand-gold/10 text-brand-gold'}`}>
                        {item.days_remaining} {isAr ? 'يوم' : 'days'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerts Feed */}
      {alerts.length > 0 && (
        <div>
          <h2 className="font-cairo text-lg font-black text-brand-text mb-3">
            {isAr ? 'تنبيهات المخزون' : 'Inventory Alerts'}
          </h2>
          <div className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-xl border border-brand-border bg-brand-surface p-4"
              >
                <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${severityBadge(alert.severity)}`}>
                  {alert.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-satoshi text-sm text-brand-text">{alert.message}</p>
                  <p className="font-satoshi text-xs text-brand-muted mt-0.5">{formatDate(alert.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

