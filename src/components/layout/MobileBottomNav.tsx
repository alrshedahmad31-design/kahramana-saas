'use client'

import { usePathname } from '@/i18n/navigation'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { UtensilsCrossed, Star, Info, Phone } from 'lucide-react'

const NAV_ITEMS = [
  { key: 'menu',     icon: UtensilsCrossed, href: '/menu' },
  { key: 'catering', icon: Star,            href: '/catering' },
  { key: 'about',    icon: Info,            href: '/about' },
  { key: 'contact',  icon: Phone,           href: '/contact' },
] as const

const EXCLUDED_PATHS = ['/dashboard', '/driver', '/waiter', '/table/', '/login', '/set-password', '/forgot-password', '/register']

export default function MobileBottomNav() {
  const pathname = usePathname()
  const params = useParams()
  const locale = params?.locale as string || 'ar'

  // Exclusion logic
  const isExcluded = EXCLUDED_PATHS.some(p => pathname.includes(p))
  if (isExcluded) return null

  const isRTL = locale === 'ar'

  return (
    <div data-public-bottom-nav className="fixed bottom-0 left-0 right-0 z-[100] md:hidden flex flex-col items-center pointer-events-none pb-[calc(2rem+env(safe-area-inset-bottom,0px))] px-4">
      <nav 
        className="pointer-events-auto flex items-center gap-1 p-1 bg-brand-surface-2/90 backdrop-blur-md border border-brand-gold/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.6)] animate-mobile-nav"
        aria-label={isRTL ? 'التنقل الرئيسي للهاتف' : 'Mobile Main Navigation'}
      >
      {NAV_ITEMS.map(({ key, icon: Icon, href }) => {
        const isActive = pathname === href

        return (
          <Link
            key={key}
            href={href}
            className={`
              relative flex flex-col items-center justify-center w-11 h-11 rounded-full transition-all duration-300
              ${isActive ? 'text-brand-gold' : 'text-brand-muted hover:text-brand-text'}
              hover:scale-110 active:scale-95
            `}
            aria-label={getAriaLabel(key, locale)}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            
            {/* Active Indicator */}
            {isActive && (
              <span className="absolute bottom-1.5 w-1 h-1 bg-brand-gold rounded-full shadow-[0_0_8px_rgba(200,146,42,0.8)]" />
            )}
          </Link>
        )
      })}
    </nav>
  </div>
)
}

function getAriaLabel(key: string, locale: string): string {
  const isAr = locale === 'ar'
  switch (key) {
    case 'menu':     return isAr ? 'المنيو' : 'Menu'
    case 'catering': return isAr ? 'المناسبات' : 'Catering'
    case 'about':    return isAr ? 'من نحن' : 'About'
    case 'contact':  return isAr ? 'تواصل' : 'Contact'
    default:         return ''
  }
}
