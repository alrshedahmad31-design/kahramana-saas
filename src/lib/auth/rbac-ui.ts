// Client-safe section access helper — no DB calls, role string only.
// Server-side page guards live in src/lib/auth/rbac.ts (AuthUser-based).
// Keep SECTION_ROLES in sync with the canAccess* functions in rbac.ts.

import type { StaffRole } from '@/lib/supabase/custom-types'

export type DashboardSection =
  | 'home'
  | 'orders'
  | 'driver'
  | 'kds'
  | 'staff'
  | 'coupons'
  | 'analytics'
  | 'payments'
  | 'reports'
  | 'schedule'
  | 'settings'

const SECTION_ROLES: Record<DashboardSection, StaffRole[] | null> = {
  home:      null,  // unrestricted — dashboard overview for all staff
  orders:    ['owner', 'general_manager', 'branch_manager', 'cashier'],
  driver:    ['owner', 'general_manager', 'branch_manager', 'driver'],
  kds:       ['owner', 'general_manager', 'branch_manager', 'kitchen'],
  staff:     ['owner', 'general_manager', 'branch_manager'],
  coupons:   ['owner', 'general_manager', 'branch_manager', 'marketing'],
  analytics: ['owner', 'general_manager', 'branch_manager'],
  payments:  ['owner', 'general_manager', 'branch_manager'],
  reports:   ['owner', 'general_manager'],
  schedule:  ['owner', 'general_manager', 'branch_manager'],
  settings:  ['owner', 'general_manager'],
}

export function canAccessSection(
  role: StaffRole | null,
  section: DashboardSection,
): boolean {
  if (!role) return false
  const allowed = SECTION_ROLES[section]
  if (allowed === null) return true
  return allowed.includes(role)
}

export function getAccessibleSections(role: StaffRole | null): DashboardSection[] {
  if (!role) return []
  return (Object.keys(SECTION_ROLES) as DashboardSection[]).filter(
    (section) => canAccessSection(role, section),
  )
}
