import type { Metadata } from 'next'
import { preload } from 'react-dom'
import { getTranslations, getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import HeroWrapper from '@/components/home/HeroWrapper'
import FeatureArtifacts from '@/components/home/FeatureArtifacts'
import PhilosophyManifesto from '@/components/home/PhilosophyManifesto'
import ProtocolStack from '@/components/home/ProtocolStack'
import CinematicButton from '@/components/ui/CinematicButton'
import {
  buildOrganizationSchema,
  buildFAQSchema,
  buildHomepageFAQ,
  buildWebSiteSchema,
  buildNavigationSchema,
} from '@/lib/seo/schemas'

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t      = await getTranslations({ locale, namespace: 'seo' })
  return {
    title:       t('homeTitle'),
    description: t('homeDescription'),
    alternates: {
      canonical: locale === 'en' ? '/en' : '/',
      languages: { 'x-default': '/', ar: '/', en: '/en' },
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const locale = (await getLocale()) as 'ar' | 'en'
  const t      = await getTranslations()
  const isRTL  = locale === 'ar'
  const nonce  = (await headers()).get('x-nonce') ?? undefined

  // Preload hero poster via React 19 API → injected into <head> during SSR
  preload('/assets/hero/hero-poster.webp', { as: 'image', type: 'image/webp', fetchPriority: 'high' })

  const organizationSchema = buildOrganizationSchema(locale)
  const faqSchema          = buildFAQSchema(buildHomepageFAQ(locale))

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebSiteSchema(locale)) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildNavigationSchema(locale)) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="flex flex-col">
        {/* A. Cinematic Opening */}
        <HeroWrapper />

        {/* B. Feature Artifacts */}
        <FeatureArtifacts />

        {/* C. Philosophy Manifesto */}
        <PhilosophyManifesto />

        {/* D. Protocol Archive */}
        <ProtocolStack />

        {/* E. Bottom Transition / CTA */}
        <section className="py-40 px-6 sm:px-16 text-center bg-brand-black">
           <h2 className={`section-title mx-auto ${isRTL ? 'font-cairo' : 'font-editorial italic'}`}>
              {t('home.cta.title')}
           </h2>
           <CinematicButton
             href="/menu"
             isRTL={isRTL}
             className="px-12 py-5 text-xl font-bold rounded-2xl"
           >
              {t('home.cta.button')}
           </CinematicButton>
        </section>
      </div>
    </>
  )
}
