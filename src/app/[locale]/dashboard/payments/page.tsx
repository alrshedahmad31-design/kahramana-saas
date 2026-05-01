import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSession } from '@/lib/auth/session'
import { canAccessPayments } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import type { PaymentMethod, PaymentStatus } from '@/lib/supabase/custom-types'
import PaymentStatsCards from '@/components/payments/PaymentStatsCards'
import PaymentFilters from '@/components/payments/PaymentFilters'
import PaymentsTable from '@/components/payments/PaymentsTable'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function PaymentsPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp         = await searchParams
  const isAr       = locale === 'ar'
  const prefix     = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessPayments(user)) redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')

  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'

  const page         = Math.max(1, Number(sp.page ?? 1))
  const days         = Math.max(7, Number(sp.days ?? 30))
  const filterMethod = sp.method as PaymentMethod | undefined
  const filterStatus = sp.status as PaymentStatus | undefined
  const offset       = (page - 1) * PAGE_SIZE
  const cutoff       = new Date(Date.now() - days * 86_400_000).toISOString()

  const supabase = await createClient()

  // Branch-scope: get order IDs for this branch (branch_manager only)
  let scopedOrderIds: string[] | null = null
  if (!isGlobalAdmin && user.branch_id) {
    const { data: branchOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('branch_id', user.branch_id)

    scopedOrderIds = branchOrders?.map((o) => o.id) ?? []

    // Short-circuit: branch with no orders → nothing to show
    if (scopedOrderIds.length === 0) {
      return (
        <PageShell isAr={isAr} prefix={prefix} isGlobalAdmin={isGlobalAdmin}>
          <PaymentStatsCards total={0} revenue={0} successRate="0.0" failedCount={0} isAr={isAr} />
          <div className="rounded-2xl border border-brand-border bg-brand-surface p-12 text-center">
            <p className="font-satoshi text-brand-muted text-sm">
              {isAr ? 'لا توجد معاملات لهذا الفرع' : 'No transactions for this branch'}
            </p>
          </div>
        </PageShell>
      )
    }
  }

  // Stats: all time, branch-scoped
  let statsQ = supabase.from('payments').select('status, amount_bhd')
  if (scopedOrderIds !== null) statsQ = statsQ.in('order_id', scopedOrderIds)
  const { data: allPayments } = await statsQ

  const totalTx   = allPayments?.length ?? 0
  const completed = allPayments?.filter((p) => p.status === 'completed') ?? []
  const revenue   = completed.reduce((sum, p) => sum + p.amount_bhd, 0)
  const failedCnt = allPayments?.filter((p) => p.status === 'failed').length ?? 0
  const successRate = totalTx > 0 ? ((completed.length / totalTx) * 100).toFixed(1) : '0.0'

  // Paginated + filtered table data
  let tableQ = supabase
    .from('payments')
    .select(
      'id, order_id, amount_bhd, method, status, gateway_transaction_id, paid_at, created_at, orders(id, customer_name, customer_phone, branch_id)',
      { count: 'exact' },
    )
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (scopedOrderIds !== null) tableQ = tableQ.in('order_id', scopedOrderIds)
  if (filterMethod)            tableQ = tableQ.eq('method', filterMethod)
  if (filterStatus)            tableQ = tableQ.eq('status', filterStatus)

  const { data: payments, count } = await tableQ

  return (
    <PageShell isAr={isAr} prefix={prefix} isGlobalAdmin={isGlobalAdmin}>
      <PaymentStatsCards
        total={totalTx}
        revenue={revenue}
        successRate={successRate}
        failedCount={failedCnt}
        isAr={isAr}
      />
      <Suspense>
        <PaymentFilters isAr={isAr} isGlobalAdmin={isGlobalAdmin} />
      </Suspense>
      <PaymentsTable
        payments={(payments ?? []) as Parameters<typeof PaymentsTable>[0]['payments']}
        totalCount={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        locale={locale}
        isAr={isAr}
        prefix={prefix}
      />
    </PageShell>
  )
}

function PageShell({
  isAr,
  prefix,
  isGlobalAdmin,
  children,
}: {
  isAr: boolean
  prefix: string
  isGlobalAdmin: boolean
  children: React.ReactNode
}) {
  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'المدفوعات' : 'Payments'}
        </h1>
      </div>
      {children}
    </div>
  )
}
