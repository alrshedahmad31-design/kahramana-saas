'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { useCartStore, selectTotalItems } from '@/lib/cart'
import CinematicButton from '@/components/ui/CinematicButton'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'
import type { LoyaltyTier } from '@/lib/supabase/custom-types'
import TierBadge from '@/components/loyalty/TierBadge'

// ── Customer summary for Header account button ────────────────────────────────

interface CustomerSummary {
  points_balance: number
  loyalty_tier:   LoyaltyTier
  name:           string | null
}

// ── Nav Links ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { key: 'menu',     href: '/menu'     as const },
  { key: 'reserve',  href: '/reserve'  as const },
  { key: 'catering', href: '/catering' as const },
  { key: 'about',    href: '/about'    as const },
  { key: 'contact',  href: '/contact'  as const },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function Header() {
  const t        = useTranslations('nav')
  const tAccount = useTranslations('account')
  const locale   = useLocale()
  const pathname = usePathname()
  const router   = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [customer, setCustomer] = useState<CustomerSummary | null>(null)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const cartItems  = useCartStore((s) => s.items)
  const openCart   = useCartStore((s) => s.openCart)
  const totalItems = selectTotalItems(cartItems)

  const isRTL        = locale === 'ar'
  const targetLocale = isRTL ? 'en' : 'ar'

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Resolve customer session + loyalty summary; refresh on auth state changes.
  useEffect(() => {
    const supabase = createBrowserSupabase()
    let cancelled = false

    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setCustomer(null)
        setAuthLoaded(true)
        return
      }
      const { data } = await supabase
        .from('customer_profiles')
        .select('points_balance, loyalty_tier, name')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      setCustomer((data as CustomerSummary | null) ?? null)
      setAuthLoaded(true)
    }

    void loadProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void loadProfile()
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  // Close account dropdown on outside click / Escape.
  useEffect(() => {
    if (!accountOpen) return
    function onClick(e: MouseEvent) {
      if (!accountMenuRef.current?.contains(e.target as Node)) setAccountOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [accountOpen])

  function handleLocaleSwitch() {
    router.replace(pathname, { locale: targetLocale })
  }

  function closeMenu() {
    setIsOpen(false)
  }

  async function handleSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    setAccountOpen(false)
    setIsOpen(false)
    router.refresh()
  }

  const formattedPoints = customer
    ? customer.points_balance.toLocaleString(isRTL ? 'ar-BH' : 'en-BH')
    : ''

  // Hide header on staff app and QR table routes
  if (
    pathname.includes('/dashboard') ||
    pathname.includes('/driver') ||
    pathname.includes('/waiter') ||
    pathname.includes('/table/')
  ) return null

  return (
    <div data-public-header className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none pt-4 sm:pt-6">
      <header
        className={`
          relative flex items-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
          pointer-events-auto
          ${isScrolled
            ? 'w-[92%] max-w-5xl rounded-full glass-surface h-14 px-2'
            : 'w-full max-w-7xl h-16 px-4 sm:px-6'
          }
        `}
      >
        <div className="flex items-center justify-between w-full gap-4">
          
          {/* Logo */}
          <Link
            href="/"
            onClick={closeMenu}
            aria-label={isRTL ? 'الرئيسية' : 'Home'}
            className="shrink-0 flex items-center transition-transform hover:scale-105 active:scale-95"
          >
            <Image
              src="/assets/brand/logo-full.webp"
              alt={isRTL ? 'كهرمانة بغداد' : 'Kahramana Baghdad'}
              width={526}
              height={335}
              priority
              className={`transition-all duration-500 ${isScrolled ? 'h-10 w-auto' : 'h-14 w-auto'}`}
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-4" aria-label={t('menu')}>
            {NAV_LINKS.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className={`
                  px-4 py-2 rounded-full text-sm font-bold transition-all duration-300
                  ${isRTL ? 'font-cairo' : 'font-satoshi'}
                  ${pathname === href
                    ? 'text-brand-gold bg-brand-gold/10'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-text/5'
                  }
                `}
              >
                {t(key as 'menu' | 'reserve' | 'catering' | 'about' | 'contact')}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleLocaleSwitch}
              aria-label={t('languageAlt')}
              className="px-4 py-2 rounded-full text-sm font-bold text-brand-muted hover:text-brand-text hover:bg-brand-text/5 transition-all"
            >
              {t('language')}
            </button>

            {/* Account button — gated on auth state */}
            {!authLoaded ? (
              // Reserve space to avoid layout shift while session resolves
              <div className="w-11 h-11" aria-hidden />
            ) : !customer ? (
              <Link
                href="/account"
                aria-label={tAccount('loginOrRegister')}
                className={`px-4 py-2 rounded-full text-sm font-bold border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 transition-all ${isRTL ? 'font-cairo' : 'font-satoshi'}`}
              >
                {tAccount('loginOrRegister')}
              </Link>
            ) : (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label={tAccount('title')}
                  className="flex items-center gap-2 ps-2 pe-3 h-11 rounded-full border border-brand-text/10 hover:border-brand-gold/50 hover:bg-brand-text/5 transition-all"
                >
                  <UserIcon />
                  <span className="font-satoshi text-xs font-bold text-brand-gold tabular-nums">
                    {formattedPoints}
                  </span>
                  <TierBadge
                    tier={customer.loyalty_tier}
                    size="sm"
                    showLabel={false}
                    locale={locale}
                  />
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    className="absolute top-full mt-2 end-0 w-64 p-2 glass-surface rounded-2xl text-start shadow-lg"
                  >
                    <div className="px-3 py-2 border-b border-brand-text/10">
                      <p className={`text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                        {tAccount('title')}
                      </p>
                      {customer.name && (
                        <p className={`text-sm font-bold text-brand-text truncate ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                          {customer.name}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2">
                        <TierBadge tier={customer.loyalty_tier} size="sm" locale={locale} />
                        <span className="font-satoshi text-xs font-bold text-brand-gold tabular-nums">
                          {formattedPoints} {tAccount('pointsShort')}
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setAccountOpen(false)}
                      role="menuitem"
                      className={`block px-3 py-2 mt-1 rounded-lg text-sm text-brand-text hover:bg-brand-text/5 ${isRTL ? 'font-cairo' : 'font-satoshi'}`}
                    >
                      {tAccount('title')}
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      role="menuitem"
                      className={`block w-full px-3 py-2 rounded-lg text-sm text-brand-muted hover:text-brand-text hover:bg-brand-text/5 text-start ${isRTL ? 'font-cairo' : 'font-satoshi'}`}
                    >
                      {tAccount('signOut')}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={openCart}
              aria-label={t('cartAlt')}
              className="relative flex items-center justify-center w-11 h-11 rounded-full border border-brand-text/10 hover:border-brand-gold/50 hover:bg-brand-text/5 transition-all"
            >
              <CartIcon />
              {totalItems > 0 && (
                <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] bg-brand-gold text-brand-black text-[10px] font-bold rounded-full flex items-center justify-center px-1 tabular-nums shadow-lg">
                  {totalItems}
                </span>
              )}
            </button>

            <CinematicButton
              href="/reserve"
              isRTL={isRTL}
              aria-label={t('reserveTable')}
              className="px-5 py-2 text-sm font-bold rounded-full"
            >
              {t('reserveTable')}
            </CinematicButton>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            {/* Mobile account button — icon only, links to /account in both states */}
            {authLoaded && (
              <Link
                href="/account"
                aria-label={customer ? tAccount('title') : tAccount('loginOrRegister')}
                className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all ${
                  customer
                    ? 'border border-brand-text/10'
                    : 'border border-brand-gold/40 text-brand-gold'
                }`}
              >
                <UserIcon />
                {customer && (
                  <span className="absolute -top-1 -end-1 inline-flex" aria-hidden>
                    <TierBadge
                      tier={customer.loyalty_tier}
                      size="sm"
                      showLabel={false}
                      locale={locale}
                    />
                  </span>
                )}
              </Link>
            )}

            <button
              onClick={openCart}
              aria-label={t('cartAlt')}
              className="relative flex items-center justify-center w-11 h-11 rounded-full border border-brand-text/10"
            >
              <CartIcon />
              {totalItems > 0 && (
                <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] bg-brand-gold text-brand-black text-[10px] font-bold rounded-full flex items-center justify-center px-1 tabular-nums">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? t('closeMenu') : t('openMenu')}
              className="w-11 h-11 flex flex-col justify-center items-center gap-1.5"
            >
              <span
                className={`w-5 h-0.5 bg-brand-text block rounded-full transition-transform duration-300 ${isOpen ? 'translate-y-2 rotate-45' : ''}`}
              />
              <span
                className={`w-5 h-0.5 bg-brand-text block rounded-full transition-opacity duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'}`}
              />
              <span
                className={`w-5 h-0.5 bg-brand-text block rounded-full transition-transform duration-300 ${isOpen ? '-translate-y-2 -rotate-45' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isOpen && (
            <div className="absolute top-full inset-x-0 mt-4 mx-4 p-6 glass-surface rounded-[2rem] md:hidden pointer-events-auto">
              <nav className="flex flex-col gap-4">
                {NAV_LINKS.map(({ key, href }) => (
                    <Link
                      key={key}
                      href={href}
                      onClick={closeMenu}
                      className={`
                        text-lg font-bold py-2 border-b border-brand-text/5 last:border-0 text-start
                        ${isRTL ? 'font-cairo' : 'font-satoshi'}
                        ${pathname === href ? 'text-brand-gold' : 'text-brand-text'}
                      `}
                    >
                    {t(key as 'menu' | 'reserve' | 'catering' | 'about' | 'contact')}
                    </Link>
                ))}

                {/* Account row — login link or signed-in summary + sign-out */}
                {authLoaded && !customer && (
                  <Link
                    href="/account"
                    onClick={closeMenu}
                    className={`text-lg font-bold py-2 border-b border-brand-text/5 text-start text-brand-gold ${isRTL ? 'font-cairo' : 'font-satoshi'}`}
                  >
                    {tAccount('loginOrRegister')}
                  </Link>
                )}
                {authLoaded && customer && (
                  <div className="border-b border-brand-text/5 pb-3">
                    <Link
                      href="/account"
                      onClick={closeMenu}
                      className={`flex items-center justify-between gap-3 py-2 text-start ${isRTL ? 'font-cairo' : 'font-satoshi'}`}
                    >
                      <span className="text-lg font-bold text-brand-text">
                        {tAccount('title')}
                      </span>
                      <span className="flex items-center gap-2">
                        <TierBadge
                          tier={customer.loyalty_tier}
                          size="sm"
                          showLabel={false}
                          locale={locale}
                        />
                        <span className="font-satoshi text-xs font-bold text-brand-gold tabular-nums">
                          {formattedPoints} {tAccount('pointsShort')}
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className={`mt-1 text-sm text-brand-muted text-start ${isRTL ? 'font-cairo' : 'font-satoshi'}`}
                    >
                      {tAccount('signOut')}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={handleLocaleSwitch}
                    aria-label={t('languageAlt')}
                    className="text-brand-muted font-bold"
                  >
                    {t('language')}
                  </button>
                  <CinematicButton
                    href="/reserve"
                    isRTL={isRTL}
                    aria-label={t('reserveTable')}
                    className="px-6 py-3 rounded-full font-bold"
                  >
                    {t('reserveTable')}
                  </CinematicButton>
                </div>
              </nav>
            </div>
        )}
      </header>
    </div>

  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CartIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
