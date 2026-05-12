import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import SectionHeader from '@/components/ui/SectionHeader'

// Server Component — uses the home namespace which is server-only per
// LocaleLayout's SERVER_ONLY_NS strip. Mirrors the structure of
// PhilosophyManifesto for stylistic consistency.

export default async function LoyaltySection() {
  const locale = await getLocale()
  const isRTL  = locale === 'ar'
  const t      = await getTranslations('home.loyalty')

  const steps = [
    { num: '1', title: t('step1Title'), desc: t('step1Desc') },
    { num: '2', title: t('step2Title'), desc: t('step2Desc') },
    { num: '3', title: t('step3Title'), desc: t('step3Desc') },
  ]

  return (
    <section className="py-32 px-6 sm:px-16 bg-brand-black relative overflow-hidden">
      <div className="relative z-10 max-w-6xl mx-auto">
        <SectionHeader title={t('title')} subtitle={t('eyebrow')} isRTL={isRTL} />

        <p className={`text-center text-base sm:text-lg text-brand-muted max-w-2xl mx-auto mb-14 leading-relaxed
          ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {t('subtitle')}
        </p>

        {/* 3 steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-14">
          {steps.map((step) => (
            <div
              key={step.num}
              className="rounded-2xl border border-brand-gold/20 bg-brand-surface/60 p-6 sm:p-8
                         text-start transition-colors duration-300 hover:border-brand-gold/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full
                              border border-brand-gold/40 bg-brand-gold/5 mb-5">
                <span className="font-satoshi text-lg font-bold text-brand-gold tabular-nums">
                  {step.num}
                </span>
              </div>
              <h3 className={`text-xl font-bold text-brand-text mb-3 leading-snug
                ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                {step.title}
              </h3>
              <p className={`text-sm text-brand-muted leading-relaxed
                ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/account/register"
            className={`inline-flex items-center gap-2 px-8 sm:px-10 py-4 rounded-full
                        bg-brand-gold text-brand-black text-base sm:text-lg font-bold
                        hover:bg-brand-gold-light transition-colors duration-300
                        ${isRTL ? 'font-cairo' : 'font-satoshi'}`}
          >
            {t('cta')}
            <span aria-hidden className="text-xl leading-none">{isRTL ? '←' : '→'}</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
