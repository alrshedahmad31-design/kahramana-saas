'use client'

import { useState } from 'react'
import { submitDriverIssue } from '@/app/[locale]/driver/actions'

const ISSUE_REASONS = [
  'العميل لا يرد',
  'العنوان غير واضح',
  'العميل رفض الاستلام',
  'تأخير من المطبخ',
  'مشكلة في السيارة',
  'نقص في الطلب',
  'مشكلة أخرى',
] as const

interface Props {
  orderId: string
  orderRef: string
  isRTL: boolean
  onClose: () => void
}

export default function IssueReportModal({ orderId, orderRef, isRTL, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [notes,    setNotes]    = useState('')
  const [busy,     setBusy]     = useState(false)
  const [done,     setDone]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit() {
    if (!selected || busy || done) return
    setBusy(true)
    setError(null)
    const result = await submitDriverIssue(orderId, selected, notes || undefined)
    setBusy(false)
    if (!result.success) {
      setError(isRTL ? 'فشل الإرسال — حاول مجدداً' : 'Failed to submit — try again')
      return
    }
    setDone(true)
    setTimeout(onClose, 1_400)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brand-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div className="relative w-full max-w-lg bg-brand-surface border-t border-brand-border rounded-t-3xl overflow-hidden shadow-2xl">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brand-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-brand-border">
          <h2 className={`font-black text-base text-brand-text ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
            {isRTL ? `مشكلة في طلب #${orderRef}` : `Issue — Order #${orderRef}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-muted hover:text-brand-text transition-colors"
            aria-label={isRTL ? 'إغلاق' : 'Close'}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 pt-4 pb-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">

          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-14 h-14 rounded-full bg-brand-success/20 border border-brand-success/30 flex items-center justify-center">
                <CheckBigIcon />
              </div>
              <p className={`font-black text-lg text-brand-success ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                {isRTL ? 'تم الإرسال' : 'Submitted'}
              </p>
              <p className={`text-sm text-brand-muted text-center ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? 'تم إبلاغ المدير بالمشكلة' : 'Manager has been notified'}
              </p>
            </div>
          ) : (
            <>
              {/* Reason grid */}
              <div>
                <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-3 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'نوع المشكلة' : 'Issue type'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ISSUE_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelected(reason)}
                      className={`
                        rounded-xl px-3 py-3 min-h-[52px] text-start transition-all duration-150
                        font-bold text-sm leading-snug
                        ${isRTL ? 'font-almarai' : 'font-satoshi'}
                        ${selected === reason
                          ? 'bg-brand-gold/15 border-2 border-brand-gold text-brand-gold'
                          : 'bg-brand-surface-2 border border-brand-border text-brand-muted hover:border-brand-gold/40 hover:text-brand-text'
                        }
                      `}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional notes */}
              <div>
                <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-2 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'تفاصيل إضافية (اختياري)' : 'Additional notes (optional)'}
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder={isRTL ? 'اكتب ملاحظاتك هنا...' : 'Add details here...'}
                  className={`
                    w-full rounded-xl bg-brand-surface-2 border border-brand-border
                    px-3 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/50
                    focus:outline-none focus:border-brand-gold/50
                    resize-none transition-colors duration-150
                    ${isRTL ? 'font-almarai' : 'font-satoshi'}
                  `}
                />
              </div>

              {error && (
                <p className={`text-sm text-brand-error ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex-1 min-h-[52px] rounded-2xl border border-brand-border bg-brand-surface-2 font-bold text-sm text-brand-muted hover:text-brand-text transition-colors duration-150 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selected || busy}
                  className={`
                    flex-[2] min-h-[52px] rounded-2xl font-black text-sm
                    transition-all duration-150 active:scale-[0.98]
                    disabled:opacity-40 disabled:cursor-not-allowed
                    ${isRTL ? 'font-cairo' : 'font-satoshi'}
                    ${!selected
                      ? 'bg-brand-surface-2 text-brand-muted border border-brand-border'
                      : 'bg-brand-error text-white'
                    }
                  `}
                >
                  {busy ? '…' : (isRTL ? 'إرسال البلاغ' : 'Submit Issue')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function CheckBigIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-brand-success" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}
