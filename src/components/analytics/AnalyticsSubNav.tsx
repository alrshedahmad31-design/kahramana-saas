'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface Props {
  locale: string
}

const TABS = [
  { key: 'overview',    labelEn: 'Overview',    labelAr: 'نظرة عامة' },
  { key: 'customers',   labelEn: 'Customers',   labelAr: 'العملاء'   },
  { key: 'menu',        labelEn: 'Menu',        labelAr: 'القائمة'   },
  { key: 'financial',   labelEn: 'Financial',   labelAr: 'المالية'   },
  { key: 'operations',  labelEn: 'Operations',  labelAr: 'العمليات'  },
  { key: 'marketing',   labelEn: 'Marketing',   labelAr: 'التسويق'   },
]

export default function AnalyticsSubNav({ locale }: Props) {
  const pathname = usePathname()
  const prefix   = locale === 'en' ? '/en' : ''
  const isAr     = locale === 'ar'

  return (
    <div className="flex gap-0 overflow-x-auto border-b border-brand-border">
      {TABS.map((tab) => {
        const href     = tab.key === 'overview'
          ? `${prefix}/dashboard/analytics`
          : `${prefix}/dashboard/analytics/${tab.key}`
        const isActive = tab.key === 'overview'
          ? pathname === href
          : pathname === href || pathname.startsWith(href + '/')

        return (
          <Link
            key={tab.key}
            href={href}
            className={`px-4 py-2.5 text-sm font-satoshi font-medium whitespace-nowrap
                        border-b-2 -mb-px transition-colors duration-150
                        ${isActive
                          ? 'border-brand-gold text-brand-gold'
                          : 'border-transparent text-brand-muted hover:text-brand-text hover:border-brand-border'
                        }`}
          >
            {isAr ? tab.labelAr : tab.labelEn}
          </Link>
        )
      })}
    </div>
  )
}
