import { getSession, type AuthUser } from '@/lib/auth/session'
import { canAccessSection, type DashboardSection } from '@/lib/auth/rbac-ui'
import { canAssignRole } from '@/lib/auth/rbac'
import type { OrderRow, StaffRole } from '@/lib/supabase/custom-types'

export class DashboardGuardError extends Error {
  constructor(
    message: string,
    public readonly code: 'unauthorized' | 'forbidden' = 'forbidden',
  ) {
    super(message)
    this.name = 'DashboardGuardError'
  }
}

export function isDashboardGuardError(error: unknown): error is DashboardGuardError {
  return error instanceof DashboardGuardError
}

export function getDashboardGuardErrorMessage(error: unknown): string {
  if (isDashboardGuardError(error)) return error.message
  return error instanceof Error ? error.message : 'Forbidden'
}

export async function requireDashboardSession(): Promise<AuthUser> {
  const session = await getSession()
  if (!session || !session.role) {
    throw new DashboardGuardError('Unauthorized', 'unauthorized')
  }
  return session
}

export async function requireDashboardRole(
  allowedRoles: readonly StaffRole[],
): Promise<AuthUser> {
  const session = await requireDashboardSession()
  if (!allowedRoles.includes(session.role as StaffRole)) {
    throw new DashboardGuardError('Forbidden')
  }
  return session
}

export async function requireDashboardSection(
  section: DashboardSection,
): Promise<AuthUser> {
  const session = await requireDashboardSession()
  if (!canAccessSection(session.role, section)) {
    throw new DashboardGuardError('Forbidden')
  }
  return session
}

export function isGlobalDashboardAdmin(session: Pick<AuthUser, 'role'>): boolean {
  return session.role === 'owner' || session.role === 'general_manager'
}

export function assertBranchScope(
  session: Pick<AuthUser, 'role' | 'branch_id'>,
  branchId: string | null | undefined,
): void {
  if (isGlobalDashboardAdmin(session)) return
  if (!branchId || !session.branch_id || session.branch_id !== branchId) {
    throw new DashboardGuardError('Forbidden: branch scope violation')
  }
}

export function assertCanManageTargetStaff(
  session: AuthUser,
  targetRole: StaffRole,
  targetBranchId: string | null,
): void {
  if (!session.role) throw new DashboardGuardError('Unauthorized', 'unauthorized')

  if (targetRole === 'owner') {
    if (session.role !== 'owner') throw new DashboardGuardError('Only owners can manage owner accounts')
  } else if (!canAssignRole(session, targetRole)) {
    throw new DashboardGuardError('Forbidden: role assignment is not allowed')
  }

  if (session.role === 'branch_manager') {
    if (!targetBranchId || !session.branch_id || targetBranchId !== session.branch_id) {
      throw new DashboardGuardError('Forbidden: branch managers can only manage their own branch')
    }
    if (['owner', 'general_manager', 'branch_manager'].includes(targetRole)) {
      throw new DashboardGuardError('Forbidden: branch managers cannot assign manager roles')
    }
  }
}

export function assertOrderScope(
  session: AuthUser,
  order: Pick<OrderRow, 'branch_id' | 'assigned_driver_id'>,
): void {
  if (!session.role) throw new DashboardGuardError('Unauthorized', 'unauthorized')
  if (session.role === 'driver') {
    if (order.assigned_driver_id !== session.id) {
      throw new DashboardGuardError('Forbidden: drivers can only access assigned orders')
    }
    return
  }
  assertBranchScope(session, order.branch_id)
}

export function assertInventoryWriteAccess(
  session: AuthUser,
  branchId: string | null | undefined,
): void {
  if (!session.role) throw new DashboardGuardError('Unauthorized', 'unauthorized')
  if (!['owner', 'general_manager', 'branch_manager', 'inventory_manager'].includes(session.role)) {
    throw new DashboardGuardError('Forbidden: inventory write access denied')
  }
  if (!branchId) {
    throw new DashboardGuardError('Forbidden: inventory writes require a branch')
  }
  assertBranchScope(session, branchId)
}
