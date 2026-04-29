'use client'

import { TIER_COLORS } from '@/lib/design-tokens'
import type { LoyaltyTier } from '@/lib/supabase/types'

interface Props {
  tier: LoyaltyTier
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  locale?: string
}

const TIER_LABELS: Record<LoyaltyTier, { ar: string; en: string }> = {
  bronze:   { ar: 'برونزي',   en: 'Bronze'   },
  silver:   { ar: 'فضي',      en: 'Silver'   },
  gold:     { ar: 'ذهبي',     en: 'Gold'     },
  platinum: { ar: 'بلاتيني',  en: 'Platinum' },
}

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5 rounded-md',
  md: 'text-sm px-3 py-1 rounded-lg',
  lg: 'text-base px-4 py-1.5 rounded-xl font-bold',
}

export default function TierBadge({ tier, size = 'md', showLabel = true, locale = 'ar' }: Props) {
  const colors = TIER_COLORS[tier]
  const label  = TIER_LABELS[tier][locale === 'ar' ? 'ar' : 'en']
  const isAr   = locale === 'ar'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-satoshi font-bold
                  border transition-colors duration-150
                  ${SIZE_CLASSES[size]}
                  ${tier === 'platinum' ? 'animate-shimmer' : ''}`}
      style={{
        color:           colors.text,
        borderColor:     colors.border,
        backgroundColor: colors.bg,
      }}
    >
      <TierIcon tier={tier} size={size} color={colors.text} />
      {showLabel && <span className={isAr ? 'font-almarai' : 'font-satoshi'}>{label}</span>}
    </span>
  )
}

function TierIcon({ tier, size, color }: { tier: LoyaltyTier; size: 'sm' | 'md' | 'lg'; color: string }) {
  const px = size === 'sm' ? 12 : size === 'md' ? 14 : 18

  if (tier === 'platinum') {
    return (
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2L9.19 8.63L2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"
              fill={color} />
      </svg>
    )
  }
  if (tier === 'gold') {
    return (
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <path d="M12 7v5l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  if (tier === 'silver') {
    return (
      <svg width={px} height={px} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3L14.09 8.26L20 9.27L16 13.14L16.91 19L12 16.5L7.09 19L8 13.14L4 9.27L9.91 8.26L12 3z"
              stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      </svg>
    )
  }
  // bronze
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill={color} opacity="0.6" />
    </svg>
  )
}
