'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface EmptyStateProps {
  query?: string
  locale?: string
}

export function EmptyState({ query, locale = 'ar' }: EmptyStateProps) {
  const isRTL = locale === 'ar'
  const t = useTranslations('menu')
  
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-16 h-16 rounded-full bg-brand-surface flex items-center justify-center mb-4 border border-brand-border">
        <Search size={24} className="text-brand-muted" />
      </div>
      <p className="font-cairo font-black text-brand-text text-lg mb-2">
        {t('empty')}
      </p>
      <p className="font-almarai text-brand-muted text-sm">
        {query
          ? t('noMatches', { query })
          : t('tryAnother')
        }
      </p>
    </div>
  )
}
