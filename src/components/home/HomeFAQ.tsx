import { getTranslations, getLocale } from 'next-intl/server'
import SectionHeader from '@/components/ui/SectionHeader'

const FAQ_KEYS = ['authentic', 'grills', 'masgouf', 'families', 'delivery', 'events', 'locations'] as const

export default async function HomeFAQ() {
  const t = await getTranslations('home.faq')
  const locale = await getLocale()
  const isRTL = locale === 'ar'

  return (
    <section className="py-32 px-6 sm:px-16 bg-brand-black relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand-gold/20 to-transparent" />

      <div className="max-w-4xl mx-auto relative z-10">
        <SectionHeader
          title={t('title')}
          subtitle={isRTL ? 'معلومات تهمك' : 'Key Information'}
          className="text-center flex flex-col items-center"
        />

        <div className="mt-16 space-y-4">
          {FAQ_KEYS.map((key) => (
            <details
              key={key}
              className="group border border-brand-border/30 rounded-2xl overflow-hidden bg-brand-surface/20 backdrop-blur-sm transition-all duration-300 hover:border-brand-gold/30"
            >
              <summary className={`w-full px-8 py-6 flex items-center justify-between gap-4 cursor-pointer list-none transition-colors hover:bg-brand-gold/5`}>
                <span className={`text-lg font-bold text-brand-text leading-tight ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                  {t(`items.${key}.q`)}
                </span>
                <svg
                  className="shrink-0 text-brand-gold opacity-60 transition-transform duration-300 group-open:rotate-180"
                  width="20" height="20" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </summary>
              <div className="px-8 pb-8">
                <div className="h-px w-12 bg-brand-gold/30 mb-6" />
                <p className={`text-brand-muted leading-relaxed ${isRTL ? 'font-cairo text-base' : 'font-satoshi text-sm opacity-80'}`}>
                  {t(`items.${key}.a`)}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
