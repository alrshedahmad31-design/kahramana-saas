'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { startOfDay, endOfDay } from 'date-fns'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shiftClosings = (sb: any) => sb.from('shift_closings')

export async function getShiftSummary(branchId: string, date: string) {
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('total_bhd, status')
    .eq('branch_id', branchId)
    .gte('created_at', startOfDay(new Date(date)).toISOString())
    .lte('created_at', endOfDay(new Date(date)).toISOString())
    .in('status', ['delivered', 'completed'])

  if (error) throw error

  const expectedCash = (orders ?? []).reduce((sum, o) => sum + Number(o.total_bhd), 0)

  return {
    expectedCash,
    orderCount: (orders ?? []).length,
  }
}

export async function closeShift(data: {
  branch_id:           string
  shift_date:          string
  shift_type:          'morning' | 'evening' | 'night'
  actual_cash_bhd:     number
  expected_cash_bhd:   number
  total_orders:        number
  total_revenue_bhd:   number
  notes?:              string
  discrepancy_reason?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await shiftClosings(supabase).insert({
    ...data,
    closed_by: user.id,
    status: Math.abs(data.actual_cash_bhd - data.expected_cash_bhd) > 0.005
      ? 'flagged'
      : 'pending',
  })

  if (error) {
    console.error('Error closing shift:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/en/dashboard/shifts')
  return { success: true }
}

export async function approveShift(shiftId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await shiftClosings(supabase)
    .update({
      status:      'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', shiftId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/shifts')
  revalidatePath('/en/dashboard/shifts')
  return { success: true }
}
