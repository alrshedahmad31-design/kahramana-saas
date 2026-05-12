import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import { BRANCH_LIST, SITE_URL } from '@/constants/contact'
import { buildBreadcrumb } from '@/lib/seo/schemas'
import SectionHeader from '@/components/ui/SectionHeader'
import ReserveForm from '@/components/reserve/ReserveForm'

type Props = {
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return [{ locale: 'ar' }, { locale: 'en' }]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const isAr = locale === 'ar'

  const title = isAr
    ? 'احجز طاولة | كهرمانة بغداد'
    : 'Reserve a Table | Kahramana Baghdad'

  const description = isAr
    ? 'احجز طاولتك في مطعم كهرمانة بغداد. فرعا الرفاع والقلالي. تأكيد سريع عبر واتساب.'
    : 'Reserve your table at Kahramana Baghdad. Riffa and Qallali branches. Fast WhatsApp confirmation.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ['/assets/hero/hero-branches.webp'],
    },
    alternates: {
      canonical: isAr ? `${SITE_URL}/reserve` : `${SITE_URL}/en/reserve`,
      languages: {
        'x-default': `${SITE_URL}/reserve`,
        'ar-BH':     `${SITE_URL}/reserve`,
        'en-BH':     `${SITE_URL}/en/reserve`,
      },
    },
  }
}

export default async function ReservePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const isAr = locale === 'ar'
  const t = await getTranslations({ locale, namespace: 'reserve' })

  const branches = BRANCH_LIST
    .filter((b) => b.status === 'active')
    .map((b) => ({ id: b.id, nameAr: b.nameAr, nameEn: b.nameEn }))

  const breadcrumb = buildBreadcrumb([
    { name: isAr ? 'الرئيسية' : 'Home',         url: locale === 'en' ? '/en/'        : '/' },
    { name: isAr ? 'احجز طاولة' : 'Reserve a Table', url: locale === 'en' ? '/en/reserve' : '/reserve' },
  ])

  return (
    <div className="min-h-screen bg-brand-black" dir={isAr ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-12 sm:pt-28 scroll-mt-28">
        <SectionHeader title={t('title')} subtitle={t('eyebrow')} />
        <p
          className={`mx-auto mt-6 max-w-2xl text-center text-base leading-7 text-brand-muted ${
            isAr ? 'font-almarai' : 'font-satoshi'
          }`}
        >
          {t('subtitle')}
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <ReserveForm
          locale={isAr ? 'ar' : 'en'}
          branches={branches}
        />
      </section>
    </div>
  )
}
