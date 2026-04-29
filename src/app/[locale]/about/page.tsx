import type { Metadata } from 'next'
import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'

// ── Components ──────────────────────────────────────────────────────────────
import StoryHero from '@/components/story/StoryHero'
import FounderSection from '@/components/story/FounderSection'
import NarrativeSection from '@/components/story/NarrativeSection'
import PhilosophySection from '@/components/story/PhilosophySection'
import ProtocolSection from '@/components/story/ProtocolSection'
import ValuesSection from '@/components/story/ValuesSection'
import MilestonesSection from '@/components/story/MilestonesSection'
import BranchesSection from '@/components/story/BranchesSection'
import StoryCTA from '@/components/story/StoryCTA'

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title:       locale === 'ar' ? 'قصتنا | كهرمانة بغداد' : 'Our Story | Kahramana Baghdad',
    description: locale === 'ar'
      ? 'اكتشف حكاية نكهة لا تُقدَّم كوجبة بل كذاكرة. قصة كهرامة بغداد ورؤية المؤسس المهندس أسعد الجبوري.'
      : 'Discover a story of flavor served not as a meal but as a memory. The story of Kahramana Baghdad and the vision of founder Eng. Asaad Al-Jubouri.',
    openGraph: {
      images: [{ url: '/assets/founder/founder.webp' }],
    },
    alternates: {
      canonical: locale === 'en' ? '/en/about' : '/about',
      languages: { 'x-default': '/about', ar: '/about', en: '/en/about' },
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AboutPage() {
  const locale = await getLocale()
  const isAr   = locale === 'ar'
  const nonce  = (await headers()).get('x-nonce') ?? undefined

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: isAr ? 'قصتنا — كهرمانة بغداد' : 'Our Story — Kahramana Baghdad',
    url: `https://kahramanat.com/${locale}/about`,
    inLanguage: isAr ? 'ar-BH' : 'en-BH',
    mainEntity: { '@id': 'https://kahramanat.com/#organization' },
  }

  return (
    <div className="min-h-screen bg-brand-black overflow-x-hidden">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
      />

      {/* Cinematic Hero */}
      <StoryHero isRTL={isAr} />

      {/* Founder Section */}
      <FounderSection isRTL={isAr} />

      {/* Narrative Text */}
      <NarrativeSection isRTL={isAr} />

      {/* Taste Philosophy */}
      <PhilosophySection isRTL={isAr} />

      {/* Protocol Stack */}
      <ProtocolSection isRTL={isAr} />

      {/* Core Values */}
      <ValuesSection isRTL={isAr} />

      {/* Milestones Timeline */}
      <MilestonesSection isRTL={isAr} />

      {/* Branch Presence */}
      <BranchesSection isRTL={isAr} />

      {/* Final Emotional CTA */}
      <StoryCTA isRTL={isAr} />
    </div>
  )
}
