import type { AuthUser } from './session'
import type { OrderRow, StaffBasicRow, StaffRole, OrderStatus } from '@/lib/supabase/custom-types'
import { ALLOWED_TRANSITIONS, CAN_CANCEL } from './permissions'

// ── Role hierarchy ────────────────────────────────────────────────────────────

export const ROLE_RANK: Record<StaffRole, number> = {
  owner:           9,
  general_manager: 8,
  branch_manager:  7,
  cashier:         3,
  kitchen:         3,
  driver:          2,
  inventory:       2,
  marketing:       1,
  support:         1,
}

function rankOf(role: StaffRole | null | undefined): number {
  return role ? (ROLE_RANK[role] ?? 0) : 0
}

function isGlobalAdmin(user: AuthUser): boolean {
  return user.role === 'owner' || user.role === 'general_manager'
}

function isSameBranch(user: AuthUser, branchId: string | null): boolean {
  return user.branch_id !== null && user.branch_id === branchId
}

// ── Order permissions ─────────────────────────────────────────────────────────

export function canViewOrder(user: AuthUser, order: Pick<OrderRow, 'branch_id'>): boolean {
  if (!user.role) return false
  if (isGlobalAdmin(user)) return true
  return isSameBranch(user, order.branch_id)
}

// Which roles can set each status (not transitions — that's validated separately)
const STATUS_ALLOWED_ROLES: Partial<Record<OrderStatus, StaffRole[]>> = {
  under_review:     ['owner', 'general_manager', 'branch_manager', 'cashier'],
  accepted:         ['owner', 'general_manager', 'branch_manager', 'cashier'],
  preparing:        ['owner', 'general_manager', 'branch_manager', 'kitchen'],
  ready:            ['owner', 'general_manager', 'branch_manager', 'kitchen'],
  out_for_delivery: ['owner', 'general_manager', 'branch_manager', 'driver'],
  delivered:        ['owner', 'general_manager', 'branch_manager', 'driver'],
  completed:        ['owner', 'general_manager', 'branch_manager'],
  cancelled:        CAN_CANCEL,
}

export function canUpdateOrderStatus(
  user: AuthUser,
  order: Pick<OrderRow, 'branch_id' | 'status'>,
  newStatus?: OrderStatus,
): boolean {
  if (!user.role) return false
  if (!canViewOrder(user, order)) return false
  if (!newStatus) return true // just checking general update ability

  const validTransitions = ALLOWED_TRANSITIONS[order.status] ?? []
  if (!validTransitions.includes(newStatus)) return false

  const allowedRoles = STATUS_ALLOWED_ROLES[newStatus]
  if (!allowedRoles) return false
  return allowedRoles.includes(user.role)
}

export function canCancelOrder(
  user: AuthUser,
  order: Pick<OrderRow, 'branch_id' | 'status'>,
): boolean {
  return canUpdateOrderStatus(user, order, 'cancelled')
}

// ── Staff permissions ─────────────────────────────────────────────────────────

export function canViewStaff(
  user: AuthUser,
  target: Pick<StaffBasicRow, 'id' | 'branch_id'>,
): boolean {
  if (!user.role) return false
  if (user.id === target.id) return true
  if (isGlobalAdmin(user)) return true
  if (user.role === 'branch_manager') return isSameBranch(user, target.branch_id)
  return false
}

export function canManageStaff(
  user: AuthUser,
  target: Pick<StaffBasicRow, 'id' | 'role' | 'branch_id'>,
): boolean {
  if (!user.role) return false
  if (user.id === target.id) return false // managed via canUpdateOwnInfo (separate flow)

  if (user.role === 'owner') {
    return target.role !== 'owner'
  }

  if (user.role === 'general_manager') {
    return target.role !== 'owner' && target.role !== 'general_manager'
  }

  if (user.role === 'branch_manager') {
    return (
      isSameBranch(user, target.branch_id) &&
      !(['owner', 'general_manager', 'branch_manager'] as StaffRole[]).includes(target.role)
    )
  }

  return false
}

// Roles that a given user is allowed to assign to new or existing staff
const ASSIGNABLE_BY: Record<StaffRole, StaffRole[]> = {
  owner: [
    'general_manager', 'branch_manager',
    'cashier', 'kitchen', 'driver', 'inventory', 'marketing', 'support',
  ],
  general_manager: [
    'branch_manager',
    'cashier', 'kitchen', 'driver', 'inventory', 'marketing', 'support',
  ],
  branch_manager: ['cashier', 'kitchen', 'driver', 'inventory', 'marketing', 'support'],
  cashier:        [],
  kitchen:        [],
  driver:         [],
  inventory:      [],
  marketing:      [],
  support:        [],
}

export function canAssignRole(user: AuthUser, targetRole: StaffRole): boolean {
  if (!user.role) return false
  return (ASSIGNABLE_BY[user.role] ?? []).includes(targetRole)
}

export function canDeactivateStaff(
  user: AuthUser,
  target: Pick<StaffBasicRow, 'id' | 'role' | 'branch_id'>,
): boolean {
  if (user.id === target.id) return false // cannot deactivate yourself
  return canManageStaff(user, target)
}

// ── Page-level access guards (used in Server Components) ──────────────────────

export function canAccessStaffPage(user: AuthUser): boolean {
  return rankOf(user.role) >= rankOf('branch_manager')
}

export function canAccessAuditLog(user: AuthUser): boolean {
  return isGlobalAdmin(user)
}

// Kitchen staff + branch_manager and above can access KDS
export function canAccessKDS(user: AuthUser): boolean {
  if (!user.role) return false
  return user.role === 'kitchen' || rankOf(user.role) >= rankOf('branch_manager')
}

// Driver role only (branch_manager+ can view but not use the driver app)
export function canAccessDriver(user: AuthUser): boolean {
  if (!user.role) return false
  return user.role === 'driver' || rankOf(user.role) >= rankOf('branch_manager')
}

// Coupon management: branch_manager+ and marketing
export function canManageCoupons(user: AuthUser): boolean {
  if (!user.role) return false
  return rankOf(user.role) >= rankOf('branch_manager') || user.role === 'marketing'
}

// Analytics dashboard: branch_manager+
export function canAccessAnalytics(user: AuthUser): boolean {
  if (!user.role) return false
  return rankOf(user.role) >= rankOf('branch_manager')
}

// Reports (export): owner + general_manager only
export function canAccessReports(user: AuthUser): boolean {
  if (!user.role) return false
  return isGlobalAdmin(user)
}

// Schedule management: branch_manager and above
export function canManageSchedule(user: AuthUser): boolean {
  if (!user.role) return false
  return rankOf(user.role) >= rankOf('branch_manager')
}

// System settings: owner and general_manager only
export function canManageSettings(user: AuthUser): boolean {
  if (!user.role) return false
  return isGlobalAdmin(user)
}

// Payment records: branch_manager and above
export function canAccessPayments(user: AuthUser): boolean {
  if (!user.role) return false
  return rankOf(user.role) >= rankOf('branch_manager')
}
