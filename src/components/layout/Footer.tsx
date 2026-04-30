import { getTranslations, getLocale } from 'next-intl/server'
import Link from 'next/link'
import { BRANCH_LIST, GENERAL_CONTACT } from '@/constants/contact'

// ── Component ─────────────────────────────────────────────────────────────────

export default async function Footer() {
  const locale = await getLocale()
  const t      = await getTranslations('branches')
  const tNav   = await getTranslations('nav')
  const isRTL  = locale === 'ar'
  const year   = new Date().getFullYear()

  return (
    <footer className="bg-brand-black border-t border-white/5 rounded-t-[4rem] relative overflow-hidden mt-20">
      {/* Subtle Noise/Texture background */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/assets/hero/hero-poster.webp')] bg-cover bg-center grayscale" />

      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-6 sm:px-16 py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 sm:gap-20">

          {/* Column 1 — Brand */}
          <div className={`md:col-span-2 flex flex-col gap-6 ${isRTL ? 'items-end' : 'items-start'}`}>
            <p
              className={`text-3xl sm:text-5xl font-bold text-brand-text leading-tight text-start
                ${isRTL ? 'font-cairo' : 'font-editorial'}`}
            >
              {isRTL ? 'كهرمانة بغداد' : 'Kahramana Baghdad'}
            </p>
            <p
              className={`text-lg text-brand-muted font-almarai leading-relaxed max-w-md text-start`}
            >
              {isRTL
                ? 'نكهة الرافدين الأصيلة في قلب البحرين. التزام تام بالجودة والتراث.'
                : 'Authentic Mesopotamian flavors in the heart of Bahrain. A commitment to quality and heritage.'}
            </p>

            {/* Social links */}
            <div className={`flex items-center gap-4 ${isRTL ? 'justify-end' : 'justify-start'}`}>
              {GENERAL_CONTACT.instagram && (
                <SocialLink href={GENERAL_CONTACT.instagram} label="Instagram">
                  <InstagramIcon />
                </SocialLink>
              )}
              {GENERAL_CONTACT.facebook && (
                <SocialLink href={GENERAL_CONTACT.facebook} label="Facebook">
                  <FacebookIcon />
                </SocialLink>
              )}
              {GENERAL_CONTACT.tiktok && (
                <SocialLink href={GENERAL_CONTACT.tiktok} label="TikTok">
                  <TikTokIcon />
                </SocialLink>
              )}
            </div>
          </div>

          {/* Column 2 — Branches */}
          <div className={`flex flex-col gap-6 ${isRTL ? 'items-end' : 'items-start'}`}>
            <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-brand-gold font-satoshi">
              {t('footerTitle')}
            </h3>
            <div className="flex flex-col gap-6 w-full">
              {BRANCH_LIST.map((branch) => (
                <div
                  key={branch.id}
                  className={`flex flex-col gap-2 ${isRTL ? 'items-end' : 'items-start'}`}
                >
                  <p className={`text-sm font-bold text-brand-text ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                    {isRTL ? branch.nameAr : branch.nameEn}
                  </p>
                  <p className="text-xs text-brand-muted font-almarai opacity-70">
                    {isRTL ? branch.hours.ar : branch.hours.en}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3 — System */}
          <div className={`flex flex-col gap-6 ${isRTL ? 'items-end' : 'items-start'}`}>
            <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-brand-gold font-satoshi">
              {isRTL ? 'النظام' : 'System'}
            </h3>
            <nav className={`flex flex-col gap-4 ${isRTL ? 'items-end' : 'items-start'}`}>
              {[
                { label: tNav('menu'),     href: `${locale === 'en' ? '/en' : ''}/menu`     },
                { label: tNav('branches'), href: `${locale === 'en' ? '/en' : ''}/branches` },
                { label: isRTL ? 'الخصوصية' : 'Privacy', href: `${locale === 'en' ? '/en' : ''}/privacy` },
                { label: isRTL ? 'تواصل معنا' : 'Contact', href: `${locale === 'en' ? '/en' : ''}/contact` },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm text-brand-muted hover:text-brand-gold transition-all ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 sm:px-16 py-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          
          {/* Status indicator */}
          <div className="flex items-center gap-3 px-4 py-2 bg-brand-success/10 border border-brand-success/20 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-success" />
            </span>
            <span className="font-satoshi text-brand-success text-[10px] font-bold tracking-widest uppercase">
              {isRTL ? 'النظام نشط' : 'System Operational'}
            </span>
          </div>

          {/* Copyright */}
          <p className="font-satoshi text-brand-muted text-[10px] tracking-wider uppercase opacity-50">
            © {year} KAHRAMANA BAGHDAD. ALL RIGHTS RESERVED.
          </p>

        </div>
      </div>
    </footer>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SocialLink({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex items-center justify-center w-9 h-9
                 border border-brand-border rounded-lg text-brand-muted
                 hover:border-brand-gold hover:text-brand-gold
                 transition-colors duration-150"
    >
      {children}
    </a>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16} aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16} aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.79a8.18 8.18 0 004.78 1.52V6.85a4.85 4.85 0 01-1.01-.16z" />
    </svg>
  )
}
