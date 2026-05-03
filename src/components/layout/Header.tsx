'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { DEFAULT_BRANCH } from '@/constants/contact'
import { useCartStore, selectTotalItems } from '@/lib/cart'
import { motion, AnimatePresence } from 'framer-motion'
import CinematicButton from '@/components/ui/CinematicButton'

// ── Nav Links ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { key: 'menu',     href: '/menu'     as const },
  { key: 'branches', href: '/branches' as const },
  { key: 'catering', href: '/catering' as const },
  { key: 'about',    href: '/about'    as const },
  { key: 'contact',  href: '/contact'  as const },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function Header() {
  const t        = useTranslations('nav')
  const locale   = useLocale()
  const pathname = usePathname()
  const router   = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

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

  function handleLocaleSwitch() {
    router.replace(pathname, { locale: targetLocale })
  }

  function closeMenu() {
    setIsOpen(false)
  }

  // Hide header on dashboard and driver routes
  if (pathname.includes('/dashboard') || pathname.includes('/driver')) return null

  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none pt-4 sm:pt-6">
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
              src="/assets/logo.svg"
              alt={isRTL ? 'كهرمانة بغداد' : 'Kahramana Baghdad'}
              width={120}
              height={36}
              className={`transition-all duration-500 ${isScrolled ? 'h-7 w-auto' : 'h-9 w-auto'}`}
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
                    : 'text-brand-muted hover:text-brand-text hover:bg-white/5'
                  }
                `}
              >
                {t(key as 'menu' | 'branches' | 'about' | 'contact')}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleLocaleSwitch}
              aria-label={t('languageAlt')}
              className="px-4 py-2 rounded-full text-sm font-bold text-brand-muted hover:text-brand-text hover:bg-white/5 transition-all"
            >
              {t('language')}
            </button>

            <button
              onClick={openCart}
              aria-label={t('cartAlt')}
              className="relative flex items-center justify-center w-10 h-10 rounded-full border border-white/10 hover:border-brand-gold/50 hover:bg-white/5 transition-all"
            >
              <CartIcon />
              {totalItems > 0 && (
                <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] bg-brand-gold text-brand-black text-[10px] font-bold rounded-full flex items-center justify-center px-1 tabular-nums shadow-lg">
                  {totalItems}
                </span>
              )}
            </button>

            <CinematicButton
              href={DEFAULT_BRANCH.waLink}
              isRTL={isRTL}
              aria-label={t('orderNow')}
              className="px-5 py-2 text-sm font-bold rounded-full"
            >
              {t('orderNow')}
            </CinematicButton>
          </div>

          {/* Mobile Actions */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={openCart}
              aria-label={t('cartAlt')}
              className="relative flex items-center justify-center w-10 h-10 rounded-full border border-white/10"
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
              className="w-10 h-10 flex flex-col justify-center items-center gap-1.5"
            >
              <motion.span 
                animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                className="w-5 h-0.5 bg-brand-text block rounded-full"
              />
              <motion.span 
                animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
                className="w-5 h-0.5 bg-brand-text block rounded-full"
              />
              <motion.span 
                animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
                className="w-5 h-0.5 bg-brand-text block rounded-full"
              />
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute top-full inset-x-0 mt-4 mx-4 p-6 glass-surface rounded-[2rem] md:hidden pointer-events-auto"
            >
              <nav className="flex flex-col gap-4">
                {NAV_LINKS.map(({ key, href }) => (
                    <Link
                      key={key}
                      href={href}
                      onClick={closeMenu}
                      className={`
                        text-lg font-bold py-2 border-b border-white/5 last:border-0 text-start
                        ${isRTL ? 'font-cairo' : 'font-satoshi'}
                        ${pathname === href ? 'text-brand-gold' : 'text-brand-text'}
                      `}
                    >
                    {t(key as 'menu' | 'branches' | 'about' | 'contact')}
                  </Link>
                ))}
                
                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={handleLocaleSwitch}
                    aria-label={t('languageAlt')}
                    className="text-brand-muted font-bold"
                  >
                    {t('language')}
                  </button>
                  <CinematicButton
                    href={DEFAULT_BRANCH.waLink}
                    isRTL={isRTL}
                    aria-label={t('orderNow')}
                    className="px-6 py-3 rounded-full font-bold"
                  >
                    {t('orderNow')}
                  </CinematicButton>
                </div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
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
