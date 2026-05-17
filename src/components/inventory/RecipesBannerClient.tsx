'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/ui/Icon'

interface Props {
  mapped: number
  total: number
  locale: string
  importHref: string
}

const STORAGE_KEY = 'kahramana.inventory.recipesBanner.dismissed'

export default function RecipesBannerClient({ mapped, total, locale, importHref }: Props) {
  const t = useTranslations('inventory.recipesBanner')
  const isAr = locale === 'ar'
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') {
        setDismissed(true)
      }
    } catch {
      // sessionStorage unavailable (private mode, etc.) — leave banner visible
    }
  }, [])

  if (!mounted || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
  }

  return (
    <section
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex items-start gap-3 rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-4"
      aria-label={t('title', { mapped, total })}
    >
      <div className="shrink-0 text-brand-gold pt-0.5">
        <Icon name="warning" size={20} />
      </div>
      <p
        className={`flex-1 text-sm text-brand-text ${
          isAr ? 'font-almarai text-end' : 'font-satoshi text-start'
        }`}
      >
        {t('title', { mapped, total })}
      </p>
      <Link
        href={importHref}
        className="shrink-0 inline-flex items-center rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-bold text-brand-black hover:brightness-110 transition-all"
      >
        {t('cta')}
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-bold text-brand-text hover:bg-brand-border/40 transition-colors"
        aria-label={t('dismiss')}
      >
        <Icon name="x" size={12} />
        {t('dismiss')}
      </button>
    </section>
  )
}
