'use client'
import { useTransition, useState } from 'react'

interface Props {
  id: string
  locale: string
  approveAction: (id: string) => Promise<{ error?: string }>
  rejectAction: (id: string, note: string) => Promise<{ error?: string }>
}

export default function WasteActionButtons({ id, locale, approveAction, rejectAction }: Props) {
  const isAr = locale !== 'en'
  const [isPending, startTransition] = useTransition()
  const [showReject, setShowReject] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleApprove() {
    startTransition(async () => {
      const result = await approveAction(id)
      if (result.error) setError(result.error)
    })
  }

  function handleReject() {
    if (!rejectNote.trim()) {
      setError(isAr ? 'يرجى إدخال سبب الرفض' : 'Please enter a rejection reason')
      return
    }
    startTransition(async () => {
      const result = await rejectAction(id, rejectNote)
      if (result.error) setError(result.error)
      else setShowReject(false)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      {error && (
        <p className="font-satoshi text-xs text-red-400">{error}</p>
      )}
      {!showReject ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="inline-flex items-center rounded-lg bg-green-500/10 px-2 py-1 font-satoshi text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            {isPending ? '...' : isAr ? 'موافقة' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={isPending}
            className="inline-flex items-center rounded-lg bg-red-500/10 px-2 py-1 font-satoshi text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {isAr ? 'رفض' : 'Reject'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1 min-w-[180px]">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={2}
            placeholder={isAr ? 'سبب الرفض...' : 'Rejection reason...'}
            className="w-full rounded-lg border border-brand-border bg-brand-surface px-2 py-1 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              className="inline-flex items-center rounded-lg bg-red-500/10 px-2 py-1 font-satoshi text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {isPending ? '...' : isAr ? 'تأكيد الرفض' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => { setShowReject(false); setError(null) }}
              className="inline-flex items-center rounded-lg border border-brand-border px-2 py-1 font-satoshi text-xs font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
