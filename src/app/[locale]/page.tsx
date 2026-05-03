import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { getTranslations, getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import HeroWrapper from '@/components/home/HeroWrapper'
import CinematicButton from '@/components/ui/CinematicButton'
import {
  buildOrganizationSchema,
  buildFAQSchema,
  buildHomepageFAQ,
  buildWebSiteSchema,
  buildNavigationSchema,
} from '@/lib/seo/schemas'

// FeatureArtifacts is below-fold on mobile (hero is 100svh). Lazy-loading defers
// framer-motion's layout measurements out of the LCP window, reducing TBT and
// unblocking the hero image paint.
const FeatureArtifacts     = dynamic(() => import('@/components/home/FeatureArtifacts'))
const PhilosophyManifesto  = dynamic(() => import('@/components/home/PhilosophyManifesto'))
const ProtocolStack        = dynamic(() => import('@/components/home/ProtocolStack'))
const HomeFAQ              = dynamic(() => import('@/components/home/HomeFAQ'))

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t      = await getTranslations({ locale, namespace: 'seo' })

  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    alternates: {
      // Relative paths resolve against layout's metadataBase (NEXT_PUBLIC_SITE_URL or vercel.app).
      // Canonical always matches hreflang regardless of deployment domain — no more SEO conflict.
      canonical: locale === 'ar' ? '/' : '/en',
      languages: {
        'ar':        '/',
        'en':        '/en',
        'x-default': '/',
      },
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const locale = (await getLocale()) as 'ar' | 'en'
  const t      = await getTranslations()
  const isRTL  = locale === 'ar'
  const nonce  = (await headers()).get('x-nonce') ?? undefined

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
        {/* A. Cinematic Opening — never dynamic(), keeps SSR image out of Suspense boundary */}
        <HeroWrapper />

        {/* B. Feature Artifacts — first section below hero, keep in critical bundle */}
        <FeatureArtifacts />

        {/* C–E. Below-fold sections — lazy-loaded to reduce initial JS parse cost (TBT) */}
        <PhilosophyManifesto />
        <ProtocolStack />
        <HomeFAQ />

        {/* F. Bottom CTA */}
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
