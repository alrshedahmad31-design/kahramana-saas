import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { BRANCH_LIST } from '@/constants/contact'
import WaiterOrdersClient, { type WaiterOrderRow } from './WaiterOrdersClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string }>
}

export default async function WaiterOrdersPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const search = await searchParams
  const prefix = locale === 'en' ? '/en' : ''

  // Layout enforced requireDashboardSection('waiter'); read session for scope.
  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)

  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  const branchOptions = BRANCH_LIST.filter((b) => b.status === 'active')
  const branchId = isGlobalAdmin
    ? (search.branch ?? branchOptions[0]?.id ?? '')
    : (user.branch_id ?? '')

  if (!branchId) redirect(`${prefix}/waiter`)

  const supabase = await createServiceClient()
  const ACTIVE_STATUSES = ['new', 'accepted', 'preparing', 'ready'] as const

  const { data, error: ordersError } = await supabase
    .from('orders')
    .select('id, table_number, status, total_bhd, created_at, notes')
    .eq('branch_id', branchId)
    .eq('source', 'waiter')
    .in('status', ACTIVE_STATUSES)
    .not('table_number', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)
    .returns<WaiterOrderRow[]>()

  if (ordersError) {
    console.error('[waiter/orders] active orders query failed:', ordersError)
  }

  return (
    <WaiterOrdersClient
      initialOrders={data ?? []}
      branchId={branchId}
      locale={locale === 'en' ? 'en' : 'ar'}
    />
  )
}
