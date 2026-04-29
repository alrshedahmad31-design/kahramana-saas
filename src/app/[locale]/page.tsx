import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import CinematicHero from '@/components/home/CinematicHero'
import FeatureArtifacts from '@/components/home/FeatureArtifacts'
import PhilosophyManifesto from '@/components/home/PhilosophyManifesto'
import ProtocolStack from '@/components/home/ProtocolStack'
import CinematicButton from '@/components/ui/CinematicButton'

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
  const locale = await getLocale()
  const t      = await getTranslations()
  const isRTL  = locale === 'ar'

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Restaurant',
            name: 'كهرمانة بغداد',
            alternateName: 'Kahramana Baghdad',
            url: 'https://kahramanat.com',
            image: 'https://kahramanat.com/assets/hero/og-image.webp',
            servesCuisine: ['Iraqi', 'Middle Eastern'],
            priceRange: '$$',
            address: [
              {
                '@type': 'PostalAddress',
                addressLocality: 'Riffa',
                addressCountry: 'BH',
              },
              {
                '@type': 'PostalAddress',
                addressLocality: 'Muharraq',
                addressCountry: 'BH',
              },
            ],
          }),
        }}
      />

      <div className="flex flex-col">
        {/* A. Cinematic Opening */}
        <CinematicHero />

        {/* B. Feature Artifacts */}
        <FeatureArtifacts />

        {/* C. Philosophy Manifesto */}
        <PhilosophyManifesto />

        {/* D. Protocol Archive */}
        <ProtocolStack />

        {/* E. Bottom Transition / CTA */}
        <section className="py-40 px-6 sm:px-16 text-center bg-brand-black">
           <h2 className={`text-4xl sm:text-7xl font-bold mb-8 ${isRTL ? 'font-cairo' : 'font-editorial italic'}`}>
              {t('home.cta.title')}
           </h2>
           <CinematicButton
             href="/menu"
             isRTL={isRTL}
             className="px-12 py-5 text-xl font-bold rounded-full"
           >
              {t('home.cta.button')}
           </CinematicButton>
        </section>
      </div>
    </>
  )
}

