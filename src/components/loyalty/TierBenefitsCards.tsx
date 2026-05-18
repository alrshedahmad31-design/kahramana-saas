'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Award, Check, Crown, Medal, Star } from 'lucide-react'
import { TIER_COLORS } from '@/lib/design-tokens'
import { TIER_BENEFITS, type LoyaltyTier } from '@/lib/loyalty/calculations'

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

export default function TierBenefitsCards({ currentTier }: Props) {
  const t      = useTranslations('account')
  const locale = useLocale()
  const isAr   = locale === 'ar'

  return (
    <section>
      <h2
        className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}
      >
        {t('tierBenefits')}
      </h2>

      <ul className="grid grid-cols-2 gap-3 sm:gap-4">
        {TIER_ORDER.map((tier) => {
          const Icon      = TIER_ICONS[tier]
          const colors    = TIER_COLORS[tier]
          const isCurrent = tier === currentTier
          const benefits  = TIER_BENEFITS[tier][isAr ? 'ar' : 'en']
          const tierLabel = t(`tierName.${tier}`)

          return (
            <li
              key={tier}
              className="rounded-2xl border p-4 sm:p-5"
              style={{
                borderColor:     isCurrent ? colors.border : 'rgb(168 169 173 / 0.2)',
                backgroundColor: isCurrent ? colors.bg : 'transparent',
                borderWidth:     isCurrent ? 2 : 1,
              }}
            >
              <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full shrink-0"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                    aria-hidden="true"
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </span>
                  <span
                    className={`font-bold text-base
                      ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                    style={{ color: colors.text }}
                  >
                    {tierLabel}
                  </span>
                </div>

                {isCurrent && (
                  <span
                    className={`self-start sm:self-auto text-[10px] font-bold uppercase tracking-wide rounded-md px-2 py-0.5
                      ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                    style={{
                      color:           colors.text,
                      borderColor:     colors.border,
                      borderWidth:     1,
                      backgroundColor: 'transparent',
                    }}
                  >
                    {t('currentLevel')}
                  </span>
                )}
              </header>

              <ul className="flex flex-col gap-2">
                {benefits.map((b) => (
                  <li
                    key={b}
                    className={`flex items-start gap-2 text-xs text-brand-text/90
                      ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                  >
                    <Check
                      size={14}
                      strokeWidth={2.5}
                      className="mt-0.5 shrink-0"
                      style={{ color: colors.text }}
                      aria-hidden="true"
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

