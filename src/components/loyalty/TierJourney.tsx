'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Award, Crown, Medal, Star } from 'lucide-react'
import { TIER_COLORS } from '@/lib/design-tokens'
import { TIER_THRESHOLDS_LEGACY, type LoyaltyTier } from '@/lib/loyalty/calculations'

interface Props {
  currentTier: LoyaltyTier
}

const TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum']

const TIER_ICONS = {
  bronze:   Medal,
  silver:   Star,
  gold:     Award,
  platinum: Crown,
} as const

export default function TierJourney({ currentTier }: Props) {
  const t      = useTranslations('account')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const currentIdx = TIER_ORDER.indexOf(currentTier)

  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
      <h2
        className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-6
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}
      >
        {t('tierBenefits')}
      </h2>

      <div className="relative">
        {/* connector line */}
        <div
          className="absolute top-5 h-px bg-brand-gold/30"
          style={{ insetInlineStart: '12.5%', insetInlineEnd: '12.5%' }}
          aria-hidden="true"
        />

        <ol className="relative grid grid-cols-4 gap-2">
          {TIER_ORDER.map((tier, idx) => {
            const Icon       = TIER_ICONS[tier]
            const colors     = TIER_COLORS[tier]
            const isCurrent  = idx === currentIdx
            const isPast     = idx < currentIdx
            const isFuture   = idx > currentIdx
            const tierLabel  = t(`tierName.${tier}`)
            const threshold  = TIER_THRESHOLDS_LEGACY[tier].minOrders

            return (
              <li key={tier} className="flex flex-col items-center text-center gap-2">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors"
                  style={{
                    backgroundColor: isCurrent || isPast ? colors.bg : 'transparent',
                    borderColor:     isFuture ? 'rgb(168 169 173 / 0.3)' : colors.border,
                    color:           isFuture ? 'rgb(168 169 173 / 0.5)' : colors.text,
                    opacity:         isPast ? 0.6 : 1,
                  }}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <Icon size={18} strokeWidth={2.2} />
                </span>

                <span
                  className={`text-xs font-bold truncate max-w-full
                    ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                  style={{ color: isFuture ? undefined : colors.text }}
                >
                  {tierLabel}
                </span>

                <span className="font-satoshi text-[10px] text-brand-muted tabular-nums">
                  {threshold === 0
                    ? (isAr ? 'البداية' : 'Start')
                    : `${threshold}+ ${isAr ? 'طلب' : 'orders'}`}
                </span>

                {isCurrent && (
                  <span
                    className={`mt-1 text-[10px] font-bold uppercase tracking-wide
                      ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                    style={{ color: colors.text }}
                  >
                    {t('youAreHere')}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
