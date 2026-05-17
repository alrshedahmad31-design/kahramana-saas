import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { getActiveBranches }   from '@/lib/branches/queries'
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
  const t = await getTranslations({ locale, namespace: 'inventory.reports.catering' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'
  const supabase = createServiceClient()

  // Fetch branches
  const branches = await getActiveBranches()

  const activeBranchId = isGlobal
    ? (branch ?? null)
    : (user.branch_id ?? null)

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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-2xl font-black text-brand-text tracking-tight`}>
            {t('title')}
          </h1>
          <p className={`${font} text-sm text-brand-muted mt-1 font-medium`}>
            {t('desc')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isGlobal && branches && branches.length > 1 && (
            <form method="GET" className="flex items-center gap-2">
              <select
                name="branch"
                defaultValue={activeBranchId ?? ''}
                className={`rounded-lg border border-brand-border bg-brand-surface px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none shadow-sm transition-colors`}
              >
                <option value="">{t('allBranches')}</option>
                {branches.map((b: { id: string; name_ar: string; name_en: string | null }) => (
                  <option key={b.id} value={b.id}>{isAr ? b.name_ar : (b.name_en ?? b.name_ar)}</option>
                ))}
              </select>
              <button type="submit" className={`rounded-lg bg-brand-surface-2 px-3 py-2 ${font} text-sm text-brand-muted hover:text-brand-text transition-colors shadow-sm`}>
                {t('apply')}
              </button>
            </form>
          )}
          <Link
            href={`${prefix}/dashboard/inventory/catering/packages`}
            className={`rounded-lg border border-brand-border px-4 py-2 ${font} text-sm text-brand-muted hover:text-brand-text hover:border-brand-text transition-all shadow-sm`}
          >
            {t('packages')}
          </Link>
          <Link
            href={`${prefix}/dashboard/inventory/catering/new`}
            className={`rounded-lg bg-brand-gold px-4 py-2 ${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-black hover:bg-brand-goldLight transition-all shadow-md active:scale-95`}
          >
            {t('newOrder')}
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4 shadow-sm transition-all hover:shadow-md">
          <p className={`${font} text-[10px] text-brand-muted uppercase tracking-wider font-semibold`}>{t('activeOrders')}</p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1 tabular-nums">{activeOrders.length}</p>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4 shadow-sm transition-all hover:shadow-md">
          <p className={`${font} text-[10px] text-brand-muted uppercase tracking-wider font-semibold`}>{t('deliveredRevenue')}</p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1 tabular-nums">{totalRevenue.toFixed(3)}</p>
          <p className={`${font} text-xs text-brand-muted mt-0.5 font-medium`}>{currency}</p>
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4 shadow-sm transition-all hover:shadow-md">
          <p className={`${font} text-[10px] text-brand-muted uppercase tracking-wider font-semibold`}>{t('pendingDeposit')}</p>
          <p className={`font-cairo text-2xl font-black mt-1 tabular-nums ${pendingDeposit > 0 ? 'text-brand-gold' : 'text-brand-text'}`}>
            {pendingDeposit.toFixed(3)}
          </p>
          <p className={`${font} text-xs text-brand-muted mt-0.5 font-medium`}>{currency}</p>
        </div>
      </div>

      {/* Main layout: calendar + table */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar: upcoming events */}
        <div className="lg:col-span-1">
          <CateringCalendar orders={orders} prefix={prefix} locale={locale} />
        </div>

        {/* Orders table */}
        <div className="lg:col-span-2">
          {orders.length === 0 ? (
            <div className="bg-brand-surface border border-brand-border rounded-xl p-12 text-center shadow-sm">
              <p className={`${font} text-sm text-brand-muted`}>
                {t('noOrders')}
              </p>
              <Link
                href={`${prefix}/dashboard/inventory/catering/new`}
                className={`mt-4 inline-block rounded-lg bg-brand-gold px-6 py-2.5 ${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-black hover:bg-brand-goldLight transition-all shadow-md active:scale-95`}
              >
                {t('createFirst')}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className={`${isAr ? 'font-cairo' : 'font-satoshi'} font-bold text-base text-brand-text`}>{order.client_name}</p>
                      <p className={`${font} text-xs text-brand-muted mt-1 font-medium`}>
                        {new Date(order.event_date).toLocaleDateString(locale === 'ar' ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bahrain' })}
                        {order.event_time && ` · ${order.event_time}`}
                        {' · '}{t('guests', { count: order.guest_count })}
                      </p>
                      {order.venue_name && (
                        <p className={`${font} text-xs text-brand-muted font-medium`}>{t('venue', { name: order.venue_name })}</p>
                      )}
                    </div>
                    <div className="text-end">
                      <p className="font-cairo text-lg font-black text-brand-gold tabular-nums">{Number(order.subtotal_bhd).toFixed(3)} <span className="text-[10px] font-medium opacity-70">{currency}</span></p>
                      {order.deposit_bhd > 0 && (
                        <p className={`${font} text-xs mt-1 font-medium ${order.deposit_paid ? 'text-green-400' : 'text-brand-muted'}`}>
                          {t('deposit', { val: Number(order.deposit_bhd).toFixed(3), currency })}
                          {order.deposit_paid ? ` ${t('paid')}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <CateringStatusStepper currentStatus={order.status as CateringOrderStatus} locale={locale} />

                  <CateringIngredientsDrawer
                    orderId={order.id}
                    snapshot={order.ingredients_snapshot ?? null}
                    locale={locale}
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

