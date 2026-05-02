'use client'
import { useTranslations } from 'next-intl'

interface SectionDividerProps {
  title: string
  count: number
  locale: string
}

export function SectionDivider({ title, count, locale }: SectionDividerProps) {
  const isRTL = locale === 'ar'
  const t = useTranslations('menu')
  
  return (
    <div className="ps-4 pe-4 pt-10 pb-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-0.5 h-7 bg-brand-gold rounded-full" />
          <h2 className="font-cairo font-black text-brand-text text-2xl">
            {title}
          </h2>
        </div>
        <span className="font-satoshi text-brand-muted text-sm tabular-nums">
          {count} {t('sections.items')}
        </span>
      </div>
      <div className="border-b border-brand-surface-2" />
    </div>
  )
}
