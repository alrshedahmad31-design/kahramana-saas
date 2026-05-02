import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { BRANCH_LIST, GENERAL_CONTACT } from '@/constants/contact'
import ContactForm from '@/components/contact/ContactForm'
import { buildContactPageSchema, buildBreadcrumb } from '@/lib/seo/schemas'
import ContactHero from '@/components/contact/ContactHero'
import ContactAnimations from '@/components/contact/ContactAnimations'
import ContactMaps from '@/components/contact/ContactMaps'
import { Phone, MapPin, Clock, ArrowUpRight } from 'lucide-react'

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
  const isRTL = locale === 'ar'
  const t = await getTranslations('contact')
  const nonce = (await headers()).get('x-nonce') ?? undefined

  const jsonLd = buildContactPageSchema(locale === 'ar' ? 'ar' : 'en')
  const breadcrumb = buildBreadcrumb([
    { name: isRTL ? 'الرئيسية' : 'Home', url: isRTL ? '/' : '/en' },
    { name: isRTL ? 'تواصل معنا' : 'Contact Us', url: isRTL ? '/contact' : '/en/contact' },
  ])

  return (
    <main className="min-h-screen bg-brand-black overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <ContactAnimations />

      {/* 1. Hero Section */}
      <ContactHero 
        eyebrow={t('heroEyebrow')}
        title={t('heroTitle')}
        description={t('heroDescription')}
        imageAlt={t('heroImageAlt')}
        isAr={isRTL}
      />

      {/* 2. Maps Section */}
      <ContactMaps isRTL={isRTL} />

      {/* 3. Main Content & Sidebar */}
      <section className="relative z-10 -mt-20 pb-32 px-6 sm:px-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Sidebar: Information Cards */}
          <div className="lg:col-span-4 space-y-8 order-2 lg:order-1">
            
            {/* Branch Contact Cards */}
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-brand-gold/20" />
                <h2 className={`text-xs font-bold text-brand-gold uppercase tracking-[0.3em] whitespace-nowrap ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                  {isRTL ? 'بيانات الفروع' : 'Branch Details'}
                </h2>
                <div className="h-px flex-1 bg-brand-gold/20" />
              </div>

              <div className="grid gap-6">
                {BRANCH_LIST.filter(b => b.status === 'active').map((branch) => (
                  <div key={branch.id} className="glass-surface p-8 rounded-3xl border border-white/5 hover:border-brand-gold/30 transition-all group relative overflow-hidden">
                    {/* Background accent */}
                    <div className="absolute top-0 end-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-gold/10 transition-colors" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 flex items-center justify-center text-brand-gold border border-brand-gold/20 group-hover:scale-110 transition-transform">
                          <MapPin className="w-6 h-6" />
                        </div>
                        <h3 className={`text-xl font-bold text-brand-text ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                          {isRTL ? branch.nameAr : branch.nameEn}
                        </h3>
                      </div>

                      <div className="space-y-5">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group/item">
                          <div className="w-10 h-10 rounded-xl bg-brand-gold/20 flex items-center justify-center text-brand-gold">
                            <Phone className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-1">
                              {isRTL ? 'رقم الهاتف' : 'Phone Number'}
                            </p>
                            <p className="text-lg font-black text-brand-gold tracking-wider group-hover/item:text-white transition-colors">
                              {branch.phone}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4 px-4">
                          <Clock className="w-5 h-5 mt-1 text-brand-gold/60" />
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-brand-muted mb-1">
                              {isRTL ? 'ساعات العمل' : 'Opening Hours'}
                            </p>
                            <p className="text-sm font-medium text-brand-text leading-relaxed">
                              {isRTL ? branch.hours.ar : branch.hours.en}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Media Section */}
            <div className="space-y-6 pt-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-brand-gold/20" />
                <h2 className={`text-xs font-bold text-brand-gold uppercase tracking-[0.3em] whitespace-nowrap ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                  {isRTL ? 'تابعنا رقمياً' : 'Follow Us Digital'}
                </h2>
                <div className="h-px flex-1 bg-brand-gold/20" />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <SocialCard 
                  platform="Instagram" 
                  handle="@KAHRAMANAT_B" 
                  href={GENERAL_CONTACT.instagram}
                  icon={<InstagramIcon className="w-5 h-5" />}
                />
                <SocialCard 
                  platform="TikTok" 
                  handle="@KAHRAMANAT_B" 
                  href={GENERAL_CONTACT.tiktok}
                  icon={<TikTokIcon className="w-5 h-5" />}
                />
                <SocialCard 
                  platform="Facebook" 
                  handle="KAHRAMANAT1" 
                  href={GENERAL_CONTACT.facebook}
                  icon={<FacebookIcon className="w-5 h-5" />}
                />
              </div>
            </div>
          </div>

          {/* Contact Form Section */}
          <div className="lg:col-span-8 order-1 lg:order-2">
            <div className="glass-surface p-8 sm:p-16 rounded-[40px] border border-white/5 relative overflow-hidden">
              <div className="absolute -top-24 -end-24 w-64 h-64 bg-brand-gold/10 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="relative z-10">
                <div className="mb-12">
                  <span className="text-[10px] font-bold tracking-[0.4em] text-brand-gold uppercase mb-4 block">
                    {t('heroEyebrow')}
                  </span>
                  <h2 className={`text-3xl sm:text-5xl font-bold text-brand-text mb-6 ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
                    {t('formTitle')}
                  </h2>
                  <p className="text-brand-muted max-w-xl text-lg leading-relaxed">
                    {t('formDesc')}
                  </p>
                </div>

                <ContactForm />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 4. Luxury Branding Element */}
      <section className="py-24 flex justify-center opacity-10 grayscale">
         <div className="flex items-center gap-12 sm:gap-24 grayscale brightness-200">
            <div className="w-16 h-16 border border-white rounded-full flex items-center justify-center font-editorial italic text-2xl">K</div>
            <div className="w-16 h-16 border border-white rounded-full flex items-center justify-center font-editorial italic text-2xl">B</div>
            <div className="w-16 h-16 border border-white rounded-full flex items-center justify-center font-editorial italic text-2xl">Q</div>
         </div>
      </section>
    </main>
  )
}

function SocialCard({ platform, handle, href, icon }: { platform: string, handle: string, href: string, icon: React.ReactNode }) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="group flex items-center justify-between p-5 glass-surface rounded-2xl border border-white/5 hover:border-brand-gold/40 transition-all"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:text-brand-gold transition-colors">
          {icon}
        </div>
        <div>
          <h4 className="text-xs font-bold text-brand-text uppercase tracking-widest">{platform}</h4>
          <p className="text-[10px] text-brand-muted mt-1 tracking-wider uppercase">{handle}</p>
        </div>
      </div>
      <ArrowUpRight className="w-4 h-4 text-brand-muted group-hover:text-brand-gold group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
    </a>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
    </svg>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
    </svg>
  )
}
