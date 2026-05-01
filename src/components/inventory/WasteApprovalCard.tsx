'use client'
import { useTransition, useState } from 'react'

interface Props {
  id: string
  ingredientName: string
  quantity: number
  reason: string
  costBhd: number
  escalationLevel: number
  reportedAt: string
  reporterName: string | null
  notes: string | null
  canApprove: boolean
  locale: string
  approveAction: (id: string) => Promise<{ error?: string }>
  rejectAction: (id: string, note: string) => Promise<{ error?: string }>
}

const REASON_LABELS: Record<string, string> = {
  expired:          'منتهي الصلاحية',
  damaged:          'تالف',
  spillage:         'انسكاب',
  overproduction:   'إنتاج زائد',
  quality:          'جودة سيئة',
  returned:         'مُرجَّع',
  theft_suspected:  'شبهة سرقة',
  prep_error:       'خطأ في التحضير',
  over_portioning:  'إفراط في التقديم',
  other:            'أخرى',
}

function escalationBadgeClass(level: number) {
  if (level === 3) return 'bg-brand-surface-2 text-brand-muted line-through'
  if (level === 2) return 'bg-red-500/10 text-red-400'
  if (level === 1) return 'bg-brand-gold/10 text-brand-gold'
  return 'bg-brand-surface-2 text-brand-muted'
}

function escalationLabel(level: number) {
  if (level === 3) return 'مغلق تلقائياً'
  if (level === 2) return 'مُصعَّد للمالك'
  if (level === 1) return 'مُصعَّد للمدير العام'
  return 'مستوى المدير'
}

function timeSince(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffH = Math.floor(diffMs / 3_600_000)
  const diffM = Math.floor((diffMs % 3_600_000) / 60_000)
  if (diffH > 0) return `منذ ${diffH} ساعة`
  return `منذ ${diffM} دقيقة`
}

export default function WasteApprovalCard({
  id, ingredientName, quantity, reason, costBhd,
  escalationLevel, reportedAt, reporterName, notes,
  canApprove, locale, approveAction, rejectAction,
}: Props) {
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
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="bg-brand-surface border border-brand-border rounded-xl p-4 flex flex-col gap-3"
    >
      {/* Escalation badge */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${escalationBadgeClass(escalationLevel)}`}>
          {escalationLabel(escalationLevel)}
        </span>
        <span className="font-satoshi text-xs text-brand-muted">{timeSince(reportedAt)}</span>
      </div>

      {/* Escalation warning */}
      {escalationLevel >= 2 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="font-satoshi text-xs text-red-400">⚠️ مُصعَّد للمالك — يتطلب مراجعة عاجلة</p>
        </div>
      )}

      {/* Details */}
      <div className="flex flex-col gap-1">
        <p className="font-cairo text-base font-bold text-brand-text">{ingredientName}</p>
        <p className="font-satoshi text-sm text-brand-muted">
          {isAr ? 'الكمية:' : 'Qty:'} <span className="text-brand-text">{quantity}</span>
        </p>
        <p className="font-satoshi text-sm text-brand-muted">
          {isAr ? 'السبب:' : 'Reason:'}{' '}
          <span className="text-brand-text">{REASON_LABELS[reason] ?? reason}</span>
        </p>
        <p className="font-satoshi text-sm text-brand-muted">
          {isAr ? 'التكلفة:' : 'Cost:'}{' '}
          <span className="text-brand-gold font-semibold">{costBhd.toFixed(3)} BD</span>
        </p>
        {reporterName && (
          <p className="font-satoshi text-xs text-brand-muted">
            {isAr ? 'بلّغ بواسطة:' : 'Reported by:'} {reporterName}
          </p>
        )}
        {notes && (
          <p className="font-satoshi text-xs text-brand-muted bg-brand-surface-2 rounded-lg px-3 py-2 mt-1">
            {notes}
          </p>
        )}
      </div>

      {/* Actions */}
      {canApprove && (
        <div className="flex flex-col gap-2">
          {error && (
            <p className="font-satoshi text-xs text-red-400">{error}</p>
          )}
          {!showReject ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleApprove}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 font-satoshi text-sm font-medium text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                {isPending ? '...' : isAr ? 'موافقة' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => setShowReject(true)}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 font-satoshi text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {isAr ? 'رفض' : 'Reject'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                placeholder={isAr ? 'سبب الرفض...' : 'Rejection reason...'}
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isPending}
                  className="inline-flex items-center rounded-lg bg-red-500/10 px-3 py-1.5 font-satoshi text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {isPending ? '...' : isAr ? 'تأكيد الرفض' : 'Confirm Reject'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReject(false); setError(null) }}
                  className="inline-flex items-center rounded-lg border border-brand-border px-3 py-1.5 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
