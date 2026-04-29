import { colors } from '@/lib/design-tokens'

interface PLLine {
  label:   string
  labelAr: string
  amount:  number
  pct?:    number
  indent?: boolean
  bold?:   boolean
  positive?: boolean
}

interface Props {
  revenue:      number
  cogsPct:      number  // e.g. 0.30
  laborPct:     number  // e.g. 0.28
  overheadPct:  number  // e.g. 0.15
  currency:     string
  isRTL:        boolean
}

export default function PLStatement({ revenue, cogsPct, laborPct, overheadPct, currency, isRTL }: Props) {
  const cogs     = revenue * cogsPct
  const labor    = revenue * laborPct
  const overhead = revenue * overheadPct
  const net      = revenue - cogs - labor - overhead
  const netPct   = revenue > 0 ? net / revenue : 0

  const lines: PLLine[] = [
    { label: 'Gross Revenue',       labelAr: 'الإيرادات الإجمالية', amount: revenue,         bold: true, positive: true },
    { label: 'Cost of Goods (COGS)', labelAr: 'تكلفة البضائع',      amount: -cogs,    pct: cogsPct,    indent: true },
    { label: 'Labor Cost',          labelAr: 'تكاليف العمالة',       amount: -labor,   pct: laborPct,   indent: true },
    { label: 'Overhead',            labelAr: 'النفقات العامة',        amount: -overhead,pct: overheadPct, indent: true },
    { label: 'Net Profit',          labelAr: 'صافي الربح',           amount: net, pct: netPct, bold: true, positive: true },
  ]

  return (
    <div className="space-y-0">
      {lines.map((line, i) => {
        const isDivider = i === lines.length - 1
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
            <span className={`${line.bold ? 'font-bold text-brand-text' : 'text-brand-muted'}
                              ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? line.labelAr : line.label}
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
                  ({(Math.abs(line.pct) * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
        )
      })}

      {revenue === 0 && (
        <p className={`text-xs text-brand-muted mt-4 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {isRTL ? 'ملاحظة: التكاليف تقديرية (COGS 30%، عمالة 28%، نفقات 15%)' : 'Note: Costs are estimates (COGS 30%, Labor 28%, Overhead 15%). Update after connecting actual COGS data.'}
        </p>
      )}
    </div>
  )
}
