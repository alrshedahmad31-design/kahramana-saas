import type { KDSStation } from '@/lib/supabase/custom-types'

// Stations that take longer to prepare get higher urgency earlier
const STATION_COMPLEXITY: Partial<Record<KDSStation, number>> = {
  shawarma: 3,
  bakery:   4,
  appetizer_drinks: 2,
  grill:    5,
  main:     3,
}

// Returns priority 1–5 (5 = most urgent)
export function calculatePriority(
  orderCreatedAt: string,
  station: KDSStation,
  quantity = 1,
  now = Date.now(),
): number {
  const ageMinutes = (now - new Date(orderCreatedAt).getTime()) / 60_000
  const complexity = STATION_COMPLEXITY[station] ?? 2
  let score = ageMinutes / 2 + complexity * 0.5
  if (quantity >= 3) score += 1
  return Math.min(5, Math.max(1, Math.round(score)))
}

// Age thresholds (minutes) — warning at 10 min, urgent at 15 min
export const KDS_THRESHOLDS = { warning: 10, overdue: 15 } as const

export function getAgeStatus(createdAt: string, now = Date.now()): 'fresh' | 'warning' | 'overdue' {
  const age = (now - new Date(createdAt).getTime()) / 60_000
  if (age < KDS_THRESHOLDS.warning) return 'fresh'
  if (age < KDS_THRESHOLDS.overdue) return 'warning'
  return 'overdue'
}

export function formatElapsed(createdAt: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
