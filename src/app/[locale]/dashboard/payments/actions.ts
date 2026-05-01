'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { canAccessPayments } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'

export async function refundPayment(
  paymentId: string,
  locale: string,
): Promise<{ success?: true; error?: string }> {
  const user = await getSession()
  if (!user) return { error: 'unauthenticated' }

  // Refunds restricted to owner + general_manager only
  if (user.role !== 'owner' && user.role !== 'general_manager') {
    return { error: 'insufficient_permissions' }
  }

  if (!canAccessPayments(user)) return { error: 'insufficient_permissions' }

  const supabase = await createClient()

  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('id, status, amount_bhd')
    .eq('id', paymentId)
    .single()

  if (fetchErr || !payment) return { error: 'payment_not_found' }
  if (payment.status !== 'completed') return { error: 'not_refundable' }

  const { error: updateErr } = await supabase
    .from('payments')
    .update({
      status:     'refunded',
      refunded_at: new Date().toISOString(),
      refund_amount_bhd: payment.amount_bhd,
    })
    .eq('id', paymentId)

  if (updateErr) return { error: 'update_failed' }

  revalidatePath(locale === 'en' ? '/en/dashboard/payments' : '/dashboard/payments')
  return { success: true }
}
