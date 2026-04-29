export const BH_TIMEZONE = 'Asia/Bahrain'

// ── Growth ────────────────────────────────────────────────────────────────────

export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function calculateAverageOrderValue(totalRevenue: number, orderCount: number): number {
  if (orderCount === 0) return 0
  return totalRevenue / orderCount
}

export function calculateConversionRate(views: number, orders: number): number {
  if (views === 0) return 0
  return (orders / views) * 100
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return amount.toFixed(3)
}

export function formatPercentage(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

// ── Date range helpers ────────────────────────────────────────────────────────

export type RangeLabel = '7d' | '30d' | '90d' | 'all' | 'custom'

export interface DateRange {
  from: Date
  to:   Date
  label: RangeLabel
}

// Returns the calendar date (midnight local) in Bahrain timezone
function bhToday(): Date {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: BH_TIMEZONE }) // 'YYYY-MM-DD'
  return new Date(s + 'T00:00:00')
}

export function buildDateRange(
  rangeParam: string,
  fromParam?: string,
  toParam?:   string,
): DateRange {
  const now = new Date()

  if (rangeParam === 'custom' && fromParam && toParam) {
    return {
      from:  new Date(fromParam + 'T00:00:00'),
      to:    new Date(toParam   + 'T23:59:59'),
      label: 'custom',
    }
  }

  if (rangeParam === 'all') {
    return { from: new Date('2024-01-01T00:00:00'), to: now, label: 'all' }
  }

  const days  = rangeParam === '90d' ? 90 : rangeParam === '30d' ? 30 : 7
  const label: RangeLabel = rangeParam === '90d' ? '90d' : rangeParam === '30d' ? '30d' : '7d'
  const from  = bhToday()
  from.setDate(from.getDate() - (days - 1))

  return { from, to: now, label }
}

export function buildPrevRange(current: DateRange): { from: Date; to: Date } {
  const duration = current.to.getTime() - current.from.getTime()
  const prevTo   = new Date(current.from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - duration)
  return { from: prevFrom, to: prevTo }
}

// Formats 'YYYY-MM-DD' for display: 'Apr 28'
export function formatDateShort(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-GB', {
    month: 'short',
    day:   'numeric',
  })
}

// Fill gaps in daily_sales so charts have a point for every day in the range
export function fillDailyGaps<T extends { order_date: string }>(
  rows: T[],
  from: Date,
  to:   Date,
  defaults: Omit<T, 'order_date'>,
): T[] {
  const byDate = new Map(rows.map((r) => [r.order_date, r]))
  const result: T[] = []
  const cur = new Date(from)
  cur.setHours(0, 0, 0, 0)

  while (cur <= to) {
    const key = cur.toISOString().slice(0, 10) // 'YYYY-MM-DD'
    result.push(byDate.get(key) ?? ({ ...defaults, order_date: key } as T))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}
