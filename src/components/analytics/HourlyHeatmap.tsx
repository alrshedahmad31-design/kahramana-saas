'use client'

import type { HourlyRow } from '@/lib/analytics/queries'
import { colors } from '@/lib/design-tokens'

interface Props {
  data:   HourlyRow[]
  locale: string
}

const HOUR_LABELS_EN = [
  '12a','1a','2a','3a','4a','5a','6a','7a','8a','9a','10a','11a',
  '12p','1p','2p','3p','4p','5p','6p','7p','8p','9p','10p','11p',
]

const HOUR_LABELS_AR = [
  '١٢ص','١ص','٢ص','٣ص','٤ص','٥ص','٦ص','٧ص','٨ص','٩ص','١٠ص','١١ص',
  '١٢م','١م','٢م','٣م','٤م','٥م','٦م','٧م','٨م','٩م','١٠م','١١م',
]

export default function HourlyHeatmap({ data, locale }: Props) {
  const maxOrders = Math.max(...data.map((r) => r.order_count), 1)
  const isAr = locale === 'ar'
  const labels = isAr ? HOUR_LABELS_AR : HOUR_LABELS_EN

  // Build a lookup: hour → count
  const byHour = new Map(data.map((r) => [r.hour_of_day, r.order_count]))

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-12 gap-1 min-w-[600px]" dir="ltr">
        {Array.from({ length: 24 }, (_, h) => {
          const count    = byHour.get(h) ?? 0
          const intensity = count / maxOrders
          const bg =
            intensity === 0
              ? colors.surface2
              : intensity < 0.25
              ? `${colors.gold}33`   // 20% opacity
              : intensity < 0.5
              ? `${colors.gold}66`   // 40% opacity
              : intensity < 0.75
              ? `${colors.gold}99`   // 60% opacity
              : colors.gold

          return (
            <div
              key={h}
              title={`${labels[h]}: ${count} orders`}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-full rounded-md flex items-center justify-center"
                style={{ height: 36, background: bg }}
              >
                <span
                  className="font-satoshi text-xs font-bold tabular-nums"
                  style={{ color: intensity >= 0.5 ? colors.black : colors.text }}
                >
                  {count > 0 ? count : ''}
                </span>
              </div>
              <span className="font-satoshi text-[10px] text-brand-muted">
                {labels[h]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
