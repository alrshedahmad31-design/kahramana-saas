import { setRequestLocale, getTranslations } from 'next-intl/server'
import { BRANCH_LIST, SITE_URL } from '@/constants/contact'
import { BRANCHES as SEO_BRANCHES } from '@/lib/constants/branches'
import { getBranchMetadata } from '@/lib/branches'
import BranchesHero from '@/components/branches/branches-hero'
import BranchCard from '@/components/branches/branch-card'
import {
  buildBranchesPageGraph,
  buildBreadcrumb,
  buildFAQSchema,
} from '@/lib/seo/schemas'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isAr = locale === 'ar'
  const BASE = SITE_URL
  const canonicalUrl = isAr ? `${BASE}/branches` : `${BASE}/en/branches`

  return {
    title: isAr
      ? { absolute: 'فروع كهرمانة بغداد — الرفاع وقلالي | كهرمانة بغداد' }
      : { absolute: 'Kahramana Baghdad Branches — Riffa & Qallali | Kahramana Baghdad' },
    description: isAr
      ? 'مواقع مطعم كهرمانة بغداد في البحرين: فرع الرفاع وفرع قلالي. أرقام الواتساب وساعات العمل ومواقعنا على خرائط جوجل.'
      : 'Kahramana Baghdad locations in Bahrain: Riffa and Qallali branches. WhatsApp numbers, opening hours, and Google Maps locations.',
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'ar-BH': `${BASE}/branches`,
        'en-BH': `${BASE}/en/branches`,
        'x-default': `${BASE}/branches`,
      },
    },
    openGraph: {
      title: isAr
        ? 'فروع مطعم كهرمانة بغداد — الرفاع وقلالي'
        : 'Kahramana Baghdad Restaurant Branches — Riffa and Qallali',
      description: isAr
        ? 'اكتشف مواقعنا في البحرين واطلب الآن من فرع الرفاع أو فرع قلالي عبر الواتساب.'
        : 'Discover our locations in Bahrain and order now from Riffa or Qallali branch via WhatsApp.',
      url: canonicalUrl,
      images: [{ url: `${BASE}/assets/hero/hero-branches.webp`, width: 1200, height: 630 }],
    },
  }
}

const BRANCH_FAQS_AR = [
  {
    question: 'ما هي أوقات عمل مطعم كهرمانة الرفاع؟',
    answer: `يعمل فرع الرفاع يومياً من ${SEO_BRANCHES[0].opens_display_ar} حتى ${SEO_BRANCHES[0].closes_display_ar}.`,
  },
  {
    question: 'ما هي أوقات عمل فرع كهرمانة قلالي؟',
    answer: `يعمل فرع قلالي يومياً من ${SEO_BRANCHES[1].opens_display_ar} حتى ${SEO_BRANCHES[1].closes_display_ar}.`,
  },
  {
    question: 'هل توجد خدمة التوصيل في فروع البحرين؟',
    answer: 'نعم، نوفر خدمة التوصيل المباشر عبر الواتساب لجميع المناطق المحيطة بفروعنا في الرفاع وقلالي.',
  },
  {
    question: 'أين يقع مطعم كهرمانة بغداد في الرفاع؟',
    answer: 'يقع فرعنا في منطقة الحجيات بالرفاع، البحرين.',
  },
  {
    question: 'أين يقع مطعم كهرمانة بغداد في قلالي؟',
    answer: 'يقع فرعنا على الشارع الرئيسي في قلالي، المحرق، البحرين.',
  },
]

const BRANCH_FAQS_EN = [
  {
    question: 'What are the opening hours of Kahramana Riffa branch?',
    answer: `Riffa branch is open daily from ${SEO_BRANCHES[0].opens_display_en} to ${SEO_BRANCHES[0].closes_display_en}.`,
  },
  {
    question: 'What are the opening hours of Kahramana Qallali branch?',
    answer: `Qallali branch is open daily from ${SEO_BRANCHES[1].opens_display_en} to ${SEO_BRANCHES[1].closes_display_en}.`,
  },
  {
    question: 'Is delivery available at Bahrain branches?',
    answer: 'Yes, we provide direct delivery via WhatsApp to all areas surrounding our branches in Riffa and Qallali.',
  },
  {
    question: 'Where is Kahramana Baghdad located in Riffa?',
    answer: 'Our branch is located in Al-Hajiaat area, Riffa, Bahrain.',
  },
  {
    question: 'Where is Kahramana Baghdad located in Qallali?',
    answer: 'Our branch is located on Main Street, Qallali, Muharraq, Bahrain.',
  },
]

export default async function BranchesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const localeKey = locale === 'ar' ? 'ar' : 'en'
  const isAr = locale === 'ar'
  const t = await getTranslations('branches')

  // Sort branches: active first
  const sortedBranches = [...BRANCH_LIST].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (a.status !== 'active' && b.status === 'active') return 1
    return 0
  })

  // Local SEO graph: one LocalBusiness per active branch + planned marker
  const graph = buildBranchesPageGraph(localeKey)

  const breadcrumb = buildBreadcrumb([
    { name: isAr ? 'الرئيسية' : 'Home',     url: localeKey === 'en' ? '/en/'         : '/' },
    { name: isAr ? 'الفروع'   : 'Branches', url: localeKey === 'en' ? '/en/branches' : '/branches' },
  ])

  // Map local FAQ data to FAQ schema format — bilingual
  const branchFaqs = isAr ? BRANCH_FAQS_AR : BRANCH_FAQS_EN
  const faqSchema = buildFAQSchema(branchFaqs.map(f => ({ question: f.question, answer: f.answer })))

  return (
    <main className="min-h-screen bg-brand-black pb-24" dir={isAr ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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
              tStatusOpen={t('status.open')}
              tStatusClosed={t('status.closed')}
              detailHref={branch.status === 'active' ? `/branches/${branch.id}` : undefined}
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
