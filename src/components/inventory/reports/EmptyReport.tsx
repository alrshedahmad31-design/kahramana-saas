'use client'

import { useLocale } from 'next-intl'

interface Props {
  title: string
  description: string
  cta?: { label: string; href: string }
}

export default function EmptyReport({ title, description, cta }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center bg-brand-surface/50 rounded-2xl border border-dashed border-brand-border/60">
      <div className="w-20 h-20 rounded-full bg-brand-surface-2 flex items-center justify-center text-3xl shadow-inner">
        📊
      </div>
      <div className="space-y-1">
        <p className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-lg font-black text-brand-text`}>{title}</p>
        <p className={`${font} text-sm text-brand-muted mt-1 max-w-sm`}>{description}</p>
      </div>
      {cta && (
        <a
          href={cta.href}
          className={`inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 ${font} text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-all shadow-sm hover:shadow`}
        >
          {cta.label}
        </a>
      )}
    </div>
  )
}

