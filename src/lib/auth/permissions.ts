import type { StaffRole } from '@/lib/supabase/custom-types'

// Roles allowed to cancel orders
export const CAN_CANCEL: StaffRole[] = ['owner', 'general_manager', 'branch_manager']

// Valid status transitions per the restaurant workflow
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new:              ['under_review', 'accepted', 'cancelled'],
  under_review:     ['accepted', 'cancelled'],
  accepted:         ['preparing', 'cancelled'],
  preparing:        ['ready'],
  ready:            ['out_for_delivery', 'completed'],
  out_for_delivery: ['delivered'],
  delivered:        ['completed'],
  completed:        [],
  cancelled:        [],
  payment_failed:   ['new', 'cancelled'],
}
