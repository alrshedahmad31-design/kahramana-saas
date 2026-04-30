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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, branchId } = await params
  const branch = BRANCHES[branchId as BranchId]
  if (!branch || branch.status !== 'active') return {}

  const isAr  = locale === 'ar'
  const name  = isAr ? branch.nameAr  : branch.nameEn
  const title = isAr
    ? `${name} — كهرمانة بغداد | ساعات العمل، الموقع، الطلب`
    : `${name} — Kahramana Baghdad | Hours, Location & Order`
  const description = isAr
    ? `${name}: ${branch.addressAr}. أوقات العمل: ${branch.hours.ar}. اطلب عبر واتساب أو تصفح المنيو.`
    : `${name}: ${branch.addressEn}. Hours: ${branch.hours.en}. Order via WhatsApp or browse the menu.`

  return {
    title,
    description,
    alternates: {
      canonical: isAr ? `/branches/${branchId}` : `/en/branches/${branchId}`,
      languages: {
        'x-default': `/branches/${branchId}`,
        ar:          `/branches/${branchId}`,
        en:          `/en/branches/${branchId}`,
      },
    },
    openGraph: {
      title,
      description,
      images: [{ url: `/images/branches/${branchId}.jpg`, width: 1200, height: 630 }],
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
      {branch.latitude && branch.longitude && (
        <BranchMap 
          latitude={branch.latitude}
          longitude={branch.longitude}
          isAr={isAr}
        />
      )}

      {/* Footer luxury spacing */}
      <div className="h-24 bg-brand-black" />
    </main>
  )
}
