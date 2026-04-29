'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/dashboard/StatusBadge'
import OrderStatusSelect from '@/components/dashboard/OrderStatusSelect'
import OrderStatsBar from '@/components/dashboard/OrderStatsBar'
import OrdersFilters, { type StatusFilter, type DateFilter } from '@/components/orders/OrdersFilters'
import OrdersCardGrid from '@/components/orders/OrdersCardGrid'
import OrderDetailsModal from '@/components/orders/OrderDetailsModal'
import KanbanOrderCard from '@/components/orders/KanbanOrderCard'
import type { OrderCardData } from '@/components/orders/OrderCard'
import type { OrderStatus, StaffRole } from '@/lib/supabase/custom-types'
import { BRANCHES } from '@/constants/contact'

const PAGE_SIZE = 20

const STATUS_MAP: Record<StatusFilter, OrderStatus[] | null> = {
  all:              null,
  new:              ['new', 'under_review'],
  accepted:         ['accepted'],
  preparing:        ['preparing'],
  ready:            ['ready'],
  out_for_delivery: ['out_for_delivery'],
  delivered:        ['delivered', 'completed'],
  cancelled:        ['cancelled', 'payment_failed'],
}

const KANBAN_COLS = [
  {
    key:      'new',
    statuses: ['new', 'under_review'] as OrderStatus[],
    labelAr:  'جديد',
    labelEn:  'New',
    borderCls: 'border-brand-error',
    headerBg:  'bg-brand-error/10',
    dotCls:    'bg-brand-error animate-pulse',
  },
  {
    key:      'preparing',
    statuses: ['accepted', 'preparing'] as OrderStatus[],
    labelAr:  'قيد التحضير',
    labelEn:  'Preparing',
    borderCls: 'border-brand-gold',
    headerBg:  'bg-brand-gold/10',
    dotCls:    'bg-brand-gold',
  },
  {
    key:      'ready',
    statuses: ['ready', 'out_for_delivery'] as OrderStatus[],
    labelAr:  'جاهز',
    labelEn:  'Ready',
    borderCls: 'border-brand-success',
    headerBg:  'bg-brand-success/10',
    dotCls:    'bg-brand-success',
  },
  {
    key:      'done',
    statuses: ['delivered', 'completed', 'cancelled'] as OrderStatus[],
    labelAr:  'مكتمل',
    labelEn:  'Done',
    borderCls: 'border-brand-border',
    headerBg:  'bg-brand-surface-2',
    dotCls:    'bg-brand-muted',
  },
] as const

function getDateRange(filter: DateFilter): { from: string; to?: string } | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (filter === 'today')     return { from: today.toISOString() }
  if (filter === 'yesterday') {
    const y = new Date(today); y.setDate(y.getDate() - 1)
    return { from: y.toISOString(), to: today.toISOString() }
  }
  if (filter === 'last7') {
    const d = new Date(today); d.setDate(d.getDate() - 7)
    return { from: d.toISOString() }
  }
  if (filter === 'last30') {
    const d = new Date(today); d.setDate(d.getDate() - 30)
    return { from: d.toISOString() }
  }
  return null
}

type ViewMode = 'card' | 'table' | 'kanban'

interface Props {
  userRole:             StaffRole | null
  initialOrders:        OrderCardData[]
  initialTotalCount:    number
  initialFilteredTotal: number
}

