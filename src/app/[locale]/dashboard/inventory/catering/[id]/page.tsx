import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import CateringOrderForm from '@/components/inventory/catering/CateringOrderForm'
import CateringStatusStepper from '@/components/inventory/catering/CateringStatusStepper'
import CateringIngredientsDrawer from '@/components/inventory/catering/CateringIngredientsDrawer'
import type { CateringOrderRow, CateringOrderStatus, CateringPackageRow } from '@/lib/supabase/custom-types'

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function CateringOrderDetailPage({ params }: PageProps) {
  const { locale, id } = await params
  const isAr  = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('catering_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const order = data as unknown as CateringOrderRow

  if (order.branch_id && !['owner', 'general_manager'].includes(user.role ?? '')) {
    if (order.branch_id !== user.branch_id) {
      redirect(`${prefix}/dashboard/inventory/catering`)
    }
  }

  const { data: pkgData } = await supabase
    .from('catering_packages')
    .select('id, name_ar, name_en, min_guests, max_guests, price_per_person_bhd')
    .eq('branch_id', order.branch_id)
    .eq('is_active', true)
    .order('name_ar')

  const packages = (pkgData ?? []) as Pick<
    CateringPackageRow,
    'id' | 'name_ar' | 'name_en' | 'min_guests' | 'max_guests' | 'price_per_person_bhd'
  >[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <nav className="flex items-center gap-2 font-satoshi text-xs text-brand-muted">
          <Link
            href={`${prefix}/dashboard/inventory/catering`}
            className="hover:text-brand-gold transition-colors"
          >
            {isAr ? 'الكيترينج' : 'Catering'}
          </Link>
          <span className="text-brand-border">›</span>
          <span className="text-brand-text">{order.client_name}</span>
        </nav>
        <h1 className="font-cairo text-2xl font-black text-brand-text mt-2">
          {order.client_name}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {new Date(order.event_date).toLocaleDateString(
            isAr ? 'ar-IQ' : 'en-GB',
            { day: 'numeric', month: 'long', year: 'numeric' },
          )}
          {' · '}{order.guest_count} {isAr ? 'ضيف' : 'guests'}
          {order.venue_name && ` · ${order.venue_name}`}
        </p>
      </div>

      {/* Status stepper */}
      <CateringStatusStepper
        currentStatus={order.status as CateringOrderStatus}
        isAr={isAr}
      />

      {/* Edit form */}
      <CateringOrderForm
        mode="edit"
        order={order}
        branchId={order.branch_id}
        packages={packages}
        prefix={prefix}
        isAr={isAr}
      />

      {/* Ingredients drawer — only for confirmed / in-progress orders */}
      {order.status !== 'draft' && (
        <CateringIngredientsDrawer
          orderId={order.id}
          snapshot={order.ingredients_snapshot ?? null}
          isAr={isAr}
        />
      )}
    </div>
  )
}
