import { setRequestLocale, getTranslations } from 'next-intl/server'
import { BRANCH_LIST } from '@/constants/contact'
import { getBranchMetadata } from '@/lib/branches'
import BranchesHero from '@/components/branches/branches-hero'
import BranchCard from '@/components/branches/branch-card'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'branches.seo' })

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      images: [{ url: '/assets/hero/hero-branches.webp', width: 1200, height: 630 }],
    },
    alternates: {
      canonical: locale === 'en' ? '/en/branches' : '/branches',
      languages: { 'x-default': '/branches', ar: '/branches', en: '/en/branches' },
    },
  }
}

export default async function BranchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const isAr = locale === 'ar'
  const t = await getTranslations('branches')

  // Sort branches: active first
  const sortedBranches = [...BRANCH_LIST].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (a.status !== 'active' && b.status === 'active') return 1
    return 0
  })

  // Local SEO Schema (JSON-LD)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    'name': 'Kahramana Baghdad',
    'image': 'https://kahramanat.com/assets/hero/hero-branches.webp',
    'url': 'https://kahramanat.com',
    'servesCuisine': 'Iraqi',
    'address': BRANCH_LIST.map(b => ({
      '@type': 'PostalAddress',
      'streetAddress': isAr ? b.addressAr : b.addressEn,
      'addressLocality': isAr ? b.cityAr : b.cityEn,
      'addressRegion': isAr ? b.cityAr : b.cityEn,
      'addressCountry': 'BH'
    }))
  }

  return (
    <main className="min-h-screen bg-brand-black pb-24" dir={isAr ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <BranchesHero 
        isAr={isAr} 
        badge={t('hero.badge')}
        title={t('hero.title')}
        description={t('hero.description')}
      />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sortedBranches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              metadata={getBranchMetadata(branch.id)}
              isAr={isAr}
              locale={locale}
              tViewOnMap={t('viewOnMap')}
              tComingSoon={t('comingSoon')}
              tOrderWhatsApp={t('orderWhatsApp')}
              tStatusActive={t('status.active')}
              tStatusPlanned={t('status.planned')}
            />
          ))}
        </div>
      </section>

      {/* Trust Section / Why Kahramana */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-32">
        <div className={`flex flex-col items-start text-start`}>
          <h2 className={`text-3xl md:text-5xl font-black text-brand-text mb-12 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {t('trust.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {['authentic', 'quality', 'speed', 'hospitality'].map((key) => (
              <div key={key} className="p-6 rounded-2xl bg-brand-surface-2 border border-brand-border">
                <div className={`text-brand-gold font-black text-xl mb-2 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                  {t(`trust.items.${key}.title`)}
                </div>
                <p className={`text-brand-muted text-sm leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t(`trust.items.${key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-32">
        <div className={`flex flex-col items-start text-start`}>
          <h2 className={`text-3xl md:text-4xl font-black text-brand-text mb-8 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {t('faq.title')}
          </h2>
          <div className="w-full flex flex-col gap-4">
            {['hours', 'delivery', 'party', 'quality'].map((key) => (
              <details key={key} className="group border-b border-brand-border py-4 cursor-pointer">
                <summary className={`list-none flex items-center justify-between gap-4 text-brand-text font-bold text-lg hover:text-brand-gold transition-colors ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                  <span>{t(`faq.items.${key}.q`)}</span>
                  <svg 
                    className={`w-5 h-5 transition-transform group-open:rotate-180 text-brand-gold`} 
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className={`mt-4 text-brand-muted leading-relaxed text-start ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t(`faq.items.${key}.a`)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
