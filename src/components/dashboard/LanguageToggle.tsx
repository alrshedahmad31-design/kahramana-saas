'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'

function GlobeIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  )
}

export default function LanguageToggle() {
  const locale   = useLocale()
  const isAr     = locale === 'ar'
  const router   = useRouter()
  const pathname = usePathname()
  const t        = useTranslations('nav')

  function toggle() {
    router.push(pathname, { locale: isAr ? 'en' : 'ar' })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={t('languageAlt')}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 w-full
                 font-satoshi text-sm font-medium text-brand-muted
                 hover:bg-brand-surface-2 hover:text-brand-text
                 transition-colors duration-150 min-h-[44px]"
    >
      <GlobeIcon />
      {t('language')}
    </button>
  )
}
