import type { StaffRole } from '@/lib/supabase/custom-types'

// Roles allowed to cancel orders
export const CAN_CANCEL: StaffRole[] = ['owner', 'general_manager', 'branch_manager']

// Valid status transitions per the restaurant workflow
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new:              ['under_review', 'accepted', 'cancelled'],
  under_review:     ['accepted', 'cancelled'],
  pending_payment:  ['cancelled'],
  confirmed:        ['accepted', 'cancelled'],
  accepted:         ['preparing', 'cancelled'],
  preparing:        ['ready', 'cancelled'],
  ready:            ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['delivered', 'ready', 'cancelled', 'delivery_failed'],
  delivery_failed:  ['ready', 'cancelled'],
  delivered:        ['completed', 'cancelled', 'returned'],
  completed:        [],
  cancelled:        [],
  payment_failed:   ['new', 'cancelled'],
}
