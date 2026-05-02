import Link from 'next/link'

interface WasteCount {
  level_0: number
  level_1: number
  level_2: number
}

interface Props {
  counts: WasteCount
  prefix: string
  isAr?: boolean
}

export default function WasteEscalationWidget({ counts, prefix, isAr = true }: Props) {
  const total   = counts.level_0 + counts.level_1 + counts.level_2
  const hasCrit = counts.level_2 > 0

  if (total === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-3 h-full">
        <WidgetHeader hasCrit={false} prefix={prefix} isAr={isAr} />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-satoshi text-sm text-brand-muted text-center py-4">
            {isAr ? '✅ لا يوجد هدر معلَّق' : '✅ No pending waste'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-4 h-full">
      <WidgetHeader hasCrit={hasCrit} prefix={prefix} isAr={isAr} />

      <div className="flex flex-col gap-2">
        <EscalationRow
          count={counts.level_0}
          label={isAr ? 'بانتظار مدير الفرع' : 'Awaiting BM approval'}
          color="muted"
        />
        <EscalationRow
          count={counts.level_1}
          label={isAr ? 'مُصعَّد للمدير العام' : 'Escalated to GM'}
          color="gold"
        />
        <EscalationRow
          count={counts.level_2}
          label={isAr ? 'مُصعَّد للمالك' : 'Escalated to Owner'}
          color="red"
          pulse={hasCrit}
        />
      </div>

      <Link
        href={`${prefix}/dashboard/inventory/waste?status=pending`}
        className="mt-auto font-satoshi text-xs text-brand-gold hover:text-brand-goldLight transition-colors duration-150 text-center py-2 border border-brand-gold/20 rounded-lg hover:border-brand-gold/40"
      >
        {isAr ? 'عرض الهدر المعلَّق' : 'View pending waste'}
      </Link>
    </div>
  )
}

function WidgetHeader({ hasCrit, isAr }: { hasCrit: boolean; prefix: string; isAr: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-gold shrink-0 relative">
          <TrashIcon />
          {hasCrit && (
            <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <h3 className="font-satoshi font-bold text-sm text-brand-text">
          {isAr ? 'تصعيد الهدر' : 'Waste Escalation'}
        </h3>
      </div>
    </div>
  )
}

function EscalationRow({
  count,
  label,
  color,
  pulse = false,
}: {
  count:  number
  label:  string
  color:  'muted' | 'gold' | 'red'
  pulse?: boolean
}) {
  if (count === 0) return null

  const colorMap = {
    muted: 'text-brand-muted bg-brand-surface-2 border-brand-border',
    gold:  'text-brand-gold bg-brand-gold/10 border-brand-gold/20',
    red:   'text-red-400 bg-red-500/10 border-red-500/20',
  }

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${colorMap[color]}`}>
      <div className="flex items-center gap-2">
        {pulse && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
        <span className="font-satoshi text-sm">{label}</span>
      </div>
      <span className="font-satoshi font-black text-lg tabular-nums">{count}</span>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}
