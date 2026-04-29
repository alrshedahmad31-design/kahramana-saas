'use client'

import { useState } from 'react'

interface Tab { key: string; labelEn: string; labelAr: string }

const TABS: Tab[] = [
  { key: 'overview',    labelEn: 'Overview',      labelAr: 'نظرة عامة' },
  { key: 'schedule',    labelEn: 'Schedule',      labelAr: 'الجدول' },
  { key: 'performance', labelEn: 'Performance',   labelAr: 'الأداء' },
  { key: 'leave',       labelEn: 'Leave',         labelAr: 'الإجازات' },
]

interface Props {
  isRTL:    boolean
  children: (activeTab: string) => React.ReactNode
}

export default function StaffProfileTabs({ isRTL, children }: Props) {
  const [active, setActive] = useState('overview')

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar */}
      <div className="flex border-b border-brand-border overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`
              shrink-0 px-5 py-3 font-satoshi text-sm font-medium
              border-b-2 transition-colors duration-150 whitespace-nowrap
              ${active === tab.key
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-brand-muted hover:text-brand-text'
              }
              ${isRTL ? 'font-almarai' : ''}
            `}
          >
            {isRTL ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pt-6">
        {children(active)}
      </div>
    </div>
  )
}
