import type { Metadata } from 'next'
import { SITE_URL } from '@/constants/contact'
import { buildFounderSchema } from '@/lib/seo/schemas'

// ── Components ──────────────────────────────────────────────────────────────
import StoryHero from '@/components/story/StoryHero'
import FounderSection from '@/components/story/FounderSection'
import NarrativeSection from '@/components/story/NarrativeSection'
import PhilosophySection from '@/components/story/PhilosophySection'
import { EngineeringOfHeritageSection } from '@/components/about/EngineeringOfHeritageSection'
import ProtocolSection from '@/components/story/ProtocolSection'
import ValuesSection from '@/components/story/ValuesSection'
import MilestonesSection from '@/components/story/MilestonesSection'
import BranchesSection from '@/components/story/BranchesSection'
import StoryCTA from '@/components/story/StoryCTA'

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params
  const isAr = locale === 'ar'
  return {
    title:       isAr ? 'قصة كهرمانة بغداد | مطعم عراقي أصيل تأسس 2018' : 'Kahramana Baghdad Story | Authentic Iraqi Restaurant Since 2018',
    description: isAr
      ? 'منذ 2018 يحمل كهرمانة بغداد رسالة واحدة: تقديم المطبخ البغدادي الأصيل دون تنازل. اكتشف قصة المؤسس وفلسفة الضيافة العراقية في البحرين.'
      : 'Kahramana Baghdad — authentic Iraqi restaurant in Bahrain since 2018. Founded by Eng. Asaad Al-Jubouri, serving 168+ traditional Baghdadi dishes across two branches in Riffa and Qallali.',
    openGraph: {
      images: [{ url: '/assets/founder/founder.webp' }],
    },
    alternates: {
      canonical: isAr ? `${SITE_URL}/about` : `${SITE_URL}/en/about`,
      languages: {
        'x-default': `${SITE_URL}/about`,
        'ar-BH':     `${SITE_URL}/about`,
        'en-BH':     `${SITE_URL}/en/about`,
      },
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AboutPage(
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  const isAr = locale === 'ar'

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: isAr ? 'قصتنا — كهرمانة بغداد' : 'Our Story — Kahramana Baghdad',
    url: isAr ? `${SITE_URL}/about` : `${SITE_URL}/en/about`,
    inLanguage: isAr ? 'ar-BH' : 'en-BH',
    mainEntity: { '@id': `${SITE_URL}/#organization` },
  }

  const founderSchemaLd = {
    '@context': 'https://schema.org',
    ...buildFounderSchema(),
  }

  return (
    <div className="min-h-screen bg-brand-black overflow-x-hidden">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(founderSchemaLd) }}
      />

      {/* Cinematic Hero */}
      <StoryHero isRTL={isAr} />

      {/* Founder Section */}
      <FounderSection isRTL={isAr} />

      {/* Narrative Text */}
      <NarrativeSection isRTL={isAr} />

      {/* Taste Philosophy */}
      <PhilosophySection isRTL={isAr} />

      {/* Engineering of Heritage */}
      <EngineeringOfHeritageSection isRTL={isAr} />

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
