import { createServiceClient } from '@/lib/supabase/server'
import { BH_TIMEZONE } from '@/lib/analytics/calculations'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveCounts {
  new:              number
  under_review:     number
  accepted:         number
  preparing:        number
  ready:            number
  out_for_delivery: number
  total:            number
  longestId:        string | null
  longestMins:      number
}

export interface HourlyPoint {
  hour:    number  // 0–23 BH time
  label:   string  // "12am", "3pm", …
  revenue: number
  orders:  number
}

export interface TopItem {
  name_ar:        string
  name_en:        string
  total_quantity: number
}

export interface ActivityOrder {
  id:            string
  status:        string
  customer_name: string | null
  total_bhd:     number
  branch_id:     string
  updated_at:    string
  created_at:    string
}

export interface DashboardData {
  todayRevenue:     number
  yesterdayRevenue: number
  totalOrdersToday: number
  completedToday:   number
  avgPrepMins:      number
  activeOrders:     ActiveCounts
  hourlyPoints:     HourlyPoint[]
  topItems:         TopItem[]
  recentActivity:   ActivityOrder[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBHHour(iso: string): number {
  const s = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hour12: false, timeZone: BH_TIMEZONE,
  }).format(new Date(iso))
  return parseInt(s, 10) % 24
}

function bhDayStart(daysAgo = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const s = d.toLocaleDateString('en-CA', { timeZone: BH_TIMEZONE })
  return new Date(`${s}T00:00:00+03:00`)
}

function hourLabel(h: number): string {
  if (h === 0)  return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

import type { OrderStatus } from '@/lib/supabase/custom-types'

const ACTIVE_STATUSES   = ['new', 'under_review', 'accepted', 'preparing', 'ready', 'out_for_delivery']
const DONE_STATUSES: OrderStatus[] = ['delivered', 'completed']
const EXCLUDED_CSV      = '(cancelled,payment_failed)'

// ── Main data fetch ───────────────────────────────────────────────────────────

export async function getDashboardData(branchId?: string | null): Promise<DashboardData> {
  const sb         = createServiceClient()
  const todayStart = bhDayStart(0)
  const yestStart  = bhDayStart(1)
  const yestEnd    = bhDayStart(0)

  // All of today's orders (excluding cancelled/failed)
  let todayQ = sb
    .from('orders')
    .select('id, status, total_bhd, customer_name, branch_id, created_at, updated_at')
    .gte('created_at', todayStart.toISOString())
    .not('status', 'in', EXCLUDED_CSV)
  if (branchId) todayQ = todayQ.eq('branch_id', branchId)

  // Yesterday completed — for revenue trend
  let yestQ = sb
    .from('orders')
    .select('total_bhd')
    .gte('created_at', yestStart.toISOString())
    .lt('created_at', yestEnd.toISOString())
    .in('status', DONE_STATUSES)
  if (branchId) yestQ = yestQ.eq('branch_id', branchId)

  // Top items today (order_items joined to orders)
  let itemsQ = sb
    .from('order_items')
    .select('name_ar, name_en, quantity, orders!inner(created_at, status, branch_id)')
    .gte('orders.created_at', todayStart.toISOString())
    .not('orders.status', 'in', EXCLUDED_CSV)
  if (branchId) itemsQ = itemsQ.eq('orders.branch_id', branchId)

  const [
    { data: todayRows },
    { data: yestRows },
    { data: itemRows },
  ] = await Promise.all([todayQ, yestQ, itemsQ])

  // ── Compute ──────────────────────────────────────────────────────────────────

  type TodayRow = ActivityOrder
  const orders = (todayRows ?? []) as TodayRow[]

  // Revenue
  const isDone = (s: string): s is OrderStatus => DONE_STATUSES.includes(s as OrderStatus)
  const todayRevenue     = orders
    .filter(o => isDone(o.status))
    .reduce((s, o) => s + Number(o.total_bhd), 0)
  const yesterdayRevenue = ((yestRows ?? []) as { total_bhd: number }[])
    .reduce((s, r) => s + Number(r.total_bhd), 0)
  const totalOrdersToday = orders.length

  // Active breakdown
  const activeOrders: ActiveCounts = {
    new: 0, under_review: 0, accepted: 0, preparing: 0,
    ready: 0, out_for_delivery: 0, total: 0,
    longestId: null, longestMins: 0,
  }
  const now = Date.now()
  for (const o of orders) {
    if (!ACTIVE_STATUSES.includes(o.status)) continue
    if (o.status === 'new')               activeOrders.new++
    else if (o.status === 'under_review') activeOrders.under_review++
    else if (o.status === 'accepted')     activeOrders.accepted++
    else if (o.status === 'preparing')    activeOrders.preparing++
    else if (o.status === 'ready')        activeOrders.ready++
    else if (o.status === 'out_for_delivery') activeOrders.out_for_delivery++
    activeOrders.total++
    const waitMins = Math.floor((now - new Date(o.created_at).getTime()) / 60_000)
    if (waitMins > activeOrders.longestMins) {
      activeOrders.longestMins = waitMins
      activeOrders.longestId   = o.id
    }
  }

  // Completed + avg prep time
  const doneOrders     = orders.filter(o => isDone(o.status))
  const completedToday = doneOrders.length
  const avgPrepMins    = completedToday === 0 ? 0 : Math.round(
    doneOrders.reduce(
      (s, o) => s + (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60_000,
      0,
    ) / completedToday,
  )

  // Hourly distribution
  const hourlyMap = new Map<number, { revenue: number; orders: number }>()
  for (let h = 0; h < 24; h++) hourlyMap.set(h, { revenue: 0, orders: 0 })
  for (const o of orders) {
    const h   = getBHHour(o.created_at)
    const bkt = hourlyMap.get(h)!
    bkt.orders++
    if (isDone(o.status)) bkt.revenue += Number(o.total_bhd)
  }
  const hourlyPoints: HourlyPoint[] = Array.from(hourlyMap.entries()).map(([h, v]) => ({
    hour:    h,
    label:   hourLabel(h),
    revenue: Math.round(v.revenue * 1000) / 1000,
    orders:  v.orders,
  }))

  // Top items (by quantity)
  const itemMap = new Map<string, TopItem>()
  for (const row of ((itemRows ?? []) as { name_ar: string; name_en: string; quantity: number }[])) {
    const key = `${row.name_ar}::${row.name_en}`
    const ex  = itemMap.get(key)
    if (ex) { ex.total_quantity += Number(row.quantity) }
    else    { itemMap.set(key, { name_ar: row.name_ar, name_en: row.name_en, total_quantity: Number(row.quantity) }) }
  }
  const topItems = Array.from(itemMap.values())
    .sort((a, b) => b.total_quantity - a.total_quantity)
    .slice(0, 5)

  // Recent activity (last 15 by updated_at)
  const recentActivity = [...orders]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 15)

  return {
    todayRevenue, yesterdayRevenue, totalOrdersToday,
    completedToday, avgPrepMins,
    activeOrders, hourlyPoints, topItems, recentActivity,
  }
}
