import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { BRANCH_LIST, GENERAL_CONTACT } from '@/constants/contact'
import { isBranchOpen } from '@/lib/utils/time'

// ── Components ───────────────────────────────────────────────────────────────

export default async function Footer() {
  const locale = await getLocale()
  const tNav = await getTranslations('nav')
  const isRTL = locale === 'ar'
  const year = new Date().getFullYear()

  const marqueeText = isRTL ? 'كهرمانة بغداد • سفير المذاق البغدادي • ' : 'KAHRAMANA BAGHDAD • THE AMBASSADOR OF BAGHDAD • '

  return (
    <footer className="relative bg-brand-black pt-20 overflow-hidden border-t border-brand-border/50">
      {/* ── Luxury Background Elements ────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 start-1/2 -translate-x-1/2 w-[120%] h-[500px] bg-brand-gold/5 blur-[120px] rounded-[100%]" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/[0.04] via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-transparent to-transparent" />
      </div>

      {/* ── Tier 1: The Marquee (Artistic Flair) ──────────────────────────── */}
      <div className="relative z-10 py-10 border-b border-brand-border/30 overflow-hidden select-none">
        <div
          className="flex whitespace-nowrap"
        >
          {[...Array(10)].map((_, i) => (
            <span 
              key={i} 
              className={`text-[8vw] font-black uppercase tracking-tighter opacity-5 px-10 ${isRTL ? 'font-cairo' : 'font-editorial italic'}`}
            >
              {marqueeText}
            </span>
          ))}
        </div>
      </div>

      {/* ── Tier 2: Information Grid ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-16 py-24 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 sm:gap-24">
          
          {/* Identity Column */}
          <div className="md:col-span-1 space-y-8">
            <div className="space-y-6">
              <Link href="/" className="inline-block transition-transform hover:scale-105 active:scale-95">
                <Image
                  src="/assets/logo.svg"
                  alt={isRTL ? 'كهرمانة بغداد' : 'Kahramana Baghdad'}
                  width={140}
                  height={42}
                  className="h-10 w-auto"
                />
              </Link>
              <div className="space-y-3">
                <h2 className={`text-2xl font-bold text-brand-text ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
                  {isRTL ? 'كهرمانة بغداد' : 'Kahramana Baghdad'}
                </h2>
                <p className="text-brand-muted text-sm leading-relaxed max-w-xs">
                  {isRTL 
                    ? 'منذ ٢٠١٨، نلتزم بتقديم المذاق البغدادي الأصيل في قلب البحرين، حيث تجتمع الجودة والتقاليد في كل طبق.'
                    : 'Since 2018, committed to serving authentic Baghdadi taste in the heart of Bahrain, where quality and tradition meet.'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <SocialIcon href={GENERAL_CONTACT.instagram} icon={<InstagramIcon />} label="Instagram" />
              <SocialIcon href={GENERAL_CONTACT.facebook} icon={<FacebookIcon />} label="Facebook" />
              <SocialIcon href={GENERAL_CONTACT.tiktok} icon={<TikTokIcon />} label="TikTok" />
            </div>
          </div>

          {/* Branches Column */}
          <div className="space-y-8">
            <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-brand-gold opacity-60">
              {isRTL ? 'فروعنا' : 'Our Branches'}
            </h3>
            <div className="space-y-6">
              {BRANCH_LIST.map((branch) => {
                const isOpen = branch.status === 'active' && isBranchOpen(branch.hours.opens, branch.hours.closes)
                return (
                  <div key={branch.id} className="group cursor-pointer">
                    <p className={`text-sm font-bold text-brand-text group-hover:text-brand-gold transition-colors ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                      {isRTL ? branch.nameAr : branch.nameEn}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span suppressHydrationWarning className={`w-1 h-1 rounded-full transition-colors duration-500 ${isOpen ? 'bg-brand-success' : 'bg-brand-muted opacity-30'}`} />
                      <p className="text-[10px] text-brand-muted/70 uppercase tracking-wider">
                        {isRTL ? branch.hours.ar : branch.hours.en}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Navigation Column */}
          <div className="space-y-8">
            <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-brand-gold opacity-60">
              {isRTL ? 'التنقل' : 'Navigation'}
            </h3>
            <nav className="flex flex-col gap-4">
              {[
                { label: tNav('menu'),     href: '/menu' },
                { label: tNav('branches'), href: '/branches' },
                { label: isRTL ? 'تواصل معنا' : 'Contact', href: '/contact' },
                { label: isRTL ? 'من نحن' : 'About Us', href: '/about' },
                { label: isRTL ? 'سياسة الاسترجاع' : 'Refund Policy', href: '/refund-policy' },
              ].map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className="text-sm text-brand-muted hover:text-brand-gold hover:ps-2 transition-all duration-300"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Connect Column */}
          <div className="space-y-8">
            <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-brand-gold opacity-60">
              {isRTL ? 'تواصل معنا' : 'Connect'}
            </h3>
            <div className="space-y-6">
              <a href={`mailto:${GENERAL_CONTACT.email}`} className="block group">
                <p className="text-[10px] text-brand-muted uppercase tracking-widest mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email'}</p>
                <p className="text-sm font-bold text-brand-text group-hover:text-brand-gold transition-colors underline decoration-brand-gold/20 underline-offset-4">
                  {GENERAL_CONTACT.email}
                </p>
              </a>
              <div className="p-6 rounded-2xl bg-brand-surface/50 border border-brand-border/50 backdrop-blur-sm">
                <p className="text-[10px] font-bold text-brand-gold uppercase tracking-[0.2em] mb-4">
                  {isRTL ? 'النظام مباشر' : 'System Live'}
                </p>
                <div className="flex items-center gap-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-success" />
                  </span>
                  <span className="text-[11px] font-bold text-brand-text tracking-widest uppercase">
                    {isRTL ? 'جاهز لاستقبال الطلبات' : 'Ready for Orders'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Tier 3: Bottom Bar ────────────────────────────────────────────── */}
      <div className="border-t border-brand-border/30">
        <div className="max-w-7xl mx-auto px-6 sm:px-16 py-10 flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-[10px] font-medium text-brand-muted/50 tracking-[0.2em] uppercase">
            © <span suppressHydrationWarning>{year}</span> Kahramana Baghdad. Crafted with Passion.
          </p>
          
          <div className="flex items-center gap-8">
            <Link href="/terms" className="text-[10px] text-brand-muted/40 hover:text-brand-gold transition-colors uppercase tracking-widest">
              {isRTL ? 'الشروط والأحكام' : 'Terms & Conditions'}
            </Link>
            <div className="h-4 w-px bg-brand-border/30" />
            <p className="text-[10px] text-brand-muted/40 uppercase tracking-widest">
              Bahrain • Iraq
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SocialIcon({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-10 h-10 flex items-center justify-center rounded-xl bg-brand-surface border border-brand-border text-brand-muted hover:border-brand-gold hover:text-brand-gold hover:-translate-y-0.5 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/20"
    >
      {icon}
    </a>
  )
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
    </svg>
  )
}
