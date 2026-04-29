import { getTranslations, setRequestLocale } from 'next-intl/server'
import CateringHero from '@/components/catering/catering-hero'
import EventTypes from '@/components/catering/event-types'
import CateringProtocol from '@/components/catering/catering-protocol'
import CateringPackages from '@/components/catering/catering-packages'
import SignatureDishes from '@/components/catering/signature-dishes'
import InquiryForm from '@/components/catering/inquiry-form'
import CateringFaq from '@/components/catering/catering-faq'
import FinalCta from '@/components/catering/final-cta'

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

  return (
    <div className="min-h-screen bg-brand-black" dir={isAr ? 'rtl' : 'ltr'}>
      <CateringHero />
      <EventTypes />
      <CateringProtocol />
      <CateringPackages />
      <SignatureDishes />
      <InquiryForm />
      <CateringFaq />
      <FinalCta />
    </div>
  )
}
