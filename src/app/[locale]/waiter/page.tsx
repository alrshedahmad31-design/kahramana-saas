import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import { BRANCH_LIST } from '@/constants/contact'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ branch?: string }>
}

interface TableRow {
  id:           string
  branch_id:    string
  table_number: number
  label_ar:     string | null
  label_en:     string | null
  capacity:     number
  is_active:    boolean
}

interface ActiveOrderRow {
  id:           string
  table_number: number
  status:       string
  created_at:   string
}

export default async function WaiterHomePage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const search = await searchParams
  const isAr = locale === 'ar'
  const prefix = locale === 'en' ? '/en' : ''

  // Layout already enforced requireDashboardSection('waiter') — by the time
  // this page renders the role and branch scope have been verified. Session
  // is loaded here only to read role + branch_id for the global-admin check.
  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)

  const t = await getTranslations({ locale, namespace: 'waiter' })

  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  const branchOptions = BRANCH_LIST.filter((b) => b.status === 'active')
  const defaultBranch = isGlobalAdmin
    ? (search.branch ?? branchOptions[0]?.id ?? '')
    : (user.branch_id ?? branchOptions[0]?.id ?? '')
  const branchId = isGlobalAdmin ? defaultBranch : (user.branch_id ?? '')

  const tablesResult = await createServiceClient()
    .from('restaurant_tables')
    .select('id, branch_id, table_number, label_ar, label_en, capacity, is_active')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('table_number', { ascending: true })

  if ('error' in tablesResult && tablesResult.error) {
    console.error('[waiter] restaurant_tables query failed:', tablesResult.error)
  }
  const tables = (tablesResult.data ?? []) as TableRow[]

  const supabase = createServiceClient()
  const ACTIVE_STATUSES = ['new', 'accepted', 'preparing', 'ready'] as const
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('id, table_number, status, created_at')
    .eq('branch_id', branchId)
    .eq('source', 'waiter')
    .in('status', ACTIVE_STATUSES)
    .not('table_number', 'is', null)
    .order('created_at', { ascending: false })
    .returns<ActiveOrderRow[]>()

  if (ordersError) {
    console.error('[waiter] active orders query failed:', ordersError)
  }

  const ordersByTable = new Map<number, ActiveOrderRow[]>()
  for (const o of ordersData ?? []) {
    const arr = ordersByTable.get(o.table_number) ?? []
    arr.push(o)
    ordersByTable.set(o.table_number, arr)
  }

  const branchLabel = branchOptions.find((b) => b.id === branchId)
  const branchDisplay = branchLabel
    ? (isAr ? branchLabel.nameAr : branchLabel.nameEn)
    : branchId

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('selectTable')}
          </h1>
          <p className={`text-sm text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('branchLabel')}: {branchDisplay}
          </p>
        </div>
        {isGlobalAdmin && (
          <form className="shrink-0 flex items-center gap-2" action="" method="get">
            <select
              name="branch"
              defaultValue={branchId}
              className="bg-brand-surface border border-brand-border rounded-lg px-3 min-h-[44px] text-sm text-brand-text font-satoshi focus:outline-none focus:border-brand-gold/40"
            >
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
            <button type="submit" className="min-h-[44px] px-3 text-xs font-bold text-brand-gold bg-brand-gold/5 rounded-lg border border-brand-gold/20 hover:bg-brand-gold/10 transition-colors">
              {isAr ? 'تطبيق' : 'Apply'}
            </button>
          </form>
        )}
      </header>

      {tables.length === 0 ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
          <p className={`text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'لا توجد طاولات معرّفة لهذا الفرع' : 'No tables configured for this branch'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tables.map((table) => {
            const orders = ordersByTable.get(table.table_number) ?? []
            const occupied = orders.length > 0
            const oldest = orders[orders.length - 1]
            const elapsedMin = oldest
              ? Math.max(0, Math.floor((Date.now() - new Date(oldest.created_at).getTime()) / 60000))
              : 0
            const label = isAr
              ? (table.label_ar ?? `طاولة ${table.table_number}`)
              : (table.label_en ?? `Table ${table.table_number}`)

            return (
              <Link
                key={table.id}
                href={`${prefix}/waiter/table/${table.table_number}${isGlobalAdmin ? `?branch=${branchId}` : ''}`}
                className={`flex flex-col items-center justify-center min-h-[120px] rounded-xl border p-4 transition-colors ${
                  occupied
                    ? 'bg-brand-gold/10 border-brand-gold/40 hover:border-brand-gold'
                    : 'bg-brand-surface border-brand-border hover:border-brand-gold/40'
                }`}
              >
                <span className={`text-3xl font-black tabular-nums ${occupied ? 'text-brand-gold' : 'text-brand-text'} ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {table.table_number}
                </span>
                <span className={`text-xs text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {label}
                </span>
                {occupied ? (
                  <div className={`mt-2 text-xs font-bold text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('ordersCount', { count: orders.length })} · {t('elapsedMinutes', { m: elapsedMin })}
                  </div>
                ) : (
                  <span className={`mt-2 text-[11px] uppercase tracking-wide text-brand-muted/70 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('empty')}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
