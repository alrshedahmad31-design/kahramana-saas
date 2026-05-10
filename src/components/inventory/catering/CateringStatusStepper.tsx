'use client'

import { useTranslations } from 'next-intl'
import type { CateringOrderStatus } from '@/lib/supabase/custom-types'

const STEPS: CateringOrderStatus[] = [
  'draft', 'quoted', 'confirmed', 'prep_started', 'delivered', 'invoiced'
]

interface Props {
  currentStatus: CateringOrderStatus
  locale:        string
}

export default function CateringStatusStepper({ currentStatus, locale }: Props) {
  const t = useTranslations('inventory.reports.catering')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  if (currentStatus === 'cancelled') {
    return (
      <div className="flex items-center justify-center rounded-lg bg-brand-error/10 border border-brand-error/20 py-2">
        <span className={`${font} text-xs font-bold text-brand-error uppercase tracking-wider`}>
          {t('status.cancelled')}
        </span>
      </div>
    )
  }

  const currentIndex = STEPS.indexOf(currentStatus)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STEPS.map((s, idx) => {
        const isDone   = idx < currentIndex
        const isActive = idx === currentIndex
        const isFuture = idx > currentIndex

        return (
          <div key={s} className="flex items-center gap-1.5">
            <span className={`
              rounded-lg px-2.5 py-1 text-[10px] ${font} font-bold border transition-all duration-300 shadow-sm
              ${isActive ? 'bg-brand-gold text-brand-black border-brand-gold scale-105 z-10' : ''}
              ${isDone   ? 'bg-brand-surface-2 border-transparent text-brand-muted line-through opacity-60' : ''}
              ${isFuture ? 'bg-brand-surface border-brand-border text-brand-muted/40' : ''}
            `}>
              {t(`status.${s}`)}
            </span>
            {idx < STEPS.length - 1 && (
              <span className="text-brand-muted/30 text-[10px] select-none">
                {isAr ? '←' : '→'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

