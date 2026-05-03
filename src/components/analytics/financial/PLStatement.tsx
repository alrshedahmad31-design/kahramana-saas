import { colors } from '@/lib/design-tokens'
import type { CostSource } from '@/app/[locale]/dashboard/analytics/financial/page'

interface PLLine {
  label:    string
  labelAr:  string
  amount:   number
  pct?:     number
  indent?:  boolean
  bold?:    boolean
  positive?: boolean
  source?:  CostSource
}

interface Props {
  revenue:      number
  cogsPct:      number
  laborPct:     number
  overheadPct:  number
  currency:     string
  isRTL:        boolean
  cogsSource?:  CostSource
}

function SourceBadge({ source, isRTL }: { source: CostSource; isRTL: boolean }) {
  if (source === 'actual') return (
    <span className="ms-1.5 text-[10px] font-satoshi font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30">
      {isRTL ? 'فعلي' : 'Actual'}
    </span>
  )
  if (source === 'budget') return (
    <span className="ms-1.5 text-[10px] font-satoshi font-bold px-1.5 py-0.5 rounded bg-brand-gold/15 text-brand-gold border border-brand-gold/30">
      {isRTL ? 'هدف ميزانية' : 'Budget Target'}
    </span>
  )
  return (
    <span className="ms-1.5 text-[10px] font-satoshi font-bold px-1.5 py-0.5 rounded bg-brand-surface-2 text-brand-muted border border-brand-border">
      {isRTL ? 'تقدير' : 'Estimated'}
    </span>
  )
}

export default function PLStatement({ revenue, cogsPct, laborPct, overheadPct, currency, isRTL, cogsSource = 'estimated' }: Props) {
  const cogs     = revenue * cogsPct
  const labor    = revenue * laborPct
  const overhead = revenue * overheadPct
  const net      = revenue - cogs - labor - overhead
  const netPct   = revenue > 0 ? net / revenue : 0

  const lines: PLLine[] = [
    { label: 'Gross Revenue',        labelAr: 'الإيرادات الإجمالية', amount: revenue,          bold: true, positive: true },
    { label: 'Cost of Goods (COGS)', labelAr: 'تكلفة البضائع',       amount: -cogs,    pct: cogsPct,     indent: true, source: cogsSource },
    { label: 'Labor Cost',           labelAr: 'تكاليف العمالة',       amount: -labor,   pct: laborPct,    indent: true, source: 'estimated' },
    { label: 'Overhead',             labelAr: 'النفقات العامة',        amount: -overhead, pct: overheadPct, indent: true, source: 'estimated' },
    { label: 'Net Profit',           labelAr: 'صافي الربح',           amount: net, pct: netPct, bold: true, positive: true },
  ]

  return (
    <div className="space-y-0">
      {lines.map((line, i) => {
        const isDivider   = i === lines.length - 1
        const amountColor = line.positive
          ? (line.amount >= 0 ? colors.success : colors.error)
          : colors.error
        return (
          <div
            key={i}
            className={`flex items-center justify-between py-3 text-sm
                        ${isDivider ? 'border-t-2 border-brand-gold mt-2' : 'border-b border-brand-border/40'}
                        ${line.indent ? 'ps-4' : ''}`}
          >
            <span className={`flex items-center gap-0.5 flex-wrap ${line.bold ? 'font-bold text-brand-text' : 'text-brand-muted'}
                              ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? line.labelAr : line.label}
              {line.source && <SourceBadge source={line.source} isRTL={isRTL} />}
            </span>
            <div className={`text-end ${isRTL ? 'text-start' : ''}`}>
              <span
                className={`font-satoshi tabular-nums ${line.bold ? 'font-bold text-base' : 'font-medium'}`}
                style={{ color: line.positive ? (net >= 0 ? colors.success : colors.error) : amountColor }}
              >
                {line.amount >= 0 ? '' : '-'}{Math.abs(line.amount).toFixed(3)} {currency}
              </span>
              {line.pct !== undefined && (
                <span className="ms-2 text-xs text-brand-muted font-satoshi tabular-nums">
                  ({(Math.abs(line.pct) * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
