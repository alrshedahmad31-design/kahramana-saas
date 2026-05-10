'use client'

import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'

interface Props {
  title: string
  description?: string
  lastUpdated?: string
  actions?: ReactNode
}

export default function ReportHeader({ title, description, lastUpdated, actions }: Props) {
  const locale = useLocale()
  const t = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-2xl font-black text-brand-text tracking-tight`}>{title}</h1>
        {description && (
          <p className={`${font} text-sm text-brand-muted leading-relaxed`}>{description}</p>
        )}
        {lastUpdated && (
          <p className={`${font} text-xs text-brand-muted/70 flex items-center gap-1.5`}>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold/40 animate-pulse" />
            {t('lastUpdated')}: {new Date(lastUpdated).toLocaleString(isAr ? 'ar-IQ' : 'en-GB')}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

