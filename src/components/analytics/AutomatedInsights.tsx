import type { Insight } from '@/lib/analytics/insights'
import { colors } from '@/lib/design-tokens'

function AlertIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5m-9 4.5v-4.5m0 0a4.5 4.5 0 01-4.5-4.5V6h18v3.75a4.5 4.5 0 01-4.5 4.5m-9 0h9" />
    </svg>
  )
}

function BulbIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  )
}

function InsightIcon({ type }: { type: Insight['type'] }) {
  if (type === 'alert')       return <AlertIcon />
  if (type === 'achievement') return <TrophyIcon />
  if (type === 'opportunity') return <BulbIcon />
  return <InfoIcon />
}

function iconColor(type: Insight['type']): string {
  if (type === 'alert')       return colors.error
  if (type === 'achievement') return colors.success
  if (type === 'opportunity') return colors.gold
  return colors.muted
}

interface Props {
  insights: Insight[]
  isRTL:    boolean
}

export default function AutomatedInsights({ insights, isRTL }: Props) {
  if (!insights.length) {
    return (
      <div className="h-full flex items-center justify-center py-8">
        <p className={`text-sm text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {isRTL ? 'لا توجد رؤى متاحة لهذه الفترة' : 'No insights for this period yet'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-lg p-3 bg-brand-surface-2"
        >
          <span
            className="shrink-0 mt-0.5"
            style={{ color: iconColor(insight.type) }}
          >
            <InsightIcon type={insight.type} />
          </span>

          <div className="min-w-0">
            <p className={`text-sm font-semibold text-brand-text leading-snug
                          ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? insight.titleAr : insight.title}
            </p>
            <p className={`text-xs text-brand-muted mt-0.5 leading-relaxed
                          ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? insight.descAr : insight.description}
            </p>
            {insight.action && (
              <p className="text-xs font-medium mt-1 font-satoshi"
                 style={{ color: colors.gold }}>
                {isRTL ? insight.actionAr : insight.action} →
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
