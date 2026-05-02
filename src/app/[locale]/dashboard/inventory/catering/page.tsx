import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import type { CateringOrderRow, CateringOrderStatus } from '@/lib/supabase/custom-types'
import CateringStatusStepper from '@/components/inventory/catering/CateringStatusStepper'
import CateringCalendar from '@/components/inventory/catering/CateringCalendar'
import CateringIngredientsDrawer from '@/components/inventory/catering/CateringIngredientsDrawer'

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

interface PageProps {
  params:      Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string }>
}

export const dynamic = 'force-dynamic'

export default async function CateringPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const { branch } = await searchParams
  const isAr  = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const supabase = createServiceClient()

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name_ar, name_en')
    .eq('is_active', true)
    .order('name_ar')

  const activeBranchId = branch ?? (isGlobal ? null : (user.branch_id ?? null))
    ?? (branches?.[0]?.id ?? null)

  // Fetch orders
  const ordersRes = await (
    activeBranchId
      ? supabase.from('catering_orders')
          .select('*')
          .eq('branch_id', activeBranchId)
          .order('event_date', { ascending: true })
      : isGlobal
      ? supabase.from('catering_orders')
          .select('*')
          .order('event_date', { ascending: true })
      : Promise.resolve({ data: [], error: null })
  )

  const orders = (ordersRes.data ?? []) as CateringOrderRow[]

  // KPIs
  const activeOrders = orders.filter((o) => !['cancelled', 'invoiced'].includes(o.status))
  const totalRevenue  = orders
    .filter((o) => ['delivered', 'invoiced'].includes(o.status))
    .reduce((s, o) => s + Number(o.subtotal_bhd), 0)
  const pendingDeposit = orders
    .filter((o) => o.status === 'confirmed' && !o.deposit_paid)
    .reduce((s, o) => s + Number(o.deposit_bhd), 0)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'طلبات التقديم' : 'Catering Orders'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? 'إدارة فعاليات التقديم الخارجي' : 'Manage external catering events'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isGlobal && branches && branches.length > 1 && (
            <form method="GET">
              <select
                name="branch"
                defaultValue={activeBranchId ?? ''}
                className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
              >
                <option value="">{isAr ? 'جميع الفروع' : 'All branches'}</option>
                {branches.map((b: { id: string; name_ar: string; name_en: string | null }) => (
                  <option key={b.id} value={b.id}>{isAr ? b.name_ar : (b.name_en ?? b.name_ar)}</option>
                ))}
              </select>
              <button type="submit" className="ms-2 rounded-lg bg-brand-surface-2 px-3 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors">
                {isAr ? 'تطبيق' : 'Apply'}
              </button>
            </form>
          )}
          <Link
            href={`${prefix}/dashboard/inventory/catering/packages`}
            className="rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            {isAr ? 'الباقات' : 'Packages'}
          </Link>
          <Link
            href={`${prefix}/dashboard/inventory/catering/new`}
            className="rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-bold text-brand-black hover:bg-brand-goldLight transition-colors"
          >
            {isAr ? '+ طلب جديد' : '+ New Order'}
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الطلبات النشطة' : 'Active Orders'}</p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1">{activeOrders.length}</p>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'الإيرادات المسلَّمة' : 'Delivered Revenue'}</p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1">{totalRevenue.toFixed(3)}</p>
          <p className="font-satoshi text-xs text-brand-muted mt-0.5">BD</p>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'عربون بانتظار الدفع' : 'Pending Deposit'}</p>
          <p className={`font-cairo text-2xl font-black mt-1 ${pendingDeposit > 0 ? 'text-brand-gold' : 'text-brand-text'}`}>
            {pendingDeposit.toFixed(3)}
          </p>
          <p className="font-satoshi text-xs text-brand-muted mt-0.5">BD</p>
        </div>
      </div>

      {/* Main layout: calendar + table */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar: upcoming events */}
        <div className="lg:col-span-1">
          <CateringCalendar orders={orders} prefix={prefix} isAr={isAr} />
        </div>

        {/* Orders table */}
        <div className="lg:col-span-2">
          {orders.length === 0 ? (
            <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
              <p className="font-satoshi text-sm text-brand-muted">
                {isAr ? 'لا توجد طلبات تقديم حتى الآن' : 'No catering orders yet'}
              </p>
              <Link
                href={`${prefix}/dashboard/inventory/catering/new`}
                className="mt-3 inline-block rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-bold text-brand-black hover:bg-brand-goldLight transition-colors"
              >
                {isAr ? 'إنشاء أول طلب' : 'Create first order'}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-brand-surface border border-brand-border rounded-xl p-4 flex flex-col gap-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-satoshi font-bold text-sm text-brand-text">{order.client_name}</p>
                      <p className="font-satoshi text-xs text-brand-muted mt-0.5">
                        {new Date(order.event_date).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {order.event_time && ` · ${order.event_time}`}
                        {' · '}{order.guest_count} {isAr ? 'ضيف' : 'guests'}
                      </p>
                      {order.venue_name && (
                        <p className="font-satoshi text-xs text-brand-muted">{order.venue_name}</p>
                      )}
                    </div>
                    <div className="text-end">
                      <p className="font-cairo font-black text-brand-gold">{Number(order.subtotal_bhd).toFixed(3)} BD</p>
                      {order.deposit_bhd > 0 && (
                        <p className={`font-satoshi text-xs mt-0.5 ${order.deposit_paid ? 'text-green-400' : 'text-brand-muted'}`}>
                          {isAr ? 'عربون: ' : 'Deposit: '}{Number(order.deposit_bhd).toFixed(3)} BD
                          {order.deposit_paid ? (isAr ? ' ✓ مدفوع' : ' ✓ paid') : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <CateringStatusStepper currentStatus={order.status as CateringOrderStatus} isAr={isAr} />

                  <CateringIngredientsDrawer
                    orderId={order.id}
                    snapshot={order.ingredients_snapshot ?? null}
                    isAr={isAr}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
