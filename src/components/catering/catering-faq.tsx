import { useLocale, useTranslations } from 'next-intl'

const faqItems = ['pricing', 'notice', 'delivery', 'customization'] as const

export default function CateringFaq() {
  const t = useTranslations('catering.faq')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
      <div className="text-start">
        <p className="text-xs font-satoshi font-bold tracking-[0.3em] uppercase text-brand-gold">
          {t('eyebrow')}
        </p>
        <h2 className={`mt-3 text-3xl sm:text-5xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {t('title')}
        </h2>
      </div>

      <div className="mt-8 divide-y divide-brand-border rounded-2xl border border-brand-border bg-brand-surface">
        {faqItems.map((item) => (
          <details key={item} className="group p-5">
            <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 text-start text-lg font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
              <span>{t(`items.${item}.question`)}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-gold/30 text-brand-gold transition-transform duration-200 group-open:rotate-180">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </summary>
            <p className={`mt-4 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t(`items.${item}.answer`)}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
