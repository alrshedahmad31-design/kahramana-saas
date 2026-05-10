import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import { GENERAL_CONTACT, SITE_URL } from '@/constants/contact'
import { Link } from '@/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations('terms')
  return {
    title: `${t('title')} — Kahramana Baghdad`,
    robots: { index: false, follow: true },
    alternates: {
      canonical: locale === 'ar' ? `${SITE_URL}/terms` : `${SITE_URL}/en/terms`,
      languages: {
        'x-default': `${SITE_URL}/terms`,
        ar: `${SITE_URL}/terms`,
        en: `${SITE_URL}/en/terms`,
      },
    },
  }
}

export default function TermsPage() {
  const t = useTranslations('terms')
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
        <S title={t('acceptance.title')}>
          <p>{t('acceptance.content')}</p>
        </S>

        <S title={t('description.title')}>
          <p>{t('description.content')}</p>
        </S>

        <S title={t('orders.title')}>
          <ul>
            {(t.raw('orders.items') as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </S>

        <S title={t('cancellation.title')}>
          <p>
            {t.rich('cancellation.content', {
              strong: (chunks) => <strong>{chunks}</strong>,
              link: (chunks) => (
                <Link href="/refund-policy" className="text-brand-gold hover:text-brand-gold-light">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </S>

        <S title={t('acceptableUse.title')}>
          <p>{t('acceptableUse.content')}</p>
          <ul>
            {(t.raw('acceptableUse.items') as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </S>

        <S title={t('disclaimer.title')}>
          <p>{t('disclaimer.content')}</p>
        </S>

        <S title={t('governingLaw.title')}>
          <p>{t('governingLaw.content')}</p>
        </S>

        <S title={t('contact.title')}>
          <p>
            {t('contact.content')}{' '}
            <a href={`mailto:${GENERAL_CONTACT.email}`} className="text-brand-gold hover:text-brand-gold-light">
              {GENERAL_CONTACT.email}
            </a>
          </p>
        </S>
      </div>
    </div>
  )
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
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
                   [&_li]:leading-relaxed [&_strong]:text-brand-text [&_a]:underline-offset-2`}
      >
        {children}
      </div>
    </section>
  )
}

import { useLocale } from 'next-intl'
