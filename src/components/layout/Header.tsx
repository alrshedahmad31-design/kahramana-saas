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
// Split into two groups around the centered logo. DOM order is constant; the
// inline-start group renders on the right in RTL via document `dir`.

const GROUP_START = [
  { key: 'menu',     href: '/menu'     as const },
  { key: 'branches', href: '/branches' as const },
  { key: 'catering', href: '/catering' as const },
  { key: 'about',    href: '/about'    as const },
] as const

const GROUP_END = [
  { key: 'contact', href: '/contact' as const },
] as const

const ALL_LINKS = [...GROUP_START, ...GROUP_END] as const

type NavKey = (typeof ALL_LINKS)[number]['key']

// ── Component ─────────────────────────────────────────────────────────────────

export default function Header() {
  const t        = useTranslations('nav')
  const tAccount = useTranslations('account')
  const locale   = useLocale()
  const pathname = usePathname() ?? '/'
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
  const toggleLabel  = isRTL ? 'EN' : 'AR'
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Resolve customer session + loyalty summary; refresh on auth state changes.
  useEffect(() => {
    if (!hasSupabaseEnv) {
      setCustomer(null)
      setAuthLoaded(true)
      return
    }

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
  }, [hasSupabaseEnv])

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
    if (!hasSupabaseEnv) return
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    setAccountOpen(false)
    setIsOpen(false)
    router.refresh()
  }

  const formattedPoints = customer
    ? customer.points_balance.toLocaleString(isRTL ? 'ar-BH' : 'en-BH')
    : ''

  // Premium typography helpers — Arabic stays untracked & sentence case;
  // English picks up tracking + uppercase for the fine-dining feel.
  const linkTypography = isRTL
    ? 'font-cairo font-medium'
    : 'font-satoshi font-medium tracking-[0.08em] uppercase'

  // Hide header on staff app and QR table routes
  if (
    pathname.includes('/dashboard') ||
    pathname.includes('/driver') ||
    pathname.includes('/waiter') ||
    pathname.includes('/kds') ||
    pathname.includes('/table/')
  ) return null

  function NavItem({ navKey, href }: { navKey: NavKey; href: (typeof ALL_LINKS)[number]['href'] }) {
    const active = pathname === href
    return (
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`
          relative px-3 py-2 text-[13px] transition-colors duration-300
          ${linkTypography}
          ${active ? 'text-brand-gold' : 'text-brand-muted hover:text-brand-gold/80'}
          after:content-[''] after:absolute after:bottom-1 after:inset-x-3 after:h-px after:bg-brand-gold
          after:origin-center after:transition-transform after:duration-300
          motion-reduce:after:transition-none
          ${active ? 'after:scale-x-100' : 'after:scale-x-0'}
        `}
      >
        {t(navKey)}
      </Link>
    )
  }

  return (
    <div data-public-header className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none pt-4 sm:pt-6">
      <header
        className={`
          relative flex items-center h-20 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
          pointer-events-auto
          ${isScrolled
            ? 'w-[92%] max-w-6xl rounded-full glass-surface px-4 sm:px-6'
            : 'w-full max-w-7xl px-4 sm:px-8 lg:px-12'
          }
        `}
      >
        {/* Desktop: single flex row. Logo is absolutely centered against
            the bar via left-1/2 + -translate-x-1/2 (direction-agnostic —
            translate-x uses physical X, identical in LTR and RTL). Groups
            are relative + z-10 so they layer above the absolute logo. */}
        <div className="hidden md:flex relative items-center w-full">

          {/* groupStart — RTL: right side · LTR: left side.
              4 nav links (menu/branches/catering/about) gives this side
              roughly the same intrinsic width as groupEnd (1 link +
              utilities + CTA), so the absolute logo at left-1/2 sits
              naturally centered without min-w padding tricks. */}
          <nav
            className="relative z-10 flex items-center gap-6"
            aria-label={t('menu')}
          >
            {GROUP_START.map(({ key, href }) => (
              <NavItem key={key} navKey={key} href={href} />
            ))}
          </nav>

          {/* Logo — absolutely centered against the bar */}
          <Link
            href="/"
            onClick={closeMenu}
            aria-label={isRTL ? 'الرئيسية' : 'Home'}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 shrink-0 flex items-center transition-transform hover:scale-105 active:scale-95"
          >
            <Image
              src="/assets/brand/logo-full.webp"
              alt={isRTL ? 'كهرمانة بغداد' : 'Kahramana Baghdad'}
              width={526}
              height={335}
              priority
              sizes="(max-width: 768px) 168px, 240px"
              className={`transition-all duration-500 ${isScrolled ? 'h-12 w-auto' : 'h-14 lg:h-16 w-auto'}`}
            />
          </Link>

          {/* groupEnd — anchored to inline-end via ms-auto. Nav links +
              utilities + CTA in a single flex row spaced by gap-4. */}
          <div className="relative z-10 flex items-center gap-4 ms-auto">
            {GROUP_END.map(({ key, href }) => (
              <NavItem key={key} navKey={key} href={href} />
            ))}

            {/* Language toggle */}
            <button
              onClick={handleLocaleSwitch}
              aria-label={t('languageAlt')}
              className="font-satoshi text-[12px] font-medium tracking-[0.12em] text-brand-muted hover:text-brand-gold/80 transition-colors duration-300 px-2 py-2"
            >
              {toggleLabel}
            </button>

            {/* Account — icon only in both states */}
            {!authLoaded ? (
              <div className="w-11 h-11" aria-hidden />
            ) : !customer ? (
              <Link
                href="/account"
                aria-label={tAccount('loginOrRegister')}
                className="flex items-center justify-center w-11 h-11 rounded-full border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 transition-colors duration-300"
              >
                <UserIcon />
              </Link>
            ) : (
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label={tAccount('title')}
                  className="flex items-center gap-2 ps-2 pe-3 h-11 rounded-full border border-brand-text/10 hover:border-brand-gold/50 hover:bg-brand-text/5 transition-colors duration-300"
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

            {/* Cart */}
            <button
              onClick={openCart}
              aria-label={t('cartAlt')}
              className="relative flex items-center justify-center w-11 h-11 rounded-full border border-brand-text/10 hover:border-brand-gold/50 hover:bg-brand-text/5 transition-colors duration-300"
            >
              <CartIcon />
              {totalItems > 0 && (
                <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] bg-brand-gold text-brand-black text-[10px] font-bold rounded-full flex items-center justify-center px-1 tabular-nums shadow-lg">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Reserve CTA — px-4 py-2 reads as a peer of the utilities
                rather than dominating the bar. */}
            <CinematicButton
              href="/reserve"
              isRTL={isRTL}
              aria-label={t('reserveTable')}
              className={`px-4 py-2 text-[13px] font-semibold rounded-full ${isRTL ? 'font-cairo' : 'font-satoshi tracking-[0.04em]'}`}
            >
              {t('reserveTable')}
            </CinematicButton>
          </div>
        </div>

        {/* Mobile: logo on inline-start, icons + hamburger on inline-end */}
        <div className="flex md:hidden items-center justify-between w-full">
          <Link
            href="/"
            onClick={closeMenu}
            aria-label={isRTL ? 'الرئيسية' : 'Home'}
            className="shrink-0 flex items-center"
          >
            <Image
              src="/assets/brand/logo-full.webp"
              alt={isRTL ? 'كهرمانة بغداد' : 'Kahramana Baghdad'}
              width={526}
              height={335}
              priority
              sizes="200px"
              // drop-shadow only at top state — glass capsule already gives the logo
              // a frame against the page; the shadow stops the wordmark from
              // dissolving into the dark hero photography behind the transparent bar.
              className={`h-14 w-auto max-w-[190px] transition-[filter] duration-500 ${
                isScrolled ? '' : 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]'
              }`}
            />
          </Link>

          <div className="flex items-center gap-2">
            {/* Account — icon only, links to /account in both states */}
            {authLoaded && (
              <Link
                href="/account"
                aria-label={customer ? tAccount('title') : tAccount('loginOrRegister')}
                className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-colors duration-300 ${
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
              aria-expanded={isOpen}
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

        {/* Mobile menu overlay — refined typography, reserve CTA moves inside */}
        {isOpen && (
            <div className="absolute top-full inset-x-0 mt-4 mx-4 p-6 glass-surface rounded-[2rem] md:hidden pointer-events-auto">
              <nav className="flex flex-col gap-3">
                {ALL_LINKS.map(({ key, href }) => (
                    <Link
                      key={key}
                      href={href}
                      onClick={closeMenu}
                      className={`
                        text-base font-medium py-2 border-b border-brand-text/5 last:border-0 text-start
                        ${linkTypography}
                        ${pathname === href ? 'text-brand-gold' : 'text-brand-text'}
                      `}
                    >
                    {t(key)}
                    </Link>
                ))}

                {/* Account row — login link or signed-in summary + sign-out */}
                {authLoaded && !customer && (
                  <Link
                    href="/account"
                    onClick={closeMenu}
                    className={`text-base font-medium py-2 border-b border-brand-text/5 text-start text-brand-gold ${linkTypography}`}
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
                      <span className="text-base font-bold text-brand-text">
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
                    className="font-satoshi text-sm font-medium tracking-[0.12em] text-brand-muted min-w-11 h-11 flex items-center justify-start"
                  >
                    {toggleLabel}
                  </button>
                  <CinematicButton
                    href="/reserve"
                    isRTL={isRTL}
                    aria-label={t('reserveTable')}
                    className={`px-6 py-3 rounded-full font-semibold ${isRTL ? 'font-cairo' : 'font-satoshi tracking-[0.04em]'}`}
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
