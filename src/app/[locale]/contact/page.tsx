import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
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

  const nonce = (await headers()).get('x-nonce') ?? undefined
  const contactSchema = buildContactPageSchema(localeKey)

  const breadcrumb = buildBreadcrumb([
    { name: isAr ? 'الرئيسية' : 'Home',     url: localeKey === 'en' ? '/en/'        : '/' },
    { name: isAr ? 'تواصل معنا' : 'Contact', url: localeKey === 'en' ? '/en/contact' : '/contact' },
  ])

    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <div className="bg-brand-black min-h-screen">
        <ContactHero 
          eyebrow={t('heroEyebrow')}
          title={t('heroTitle')}
          description={t('heroDescription')}
          isAr={isAr}
        />

        <div className="max-w-7xl mx-auto px-6 sm:px-16 -mt-24 relative z-40 pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* ── Main Form Column ────────────────────────────────────────── */}
            <div className="lg:col-span-7 contact-main-content">
              <div className="bg-brand-surface/80 backdrop-blur-2xl border border-brand-border rounded-[2.5rem] p-8 sm:p-12 shadow-2xl shadow-brand-black/50">
                <div className="mb-10">
                  <h2 className={`text-3xl font-black text-brand-text mb-4 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                    {t('title')}
                  </h2>
                  <p className={`text-brand-muted text-lg ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('subtitle')}
                  </p>
                </div>
                <ContactForm />
              </div>
            </div>

            {/* ── Sidebar ────────────────────────────────────────────────── */}
            <aside className="lg:col-span-5 flex flex-col gap-8 contact-sidebar">
              
              {/* Info Card */}
              <div className="bg-brand-surface/40 backdrop-blur-xl border border-brand-border rounded-[2.5rem] p-10 group hover:border-brand-gold/30 transition-all duration-500">
                <h3 className={`text-brand-gold text-xs font-black tracking-widest uppercase mb-8 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('contactInfo')}
                </h3>

                <div className="space-y-10">
                  {BRANCH_LIST.map((branch) => (
                    <div key={branch.id} className="relative ps-6 border-s border-brand-gold/20 hover:border-brand-gold transition-colors duration-500">
                      <p className={`text-brand-text font-black text-lg mb-2 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                        {isAr ? branch.nameAr : branch.nameEn}
                      </p>
                      <p className="text-brand-muted text-sm leading-relaxed mb-4 font-almarai">
                        {isAr ? branch.addressAr : branch.addressEn}
                      </p>
                      <div className="flex items-center gap-6">
                        <a href={`tel:${branch.phone}`} className="text-brand-gold font-black text-sm hover:text-brand-text transition-colors tabular-nums tracking-widest" dir="ltr">
                          {branch.phone}
                        </a>
                        <a href={branch.waLink} target="_blank" rel="noopener noreferrer" className="text-green-400 font-bold text-xs uppercase tracking-widest hover:text-green-300 transition-colors">
                          {tB('whatsapp')}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* General Email */}
                <div className="mt-12 pt-10 border-t border-brand-border">
                  <span className={`block text-brand-muted text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('generalEnquiries')}
                  </span>
                  <a href={`mailto:${GENERAL_CONTACT.email}`} className="text-brand-text text-xl font-black hover:text-brand-gold transition-colors">
                    {GENERAL_CONTACT.email}
                  </a>
                </div>
              </div>

              {/* Socials Card */}
              <div className="bg-brand-surface/40 backdrop-blur-xl border border-brand-border rounded-[2.5rem] p-10">
                <h3 className={`text-brand-gold text-xs font-black tracking-widest uppercase mb-8 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('followUs')}
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {GENERAL_CONTACT.instagram && (
                    <SocialCard href={GENERAL_CONTACT.instagram} label="Instagram" handle="@kahramanat_b" icon="instagram" />
                  )}
                  {GENERAL_CONTACT.tiktok && (
                    <SocialCard href={GENERAL_CONTACT.tiktok} label="TikTok" handle="@kahramanat_b" icon="tiktok" />
                  )}
                  {GENERAL_CONTACT.facebook && (
                    <SocialCard href={GENERAL_CONTACT.facebook} label="Facebook" handle="kahramanat1" icon="facebook" />
                  )}
                </div>
              </div>

            </aside>
          </div>
        </div>
      </div>
      
      {/* GSAP Initialization */}
      <GsapInitializer />
    </>
  )
}

function SocialCard({ href, label, handle, icon }: { href: string, label: string, handle: string, icon: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-5 rounded-2xl bg-brand-black/20 border border-brand-border hover:border-brand-gold/40 hover:bg-brand-gold/5 transition-all duration-500 group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold group-hover:scale-110 transition-transform duration-500">
          {/* Simple icon logic or generic icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3V2z" className={icon !== 'facebook' ? 'hidden' : ''} />
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" className={icon !== 'instagram' ? 'hidden' : ''} />
            <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" className={icon !== 'instagram' ? 'hidden' : ''} />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" className={icon !== 'instagram' ? 'hidden' : ''} />
            <path d="M9 12a3 3 0 106 0 3 3 0 00-6 0z" className={icon !== 'tiktok' ? 'hidden' : ''} />
            <path d="M15 12h3M15 8V4M15 16v4" className={icon !== 'tiktok' ? 'hidden' : ''} />
            {/* Default icon if not matched */}
            <circle cx="12" cy="12" r="10" className={icon === 'facebook' || icon === 'instagram' || icon === 'tiktok' ? 'hidden' : ''} />
          </svg>
        </div>
        <div>
          <p className="text-brand-text font-black text-sm">{label}</p>
          <p className="text-brand-muted text-[10px] uppercase tracking-widest">{handle}</p>
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-muted group-hover:text-brand-gold group-hover:translate-x-1 transition-all">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </a>
  )
}

function GsapInitializer() {
  const isInitialized = useRef(false)
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true
    
    gsap.from('.contact-main-content', {
      x: -50,
      opacity: 0,
      duration: 1.2,
      ease: 'power4.out',
      delay: 0.5
    })
    
    gsap.from('.contact-sidebar > div', {
      x: 50,
      opacity: 0,
      duration: 1.2,
      stagger: 0.2,
      ease: 'power4.out',
      delay: 0.7
    })
  }, [])
  return null
}

