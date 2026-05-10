import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { useTranslations, useLocale } from 'next-intl'
import { BRANCH_LIST, GENERAL_CONTACT, SITE_URL } from '@/constants/contact'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations('refund')
  return {
    title: `${t('title')} — Kahramana Baghdad`,
    robots: { index: true, follow: true },
    alternates: {
      canonical: locale === 'ar' ? `${SITE_URL}/refund-policy` : `${SITE_URL}/en/refund-policy`,
      languages: {
        'x-default': `${SITE_URL}/refund-policy`,
        ar: `${SITE_URL}/refund-policy`,
        en: `${SITE_URL}/en/refund-policy`,
      },
    },
  }
}

export default function RefundPolicyPage() {
  const t = useTranslations('refund')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-brand-black px-4 sm:px-6 pt-10 pb-20 max-w-3xl mx-auto"
    >
      <div className="mb-10 pb-8 border-b border-brand-border">
        <h1
          className={`text-4xl font-black text-brand-text mb-3
            ${isAr ? 'font-cairo' : 'font-editorial'}`}
        >
          {t('title')}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted">
          {t('lastUpdated')}
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <R title={t('freeCancellation.title')}>
          <p>{t.rich('freeCancellation.content', { strong: (c) => <strong>{c}</strong> })}</p>
          <p>{t('freeCancellation.howTo')}</p>
        </R>

        <R title={t('accepted.title')}>
          <p>{t('accepted.subtitle')}</p>
          <ul>
            {(t.raw('accepted.items') as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </R>

        <R title={t('nonRefundable.title')}>
          <p>{t('nonRefundable.subtitle')}</p>
          <ul>
            {(t.raw('nonRefundable.items') as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </R>

        <R title={t('process.title')}>
          <p>{t('process.content')}</p>
          <ul>
            {(t.raw('process.items') as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <p>{t.rich('process.timeline', { strong: (c) => <strong>{c}</strong> })}</p>
        </R>

        <R title={t('exceptions.title')}>
          <p>{t('exceptions.content')}</p>
        </R>
      </div>

      {/* Contact for disputes */}
      <div className="mt-12 rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-6">
        <h2
          className={`font-semibold text-brand-text mb-3
            ${isAr ? 'font-cairo' : 'font-satoshi'}`}
        >
          {t('contactTitle')}
        </h2>
        <p className={`text-sm text-brand-muted mb-4 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('contactSubtitle')}
        </p>
        <div className="flex flex-col gap-3">
          {BRANCH_LIST.map((branch) => (
            <div key={branch.id} className="flex items-center gap-4 flex-wrap">
              <span
                className={`font-semibold text-sm text-brand-text
                  ${isAr ? 'font-cairo' : 'font-satoshi'}`}
              >
                {isAr ? branch.nameAr : branch.nameEn}
              </span>
              <a
                href={branch.waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-satoshi text-sm text-green-400 hover:text-green-300 transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={`tel:${branch.phone}`}
                className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light transition-colors tabular-nums"
                dir="ltr"
              >
                {branch.phone}
              </a>
            </div>
          ))}
          <a
            href={`mailto:${GENERAL_CONTACT.email}`}
            className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light transition-colors"
          >
            {GENERAL_CONTACT.email}
          </a>
        </div>
      </div>
    </div>
  )
}

function R({ title, children }: { title: string; children: React.ReactNode }) {
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="flex flex-col gap-3">
      <h2 className={`font-semibold text-lg text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
        {title}
      </h2>
      <div
        className={`${isAr ? 'font-almarai' : 'font-satoshi'} text-sm text-brand-muted leading-relaxed
                   [&_p]:mb-3 [&_ul]:list-disc [&_ul]:ps-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5
                   [&_li]:leading-relaxed [&_strong]:text-brand-text`}
      >
        {children}
      </div>
    </section>
  )
}
