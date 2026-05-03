import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { BRANCHES, BRANCH_LIST, buildWaOrderLink } from '@/constants/contact'
import { getBranchMetadata } from '@/lib/branches'
import { buildBranchLocalBusiness, buildBreadcrumb } from '@/lib/seo/schemas'
import type { BranchId } from '@/constants/contact'

import BranchHero from '@/components/branches/BranchHero'
import BranchDetailsContent from '@/components/branches/BranchDetailsContent'
import BranchMap from '@/components/branches/BranchMap'

// ── Static params — only active branches get individual pages ─────────────────

export function generateStaticParams() {
  return BRANCH_LIST
    .filter((b) => b.status === 'active')
    .flatMap((b) => [
      { locale: 'ar', branchId: b.id },
      { locale: 'en', branchId: b.id },
    ])
}

// ── Metadata ──────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ locale: string; branchId: string }> }

import { SITE_URL } from '@/constants/contact'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, branchId } = await params
  const branch = BRANCHES[branchId as BranchId]
  if (!branch || branch.status !== 'active') return {}

  const isAr  = locale === 'ar'
  const name  = isAr ? branch.nameAr  : branch.nameEn
  const BASE  = SITE_URL
  const url   = `${BASE}/${locale}/branches/${branchId}`

  const title = isAr
    ? `مطعم كهرمانة بغداد — ${name} | أكل عراقي ومسكوف في البحرين`
    : `Kahramana Baghdad — ${name} | Iraqi Restaurant & Masgouf in Bahrain`
  const description = isAr
    ? `${name} مطعم كهرمانة بغداد في ${branch.cityAr}: ${branch.addressAr}. أوقات العمل: ${branch.hours.ar}. تواصل معنا واطلب الآن.`
    : `${name} Kahramana Baghdad Restaurant in ${branch.cityEn}: ${branch.addressEn}. Hours: ${branch.hours.en}. Contact us and order now.`

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        'ar': `${BASE}/ar/branches/${branchId}`,
        'en': `${BASE}/en/branches/${branchId}`,
        'x-default': `${BASE}/ar/branches/${branchId}`,
      },
    },
    openGraph: {
      title,
      description,
      url,
      images: [{ url: `${BASE}/assets/hero/hero-branches.webp`, width: 1200, height: 630 }],
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BranchDetailPage({ params }: Props) {
  const { locale, branchId } = await params
  const isAr = locale === 'ar'

  const branch   = BRANCHES[branchId as BranchId]
  const metadata = getBranchMetadata(branchId as BranchId)

  if (!branch || branch.status !== 'active') notFound()

  const nonce = (await headers()).get('x-nonce') ?? undefined
  const localeKey  = locale as 'ar' | 'en'
  const branchName = isAr ? branch.nameAr : branch.nameEn
  const waLink     = buildWaOrderLink(branch.id, localeKey)

  const schema = buildBranchLocalBusiness(branch, localeKey)

  const breadcrumb = buildBreadcrumb([
    { name: isAr ? 'الرئيسية' : 'Home',     url: localeKey === 'en' ? '/en/'         : '/' },
    { name: isAr ? 'الفروع'   : 'Branches', url: localeKey === 'en' ? '/en/branches' : '/branches' },
    { name: branchName,                       url: localeKey === 'en' ? `/en/branches/${branch.id}` : `/branches/${branch.id}` },
  ])

  return (
    <main className="min-h-screen bg-brand-black" dir={isAr ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      {/* 1. Cinematic Hero */}
      <BranchHero 
        branchName={branchName}
        description={isAr ? metadata.descriptionAr : metadata.descriptionEn}
        branchId={branch.id}
        isAr={isAr}
      />

      {/* 2. Info Cards & Main CTA */}
      <BranchDetailsContent 
        branch={branch}
        metadata={metadata}
        isAr={isAr}
        waLink={waLink}
      />

      {/* 3. Interactive Map Section */}
      {(branch.embedSrc || (branch.latitude && branch.longitude)) && (
        <BranchMap
          embedSrc={branch.embedSrc}
          latitude={branch.latitude}
          longitude={branch.longitude}
          isAr={isAr}
          mapTitle={isAr
            ? `خريطة فرع كهرمانة بغداد — ${branch.nameAr.replace('فرع ', '')}`
            : `Kahramana Baghdad — ${branch.nameEn} Map`}
        />
      )}

      {/* Footer luxury spacing */}
      <div className="h-24 bg-brand-black" />
    </main>
  )
}
