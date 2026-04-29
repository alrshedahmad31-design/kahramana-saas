import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { BRANCH_LIST, GENERAL_CONTACT } from '@/constants/contact'
import ContactForm from '@/components/contact/ContactForm'
import { buildContactPageSchema, buildBreadcrumb } from '@/lib/seo/schemas'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations('seo')
  return {
    title: t('contactTitle'),
    alternates: {
      canonical: locale === 'en' ? '/en/contact' : '/contact',
      languages: { 'x-default': '/contact', ar: '/contact', en: '/en/contact' },
    },
  }
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const localeKey = locale === 'ar' ? 'ar' : 'en'
  const isAr = locale === 'ar'
  const t    = await getTranslations('contact')
  const tB   = await getTranslations('branches')

  const contactSchema = buildContactPageSchema(localeKey)

  const breadcrumb = buildBreadcrumb([
    { name: isAr ? 'الرئيسية' : 'Home',     url: localeKey === 'en' ? '/en/'        : '/' },
    { name: isAr ? 'تواصل معنا' : 'Contact', url: localeKey === 'en' ? '/en/contact' : '/contact' },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="min-h-screen bg-brand-black px-4 sm:px-6 pt-10 pb-20 max-w-6xl mx-auto"
      >
        {/* Page header */}
        <div className="mb-10">
          <h1
            className={`text-4xl sm:text-5xl font-black text-brand-text mb-3
              ${isAr ? 'font-cairo' : 'font-editorial'}`}
          >
            {t('title')}
          </h1>
          <p className="font-almarai text-brand-muted text-lg">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">

          {/* Form — wider column */}
          <div className="lg:col-span-3">
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-8">
              <ContactForm />
            </div>
          </div>

          {/* Sidebar — contact info */}
          <aside className="lg:col-span-2 flex flex-col gap-6">

            {/* Branch contacts */}
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
              <h2
                className={`font-semibold text-brand-text mb-5
                  ${isAr ? 'font-cairo' : 'font-satoshi'}`}
              >
                {t('contactInfo')}
              </h2>

              <div className="flex flex-col gap-6">
                {BRANCH_LIST.map((branch) => (
                  <div key={branch.id} className="flex flex-col gap-2">
                    <p
                      className={`text-sm font-bold text-brand-text
                        ${isAr ? 'font-cairo' : 'font-satoshi'}`}
                    >
                      {isAr ? branch.nameAr : branch.nameEn}
                    </p>
                    <p className="font-almarai text-xs text-brand-muted leading-relaxed">
                      {isAr ? branch.addressAr : branch.addressEn}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href={`tel:${branch.phone}`}
                        className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light
                                   transition-colors tabular-nums"
                        dir="ltr"
                      >
                        {branch.phone}
                      </a>
                      <span className="text-brand-border">·</span>
                      <a
                        href={branch.waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-satoshi text-sm text-green-400 hover:text-green-300
                                   transition-colors"
                      >
                        {tB('whatsapp')}
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Email */}
              <div className="mt-5 pt-5 border-t border-brand-border">
                <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wider mb-1">
                  {t('generalEnquiries')}
                </p>
                <a
                  href={`mailto:${GENERAL_CONTACT.email}`}
                  className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light
                             transition-colors"
                >
                  {GENERAL_CONTACT.email}
                </a>
              </div>
            </div>

            {/* Social media */}
            <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
              <h2
                className={`font-semibold text-brand-text mb-4
                  ${isAr ? 'font-cairo' : 'font-satoshi'}`}
              >
                {t('followUs')}
              </h2>
              <div className="flex flex-col gap-3">
                {GENERAL_CONTACT.instagram && (
                  <SocialRow
                    href={GENERAL_CONTACT.instagram}
                    label="Instagram"
                    handle="@kahramanat_b"
                  />
                )}
                {GENERAL_CONTACT.tiktok && (
                  <SocialRow
                    href={GENERAL_CONTACT.tiktok}
                    label="TikTok"
                    handle="@kahramanat_b"
                  />
                )}
                {GENERAL_CONTACT.facebook && (
                  <SocialRow
                    href={GENERAL_CONTACT.facebook}
                    label="Facebook"
                    handle="kahramanat1"
                  />
                )}
              </div>
            </div>

          </aside>
        </div>
      </div>
    </>
  )
}

function SocialRow({
  href,
  label,
  handle,
}: {
  href: string
  label: string
  handle: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-brand-border
                 px-3 py-2.5 hover:border-brand-gold transition-colors duration-150 group"
    >
      <span className="font-satoshi text-sm font-medium text-brand-muted
                        group-hover:text-brand-gold transition-colors">
        {label}
      </span>
      <span className="font-satoshi text-xs text-brand-muted/60 ms-auto">{handle}</span>
    </a>
  )
}
