import { colors } from '@/lib/design-tokens'

interface Ratio {
  label:     string
  labelAr:   string
  value:     string
  status:    'good' | 'warn' | 'bad'
  benchmark: string
  benchAr:   string
}

interface Props {
  revenue:     number
  cogsPct:     number
  laborPct:    number
  overheadPct: number
  isRTL:       boolean
}

function statusColor(s: Ratio['status']) {
  if (s === 'good') return colors.success
  if (s === 'warn') return colors.gold
  return colors.error
}

function statusLabel(s: Ratio['status'], isRTL: boolean) {
  if (s === 'good') return isRTL ? 'جيد'   : 'Good'
  if (s === 'warn') return isRTL ? 'مراقبة' : 'Watch'
  return isRTL ? 'بحاجة إلى مراجعة' : 'Review'
}

export default function FinancialRatios({ cogsPct, laborPct, overheadPct, isRTL }: Props) {
  const primeCost   = cogsPct + laborPct
  const netProfitPct = 1 - cogsPct - laborPct - overheadPct

  const ratios: Ratio[] = [
    {
      label:     'Prime Cost (COGS + Labor)',
      labelAr:   'التكلفة الأساسية (بضائع + عمالة)',
      value:     `${(primeCost * 100).toFixed(0)}%`,
      status:    primeCost <= 0.60 ? 'good' : primeCost <= 0.65 ? 'warn' : 'bad',
      benchmark: 'Target: <60%',
      benchAr:   'الهدف: أقل من 60%',
    },
    {
      label:     'Food Cost %',
      labelAr:   'نسبة تكلفة الطعام',
      value:     `${(cogsPct * 100).toFixed(0)}%`,
      status:    cogsPct <= 0.32 ? 'good' : cogsPct <= 0.35 ? 'warn' : 'bad',
      benchmark: 'Target: 28–32%',
      benchAr:   'الهدف: 28–32%',
    },
    {
      label:     'Labor Cost %',
      labelAr:   'نسبة تكاليف العمالة',
      value:     `${(laborPct * 100).toFixed(0)}%`,
      status:    laborPct <= 0.35 ? 'good' : laborPct <= 0.40 ? 'warn' : 'bad',
      benchmark: 'Target: 25–35%',
      benchAr:   'الهدف: 25–35%',
    },
    {
      label:     'Overhead %',
      labelAr:   'نسبة النفقات العامة',
      value:     `${(overheadPct * 100).toFixed(0)}%`,
      status:    overheadPct <= 0.15 ? 'good' : overheadPct <= 0.20 ? 'warn' : 'bad',
      benchmark: 'Target: <15%',
      benchAr:   'الهدف: أقل من 15%',
    },
    {
      label:     'Net Profit Margin',
      labelAr:   'هامش الربح الصافي',
      value:     `${(netProfitPct * 100).toFixed(0)}%`,
      status:    netProfitPct >= 0.20 ? 'good' : netProfitPct >= 0.10 ? 'warn' : 'bad',
      benchmark: 'Target: >20%',
      benchAr:   'الهدف: أكثر من 20%',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ratios.map((r) => (
        <div key={r.label} className="bg-brand-surface-2 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? r.labelAr : r.label}
            </p>
            <span
              className="text-xs font-satoshi font-medium px-2 py-0.5 rounded-md shrink-0"
              style={{
                color:      statusColor(r.status),
                background: `${statusColor(r.status)}15`,
                border:     `1px solid ${statusColor(r.status)}40`,
              }}
            >
              {statusLabel(r.status, isRTL)}
            </span>
          </div>
          <p className="text-2xl font-bold font-satoshi tabular-nums text-brand-text mt-2">
            {r.value}
          </p>
          <p className={`text-xs text-brand-muted mt-1 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
            {isRTL ? r.benchAr : r.benchmark}
          </p>
        </div>
      ))}
    </div>
  )
}
