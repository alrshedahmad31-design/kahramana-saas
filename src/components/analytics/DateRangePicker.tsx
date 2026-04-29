'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import type { RangeLabel } from '@/lib/analytics/calculations'

interface Props {
  currentRange: RangeLabel
  locale:       string
}

const RANGES: { label: RangeLabel; labelAr: string; labelEn: string }[] = [
  { label: '7d',  labelAr: '٧ أيام',  labelEn: '7 Days'  },
  { label: '30d', labelAr: '٣٠ يوم',  labelEn: '30 Days' },
  { label: '90d', labelAr: '٩٠ يوم',  labelEn: '90 Days' },
  { label: 'all', labelAr: 'الكل',    labelEn: 'All Time' },
]

export default function DateRangePicker({ currentRange, locale }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()
  const isAr     = locale === 'ar'

  const setRange = useCallback((range: RangeLabel) => {
    const sp = new URLSearchParams(params.toString())
    sp.set('range', range)
    sp.delete('from')
    sp.delete('to')
    router.push(`${pathname}?${sp.toString()}`)
  }, [router, pathname, params])

  return (
    <div className="flex gap-1 p-1 bg-brand-surface-2 rounded-lg border border-brand-border">
      {RANGES.map((r) => {
        const active = currentRange === r.label
        return (
          <button
            key={r.label}
            type="button"
            onClick={() => setRange(r.label)}
            className={`px-3 py-1.5 rounded-md text-xs font-satoshi font-medium transition-colors duration-150 min-h-[32px]
              ${active
                ? 'bg-brand-gold text-brand-black'
                : 'text-brand-muted hover:text-brand-text hover:bg-brand-surface'
              }`}
          >
            {isAr ? r.labelAr : r.labelEn}
          </button>
        )
      })}
    </div>
  )
}
