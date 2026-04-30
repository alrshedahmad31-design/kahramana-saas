import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { Link } from '@/i18n/navigation'
import { BRANCHES, BRANCH_LIST, buildWaOrderLink } from '@/constants/contact'
import { getBranchMetadata } from '@/lib/branches'
import { buildBranchLocalBusiness, buildBreadcrumb } from '@/lib/seo/schemas'
import type { BranchId } from '@/constants/contact'

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

  const t     = await getTranslations('branches')
  const nonce = (await headers()).get('x-nonce') ?? undefined

  const localeKey  = locale as 'ar' | 'en'
  const branchName = isAr ? branch.nameAr : branch.nameEn
  const address    = isAr ? branch.addressAr : branch.addressEn
  const waLink     = buildWaOrderLink(branch.id, localeKey)

  const schema = buildBranchLocalBusiness(branch, localeKey)

  const breadcrumb = buildBreadcrumb([
    { name: isAr ? 'الرئيسية' : 'Home',     url: localeKey === 'en' ? '/en/'         : '/' },
    { name: isAr ? 'الفروع'   : 'Branches', url: localeKey === 'en' ? '/en/branches' : '/branches' },
    { name: branchName,                       url: localeKey === 'en' ? `/en/branches/${branch.id}` : `/branches/${branch.id}` },
  ])

  return (
    <main className="min-h-screen bg-brand-black pb-24" dir={isAr ? 'rtl' : 'ltr'}>
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

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative pt-16 pb-12 px-4 sm:px-6 max-w-4xl mx-auto text-start">

        {/* Back link */}
        <Link
          href="/branches"
          className={`inline-flex items-center gap-1.5 text-brand-muted hover:text-brand-gold text-sm font-bold mb-8 transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={isAr ? 'rotate-180' : ''} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {isAr ? 'جميع الفروع' : 'All Branches'}
        </Link>

        <span className={`text-xs font-bold text-brand-gold uppercase tracking-widest mb-4 block ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'فرع' : 'Branch'}
        </span>
        <h1 className={`text-3xl sm:text-5xl font-black text-brand-text mb-4 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {branchName}
        </h1>
        <p className={`text-brand-muted text-base leading-relaxed max-w-xl ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? metadata.descriptionAr : metadata.descriptionEn}
        </p>
      </div>

      {/* ── Info + CTA ────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Address */}
          <div className="flex items-start gap-4 bg-brand-surface border border-brand-border rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="text-brand-gold" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? 'العنوان' : 'Address'}
              </p>
              <p className={`text-sm text-brand-text font-bold mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {address}
              </p>
              {branch.mapsUrl && (
                <a
                  href={branch.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs font-bold text-brand-gold hover:underline ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                >
                  {t('viewOnMap')}
                </a>
              )}
            </div>
          </div>

          {/* Hours */}
          <div className="flex items-start gap-4 bg-brand-surface border border-brand-border rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="text-brand-gold" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? 'ساعات العمل' : 'Opening Hours'}
              </p>
              <p className={`text-sm text-brand-text font-bold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? branch.hours.ar : branch.hours.en}
              </p>
            </div>
          </div>

          {/* Phone */}
          {branch.phone && (
            <div className="flex items-start gap-4 bg-brand-surface border border-brand-border rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="text-brand-gold" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'الهاتف' : 'Phone'}
                </p>
                <a
                  href={`tel:${branch.phone}`}
                  dir="ltr"
                  className="font-satoshi text-sm font-bold text-brand-text hover:text-brand-gold transition-colors"
                >
                  {branch.phone}
                </a>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="flex items-start gap-4 bg-brand-surface border border-brand-border rounded-2xl p-5">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0">
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="text-brand-gold" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? 'الخدمات' : 'Services'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metadata.features.map((f, i) => (
                  <span
                    key={i}
                    className={`px-2.5 py-1 rounded-full bg-brand-surface-2 border border-brand-border text-xs font-bold text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                  >
                    {isAr ? f.ar : f.en}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-brand-gold text-brand-black font-black text-base hover:brightness-110 active:brightness-90 transition-all ${isAr ? 'font-cairo' : 'font-satoshi'}`}
          >
            {isAr ? 'اطلب عبر واتساب' : 'Order via WhatsApp'}
          </a>
          <Link
            href="/menu"
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-brand-border text-brand-muted hover:text-brand-gold hover:border-brand-gold font-bold text-base transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {isAr ? 'تصفح المنيو' : 'Browse Menu'}
          </Link>
        </div>
      </section>
    </main>
  )
}
