import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { headers } from 'next/headers'
import HeroWrapper from '@/components/home/HeroWrapper'
import FeatureArtifacts from '@/components/home/FeatureArtifacts'
import PhilosophyManifesto from '@/components/home/PhilosophyManifesto'
import ProtocolStack from '@/components/home/ProtocolStack'
import HomeFAQ from '@/components/home/HomeFAQ'
import CinematicButton from '@/components/ui/CinematicButton'
import {
  buildOrganizationSchema,
  buildFAQSchema,
  buildHomepageFAQ,
  buildWebSiteSchema,
  buildNavigationSchema,
} from '@/lib/seo/schemas'

// ── Metadata ──────────────────────────────────────────────────────────────────

import { SITE_URL } from '@/constants/contact'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t      = await getTranslations({ locale, namespace: 'seo' })
  const BASE   = SITE_URL
  // Arabic is the default locale — no prefix in URL (localePrefix: 'as-needed')
  const url    = locale === 'ar' ? BASE : `${BASE}/en`

  return {
    title: t('homeTitle'),
    description: t('homeDescription'),
    alternates: {
      canonical: url,
      languages: {
        'ar': BASE,
        'en': `${BASE}/en`,
        'x-default': BASE,
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
        {/* A. Cinematic Opening */}
        <HeroWrapper />

        {/* B. Feature Artifacts */}
        <FeatureArtifacts />

        {/* C. Philosophy Manifesto */}
        <PhilosophyManifesto />

        {/* D. Protocol Archive */}
        <ProtocolStack />

        {/* E. FAQ Section */}
        <HomeFAQ />

        {/* F. Bottom Transition / CTA */}
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
