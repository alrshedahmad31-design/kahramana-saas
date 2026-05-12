'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { updateOrderStatus, updateOrderWithReason } from '@/app/[locale]/dashboard/orders/actions'
import { ALLOWED_TRANSITIONS, CAN_CANCEL } from '@/lib/auth/permissions'
import type { OrderStatus, StaffRole } from '@/lib/supabase/custom-types'
import PromptDialog from '@/components/ui/PromptDialog'

interface Props {
  orderId:       string
  currentStatus: OrderStatus
  userRole:      StaffRole | null
  onStatusChange?: (next: OrderStatus) => void
}

export default function OrderStatusSelect({
  orderId,
  currentStatus,
  userRole,
  onStatusChange,
}: Props) {
  const tS     = useTranslations('order.status')
  const tOrder = useTranslations('order')

  const [status,  setStatus]  = useState<OrderStatus>(currentStatus)
  const [error,   setError]   = useState<string | null>(null)
  const [pending, startTrans] = useTransition()
  const [reasonFor, setReasonFor] = useState<'cancelled' | 'returned' | null>(null)

  const allowed = (ALLOWED_TRANSITIONS[status] ?? []) as OrderStatus[]
  // Filter out 'cancelled' for roles that can't cancel
  const canCancel = userRole && CAN_CANCEL.includes(userRole)
  const options = canCancel
    ? allowed
    : allowed.filter((s) => s !== 'cancelled')

  if (options.length === 0) return null

  function handleChange(next: OrderStatus) {
    setError(null)

    if (next === 'cancelled' || next === 'returned') {
      setReasonFor(next)
      return
    }

    startTrans(async () => {
      const result = await updateOrderStatus(orderId, next)

      if (!result.success) {
        setError(result.error)
        return
      }

      setStatus(next)
      onStatusChange?.(next)
    })
  }

  function commitWithReason(reason: string) {
    const next = reasonFor
    setReasonFor(null)
    if (!next) return
    startTrans(async () => {
      const result = await updateOrderWithReason(orderId, reason, next)
      if (!result.success) {
        setError(result.error)
        return
      }
      setStatus(next)
      onStatusChange?.(next)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((next) => (
          <button
            key={next}
            type="button"
            disabled={pending}
            onClick={() => handleChange(next)}
            className="inline-flex items-center rounded-lg border border-brand-border
                       bg-brand-surface px-3 py-1.5
                       font-satoshi text-sm text-brand-text
                       hover:border-brand-gold hover:text-brand-gold
                       active:scale-95 transition-all duration-150
                       disabled:opacity-50 disabled:cursor-not-allowed
                       min-h-[36px]"
          >
            {pending ? (
              <span className="inline-block w-3 h-3 rounded border-2 border-brand-gold/30 border-t-brand-gold animate-spin me-1.5" />
            ) : null}
            {tS(next)}
          </button>
        ))}
      </div>

      {error && (
        <p className="font-satoshi text-xs text-brand-error">{error}</p>
      )}

      <PromptDialog
        isOpen={reasonFor !== null}
        title={reasonFor === 'returned' ? tOrder('returnReasonTitle') : tOrder('cancelReasonTitle')}
        onConfirm={commitWithReason}
        onCancel={() => setReasonFor(null)}
      />
    </div>
  )
}