export default function OrdersClient({
  userRole,
  initialOrders,
  initialTotalCount,
  initialFilteredTotal,
}: Props) {
  const t      = useTranslations('dashboard')
  const tS     = useTranslations('order.status')
  const tC     = useTranslations('common')
  const locale = useLocale()
  const isAr   = locale === 'ar'

  const [orders,        setOrders]        = useState<OrderCardData[]>(initialOrders)
  const [loading,       setLoading]       = useState(initialOrders.length === 0)
  const [totalCount,    setTotalCount]    = useState(initialTotalCount)
  const [filteredTotal, setFilteredTotal] = useState(initialFilteredTotal)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [dateFilter,   setDateFilter]   = useState<DateFilter>('today')
  const [page,         setPage]         = useState(1)

  const [view,       setView]       = useState<ViewMode>('kanban')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Skip the first useEffect fetch when the server already provided initial data
  const skipInitialFetch = useRef(initialOrders.length > 0)

  const supabase = useMemo(() => createClient(), [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const offset   = (page - 1) * PAGE_SIZE
    const statuses = STATUS_MAP[statusFilter]
    const range    = getDateRange(dateFilter)

    let q = supabase
      .from('orders')
      .select(
        'id, customer_name, customer_phone, branch_id, status, total_bhd, created_at, updated_at, order_items(name_ar, name_en, quantity, selected_size, selected_variant)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (statuses)               q = q.in('status', statuses)
    if (branchFilter !== 'all') q = q.eq('branch_id', branchFilter)
    if (search.trim())          q = q.or(`customer_name.ilike.%${search.trim()}%,customer_phone.ilike.%${search.trim()}%,id.ilike.%${search.trim()}%`)
    if (range?.from)            q = q.gte('created_at', range.from)
    if (range?.to)              q = q.lt('created_at', range.to)

    let tq = supabase.from('orders').select('total_bhd')
    if (statuses)               tq = tq.in('status', statuses)
    if (branchFilter !== 'all') tq = tq.eq('branch_id', branchFilter)
    if (search.trim())          tq = tq.or(`customer_name.ilike.%${search.trim()}%,customer_phone.ilike.%${search.trim()}%`)
    if (range?.from)            tq = tq.gte('created_at', range.from)
    if (range?.to)              tq = tq.lt('created_at', range.to)

    const [{ data, count }, { data: totals }] = await Promise.all([q, tq])

    setOrders((data ?? []) as unknown as OrderCardData[])
    setTotalCount(count ?? 0)
    setFilteredTotal(
      ((totals ?? []) as { total_bhd: number }[]).reduce((s, r) => s + Number(r.total_bhd), 0)
    )
    setLoading(false)
  }, [supabase, statusFilter, branchFilter, dateFilter, search, page])

  // Skip the first fetch when server already provided initial data
  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }
    fetchOrders()
  }, [fetchOrders])

  // Realtime subscription — always active regardless of initial data
  useEffect(() => {
    const channel = supabase
      .channel('orders-dashboard-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchOrders])

  function handleStatusChange(orderId: string, next: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: next } : o)))
  }

  function handleFilterChange<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1) }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const kanbanGroups = useMemo(() => {
    return KANBAN_COLS.map(col => ({
      ...col,
      orders: orders.filter(o => col.statuses.includes(o.status)),
    }))
  }, [orders])

  const font = isAr ? 'font-almarai' : 'font-satoshi'

  return (
    <div className="flex flex-col gap-5" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Page header + view toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className={`font-black text-2xl text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('orders')}
          </h1>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-brand-border bg-brand-surface p-1 shrink-0">
          <ViewToggleButton active={view === 'kanban'} onClick={() => setView('kanban')}>
            <KanbanIcon />
            <span className="hidden sm:inline">{isAr ? 'كانبان' : 'Kanban'}</span>
          </ViewToggleButton>
          <ViewToggleButton active={view === 'card'} onClick={() => setView('card')}>
            <GridIcon />
            <span className="hidden sm:inline">{t('viewCard')}</span>
          </ViewToggleButton>
          <ViewToggleButton active={view === 'table'} onClick={() => setView('table')}>
            <TableIcon />
            <span className="hidden sm:inline">{t('viewTable')}</span>
          </ViewToggleButton>
        </div>
      </div>

      {/* Stats bar */}
      <OrderStatsBar />

      {/* Filters */}
      <OrdersFilters
        search={search}
        statusFilter={statusFilter}
        branchFilter={branchFilter}
        dateFilter={dateFilter}
        totalCount={totalCount}
        filteredTotal={filteredTotal}
        isRTL={isAr}
        onSearch={handleFilterChange(setSearch)}
        onStatusChange={handleFilterChange(setStatusFilter)}
        onBranchChange={handleFilterChange(setBranchFilter)}
        onDateChange={handleFilterChange(setDateFilter)}
      />

      {/* Empty state */}
      {!loading && orders.length === 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-12 text-center">
          <p className={`font-semibold text-brand-muted ${font}`}>{t('noOrders')}</p>
          <p className={`text-sm text-brand-muted/60 mt-1 ${font}`}>{t('noOrdersHint')}</p>
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {view === 'kanban' && (loading || orders.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {kanbanGroups.map((col) => (
            <div key={col.key} className="flex flex-col gap-3 min-w-0">
              <div className={`${col.headerBg} border-2 ${col.borderCls} rounded-xl px-4 py-3 flex items-center justify-between gap-2 sticky top-0 z-10 backdrop-blur-sm`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dotCls} shrink-0`} />
                  <h2 className={`font-black text-brand-text text-sm uppercase tracking-wider ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                    {isAr ? col.labelAr : col.labelEn}
                  </h2>
                </div>
                <span className={`font-black text-brand-text text-sm tabular-nums ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {loading ? '—' : col.orders.length}
                </span>
              </div>

              {loading ? (
                <KanbanSkeleton />
              ) : col.orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-brand-border border-dashed">
                  <p className={`text-sm text-brand-muted/40 ${font}`}>
                    {isAr ? 'لا توجد طلبات' : 'No orders'}
                  </p>
                </div>
              ) : (
                <div className={`flex flex-col gap-3 ${col.key === 'done' ? 'max-h-[640px] overflow-y-auto pe-1' : ''}`}>
                  {(col.key === 'done' ? col.orders.slice(0, 15) : col.orders).map(order => (
                    <KanbanOrderCard
                      key={order.id}
                      order={order}
                      userRole={userRole}
                      onStatusChange={handleStatusChange}
                      onViewDetails={(id) => setSelectedId(id)}
                    />
                  ))}
                  {col.key === 'done' && col.orders.length > 15 && (
                    <p className={`text-center text-xs text-brand-muted/60 py-2 ${font}`}>
                      {isAr ? `+ ${col.orders.length - 15} طلبات أخرى مكتملة` : `+ ${col.orders.length - 15} more completed`}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── CARD VIEW ── */}
      {view === 'card' && (loading || orders.length > 0) && (
        <OrdersCardGrid
          orders={orders}
          isRTL={isAr}
          loading={loading}
          onViewDetails={(id) => setSelectedId(id)}
        />
      )}

      {/* ── TABLE VIEW ── */}
      {view === 'table' && !loading && orders.length > 0 && (
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  {[t('orderDetails'), t('branch'), t('total'), t('createdAt'), t('status'), t('updateStatus')].map(
                    (h, i) => (
                      <th key={i} className="px-4 py-3 text-start font-satoshi font-medium text-brand-muted text-xs uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-brand-border last:border-0 hover:bg-brand-surface-2 transition-colors cursor-pointer"
                    onClick={() => setSelectedId(order.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-satoshi font-medium text-brand-text hover:text-brand-gold transition-colors">
                        {order.customer_name ?? t('customerGuest')}
                      </p>
                      <p className="font-satoshi text-xs text-brand-muted tabular-nums">
                        #{order.id.slice(-8).toUpperCase()}
                      </p>
                      {order.customer_phone && (
                        <p className="font-satoshi text-xs text-brand-muted tabular-nums" dir="ltr">
                          {order.customer_phone}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-brand-muted">
                      {BRANCHES[order.branch_id as keyof typeof BRANCHES]?.[isAr ? 'nameAr' : 'nameEn'] ?? order.branch_id}
                    </td>
                    <td className="px-4 py-3 font-satoshi font-medium text-brand-text tabular-nums whitespace-nowrap">
                      {Number(order.total_bhd).toFixed(3)}{' '}
                      <span className="text-brand-muted font-normal">{tC('currency')}</span>
                    </td>
                    <td className="px-4 py-3 font-satoshi text-brand-muted tabular-nums text-xs whitespace-nowrap">
                      {new Date(order.created_at).toLocaleString('en-BH', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <StatusBadge status={order.status} label={tS(order.status)} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <OrderStatusSelect
                        orderId={order.id}
                        currentStatus={order.status}
                        userRole={userRole}
                        onStatusChange={(next) => handleStatusChange(order.id, next)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-brand-border">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-brand-border font-satoshi text-sm text-brand-muted hover:border-brand-gold hover:text-brand-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 min-h-[36px]">
                {t('pagination.previous')}
              </button>
              <span className="font-satoshi text-sm text-brand-muted">
                {t('pagination.page', { current: page, total: totalPages })}
              </span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-brand-border font-satoshi text-sm text-brand-muted hover:border-brand-gold hover:text-brand-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 min-h-[36px]">
                {t('pagination.next')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Card view pagination */}
      {view === 'card' && totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1}
            onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="px-4 py-2 rounded-lg border border-brand-border font-satoshi text-sm text-brand-muted hover:border-brand-gold hover:text-brand-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 min-h-[40px]">
            {t('pagination.previous')}
          </button>
          <span className="font-satoshi text-sm text-brand-muted">
            {t('pagination.page', { current: page, total: totalPages })}
          </span>
          <button type="button" disabled={page >= totalPages}
            onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className="px-4 py-2 rounded-lg border border-brand-border font-satoshi text-sm text-brand-muted hover:border-brand-gold hover:text-brand-gold disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 min-h-[40px]">
            {t('pagination.next')}
          </button>
        </div>
      )}

      {/* Details modal */}
      <OrderDetailsModal
        orderId={selectedId}
        isRTL={isAr}
        userRole={userRole}
        onClose={() => setSelectedId(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-4 animate-pulse">
          <div className="h-3 bg-brand-border rounded w-2/3 mb-3" />
          <div className="h-4 bg-brand-border rounded w-4/5 mb-2" />
          <div className="h-3 bg-brand-border rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}

function ViewToggleButton({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-satoshi text-sm font-medium transition-colors duration-150 min-h-[36px]
        ${active ? 'bg-brand-gold text-brand-black' : 'text-brand-muted hover:text-brand-text'}`}
    >
      {children}
    </button>
  )
}

function KanbanIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="3" width="5" height="18" rx="1" />
      <rect x="10" y="3" width="5" height="13" rx="1" />
      <rect x="17" y="3" width="5" height="8" rx="1" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function TableIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
    </svg>
  )
}
