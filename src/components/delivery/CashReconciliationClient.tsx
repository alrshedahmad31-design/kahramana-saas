'use client'

import { useState }             from 'react'
import Link                     from 'next/link'
import type { CashHandoverRow, ReconciliationStatus } from '@/app/[locale]/dashboard/delivery/cash-reconciliation/page'

interface Props {
  handovers: CashHandoverRow[]
  isAr:      boolean
  prefix:    string
}

const TOLERANCE = 0.5

function formatDate(iso: string, isAr: boolean): string {
  return new Date(iso).toLocaleDateString(isAr ? 'ar-BH' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours() % 12 || 12).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

const STATUS_CFG: Record<ReconciliationStatus, { labelAr: string; labelEn: string; cls: string }> = {
  pending:     { labelAr: 'قيد الانتظار', labelEn: 'Pending',     cls: 'bg-orange-400/15 text-orange-400 border-orange-400/30' },
  verified:    { labelAr: 'تم التحقق',    labelEn: 'Verified',    cls: 'bg-brand-success/15 text-brand-success border-brand-success/30' },
  discrepancy: { labelAr: 'فرق في المبلغ', labelEn: 'Discrepancy', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  disputed:    { labelAr: 'خلاف',          labelEn: 'Disputed',    cls: 'bg-red-700/20 text-red-300 border-red-700/30' },
}

type FilterType = 'all' | ReconciliationStatus

export default function CashReconciliationClient({ handovers, isAr, prefix }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = handovers.filter(h =>
    filter === 'all' ? true : h.reconciliation_status === filter,
  )

  const pendingCount   = handovers.filter(h => h.reconciliation_status === 'pending').length
  const verifiedTotal  = handovers.filter(h => h.reconciliation_status === 'verified').reduce((s, h) => s + h.total_cash, 0)
  const discrepancySum = handovers.filter(h => h.reconciliation_status === 'discrepancy').reduce((s, h) => s + Math.abs(h.discrepancy ?? 0), 0)

  const filters: { key: FilterType; labelAr: string; labelEn: string }[] = [
    { key: 'all',         labelAr: 'الكل',          labelEn: 'All'         },
    { key: 'pending',     labelAr: 'قيد الانتظار',  labelEn: 'Pending'     },
    { key: 'verified',    labelAr: 'تم التحقق',     labelEn: 'Verified'    },
    { key: 'discrepancy', labelAr: 'فرق في المبلغ', labelEn: 'Discrepancy' },
    { key: 'disputed',    labelAr: 'خلاف',           labelEn: 'Disputed'    },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto flex flex-col gap-6" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'تسوية النقد' : 'Cash Reconciliation'}
          </h1>
          <p className={`text-sm text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'تتبع نقد السائقين وتوثيق التسليم' : 'Track driver cash handovers and verify receipt'}
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/delivery`}
          className={`text-xs text-brand-muted hover:text-brand-gold transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        >
          {isAr ? '← لوحة التوصيل' : '← Delivery Board'}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-orange-400/25 bg-orange-400/8 px-5 py-4">
          <p className={`text-xs font-bold uppercase tracking-wider text-orange-400 mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'قيد الانتظار' : 'Pending'}
          </p>
          <p className="font-satoshi font-black text-3xl text-orange-300 tabular-nums">
            {pendingCount}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-success/25 bg-brand-success/8 px-5 py-4">
          <p className={`text-xs font-bold uppercase tracking-wider text-brand-success mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'تم التحقق' : 'Verified'}
          </p>
          <p className="font-satoshi font-black text-3xl text-brand-success tabular-nums">
            {verifiedTotal.toFixed(3)} <span className="text-base font-medium text-brand-success/60">BD</span>
          </p>
        </div>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/8 px-5 py-4">
          <p className={`text-xs font-bold uppercase tracking-wider text-red-400 mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'إجمالي الفروقات' : 'Total Discrepancy'}
          </p>
          <p className="font-satoshi font-black text-3xl text-red-300 tabular-nums">
            {discrepancySum.toFixed(3)} <span className="text-base font-medium text-red-400">BD</span>
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`
              rounded-xl px-4 py-2 text-xs font-bold transition-colors duration-150
              ${filter === f.key
                ? 'bg-brand-gold text-brand-black'
                : 'bg-brand-surface-2 text-brand-muted border border-brand-border hover:text-brand-text'
              }
              ${isAr ? 'font-almarai' : 'font-satoshi'}
            `}
          >
            {isAr ? f.labelAr : f.labelEn}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-surface flex items-center justify-center py-16">
          <p className={`text-sm text-brand-muted/40 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'لا توجد سجلات' : 'No records'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(h => (
            <HandoverCard key={h.id} handover={h} isAr={isAr} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Per-row reconciliation card ───────────────────────────────────────────────

function HandoverCard({ handover: h, isAr }: { handover: CashHandoverRow; isAr: boolean }) {
  const [amount,    setAmount]    = useState('')
  const [notes,     setNotes]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState<ReconciliationStatus>(h.reconciliation_status)
  const [localDelta,  setLocalDelta]  = useState<number | null>(h.discrepancy)

  const parsed      = parseFloat(amount)
  const inputDelta  = Number.isFinite(parsed) ? parsed - h.total_cash : null
  const isWithin    = inputDelta != null && Math.abs(inputDelta) <= TOLERANCE
  const needsNotes  = inputDelta != null && Math.abs(inputDelta) > TOLERANCE
  const canSubmit   = Number.isFinite(parsed) && parsed >= 0 && (!needsNotes || notes.trim().length > 0)

  const cfg = STATUS_CFG[localStatus]

  async function handleReconcile() {
    if (loading || !canSubmit) return
    setLoading(true)
    setError(null)
    const { reconcileCashHandover } = await import('@/app/[locale]/dashboard/delivery/cash-reconciliation/actions')
    const result = await reconcileCashHandover({ handoverId: h.id, actualReceived: parsed, notes })
    setLoading(false)
    if ('error' in result) { setError(result.error); return }
    setLocalStatus(result.status)
    setLocalDelta(parsed - h.total_cash)
  }

  async function handleDispute() {
    if (loading || !notes.trim()) return
    setLoading(true)
    setError(null)
    const { disputeCashHandover } = await import('@/app/[locale]/dashboard/delivery/cash-reconciliation/actions')
    const result = await disputeCashHandover(h.id, notes)
    setLoading(false)
    if ('error' in result) { setError(result.error); return }
    setLocalStatus('disputed')
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <div>
            <p className={`font-black text-sm text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {h.driver_name}
            </p>
            <p className="font-satoshi text-xs text-brand-muted tabular-nums">
              {formatDate(h.shift_date, isAr)} · {formatTime(h.handed_at)} · {h.order_ids.length} {isAr ? 'طلبات' : 'orders'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-end">
            <p className="font-satoshi font-black text-xl text-brand-gold tabular-nums">
              {h.total_cash.toFixed(3)} <span className="text-xs font-medium text-brand-muted">BD</span>
            </p>
            {localStatus !== 'pending' && localDelta != null && (
              <p className={`font-satoshi text-xs tabular-nums ${localDelta >= 0 ? 'text-brand-success' : 'text-red-400'}`}>
                {localDelta >= 0 ? '+' : ''}{localDelta.toFixed(3)} BD
              </p>
            )}
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${cfg.cls} ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? cfg.labelAr : cfg.labelEn}
          </span>
        </div>
      </div>

      {/* Reconciliation panel — only shown for pending */}
      {localStatus === 'pending' && (
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Amount input */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className={`block text-xs font-bold text-brand-muted uppercase tracking-wider mb-1.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? 'المبلغ المستلم فعلياً (BD)' : 'Actual Amount Received (BD)'}
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={h.total_cash.toFixed(3)}
                className="w-full rounded-xl bg-brand-surface-2 border border-brand-border px-4 py-2.5 font-satoshi font-black text-lg text-brand-text tabular-nums placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-gold/60"
                dir="ltr"
              />
            </div>
            {/* Real-time delta display */}
            {inputDelta != null && (
              <div className={`shrink-0 rounded-xl px-4 py-2.5 border ${isWithin ? 'bg-brand-success/10 border-brand-success/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isWithin ? 'text-brand-success' : 'text-red-400'} ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'الفرق' : 'Delta'}
                </p>
                <p className={`font-satoshi font-black text-lg tabular-nums ${isWithin ? 'text-brand-success' : 'text-red-400'}`}>
                  {inputDelta >= 0 ? '+' : ''}{inputDelta.toFixed(3)}
                </p>
              </div>
            )}
          </div>

          {/* Notes field — required when discrepancy exceeds tolerance */}
          {(needsNotes || notes.length > 0) && (
            <div>
              <label className={`block text-xs font-bold text-brand-muted uppercase tracking-wider mb-1.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? 'ملاحظات المدير' : 'Manager Notes'}
                {needsNotes && <span className="text-red-400 ms-1">*</span>}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={isAr ? 'سبب الفرق في المبلغ…' : 'Reason for discrepancy…'}
                className={`w-full rounded-xl bg-brand-surface-2 border border-brand-border px-4 py-2.5 text-sm text-brand-text placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-gold/60 resize-none ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              />
            </div>
          )}

          {error && (
            <p className={`text-xs text-red-400 font-bold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              ⚠️ {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReconcile}
              disabled={loading || !canSubmit}
              className={`
                flex-[2] rounded-xl py-2.5 font-black text-sm transition-colors duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isWithin
                  ? 'bg-brand-success text-brand-black'
                  : 'bg-orange-400/20 text-orange-300 border border-orange-400/30 hover:bg-orange-400/30'
                }
                ${isAr ? 'font-almarai' : 'font-satoshi'}
              `}
            >
              {loading ? '…' : isWithin
                ? (isAr ? 'تأكيد التسوية ✓' : 'Verify ✓')
                : (isAr ? 'تسجيل الفرق' : 'Record Discrepancy')
              }
            </button>
            <button
              type="button"
              onClick={handleDispute}
              disabled={loading || !notes.trim()}
              className={`
                flex-1 rounded-xl py-2.5 font-bold text-xs transition-colors duration-150
                bg-red-700/20 text-red-300 border border-red-700/30
                hover:bg-red-700/30 disabled:opacity-40 disabled:cursor-not-allowed
                ${isAr ? 'font-almarai' : 'font-satoshi'}
              `}
            >
              {loading ? '…' : (isAr ? 'طعن' : 'Dispute')}
            </button>
          </div>
        </div>
      )}

      {/* Settled state — show final figures */}
      {localStatus !== 'pending' && (
        <div className="px-5 py-3 bg-brand-surface-2/40 border-t border-brand-border">
          <div className="flex items-start gap-4 flex-wrap">
            {h.actual_received != null && (
              <div>
                <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'المستلم فعلياً' : 'Actual Received'}
                </p>
                <p className="font-satoshi font-black text-sm text-brand-text tabular-nums">
                  {h.actual_received.toFixed(3)} BD
                </p>
              </div>
            )}
            {h.manager_notes && (
              <div className="flex-1">
                <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'ملاحظات' : 'Notes'}
                </p>
                <p className={`text-xs text-brand-muted leading-snug ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {h.manager_notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
