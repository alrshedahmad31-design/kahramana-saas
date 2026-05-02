import { getTranslations, setRequestLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import CateringHero from '@/components/catering/catering-hero'
import EventTypes from '@/components/catering/event-types'
import CateringProtocol from '@/components/catering/catering-protocol'
import CateringPackages from '@/components/catering/catering-packages'
import InquiryForm from '@/components/catering/inquiry-form'
import CateringFaq from '@/components/catering/catering-faq'
import FinalCta from '@/components/catering/final-cta'
import { buildBreadcrumb } from '@/lib/seo/schemas'

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'catering.seo' })

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      images: ['/assets/catering/wedding.webp'],
    },
    alternates: {
      canonical: locale === 'en' ? '/en/catering' : '/catering',
      languages: { 'x-default': '/catering', ar: '/catering', en: '/en/catering' },
    },
  }
}

export default async function CateringPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const isAr = locale === 'ar'
  const localeKey = locale === 'ar' ? 'ar' : 'en'
  const nonce = (await headers()).get('x-nonce') ?? undefined

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: isAr ? 'تموين الفعاليات والمناسبات' : 'Event & Wedding Catering',
    provider: { '@id': 'https://kahramanat.com/#organization' },
    areaServed: { '@type': 'Country', name: 'Bahrain' },
    name: isAr ? 'خدمة تموين كهرمانة بغداد' : 'Kahramana Baghdad Catering',
    description: isAr
      ? 'خدمة تموين كاملة للأعراس والمناسبات في البحرين بمذاق المطبخ العراقي الأصيل من كهرمانة بغداد.'
      : 'Full event and wedding catering service in Bahrain delivering authentic Iraqi cuisine from Kahramana Baghdad.',
    url: `https://kahramanat.com/${localeKey === 'en' ? 'en/' : ''}catering`,
    inLanguage: localeKey === 'ar' ? 'ar-BH' : 'en-BH',
  }

  const breadcrumb = buildBreadcrumb([
    { name: isAr ? 'الرئيسية' : 'Home',     url: localeKey === 'en' ? '/en/'         : '/' },
    { name: isAr ? 'تموين'    : 'Catering', url: localeKey === 'en' ? '/en/catering' : '/catering' },
  ])

  return (
    <div className="min-h-screen bg-brand-black" dir={isAr ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <CateringHero />
      <EventTypes />
      <CateringProtocol />
      <CateringPackages />
      <InquiryForm />
      <CateringFaq />
      <FinalCta />
    </div>
  )
}
