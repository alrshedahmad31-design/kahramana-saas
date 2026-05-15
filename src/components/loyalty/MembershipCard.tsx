'use client'

import { useLocale, useTranslations } from 'next-intl'
import TierBadge from '@/components/loyalty/TierBadge'
import { formatMemberId } from '@/lib/member-id'
import type { LoyaltyTier } from '@/lib/loyalty/calculations'

interface Props {
  userId:      string
  name:        string | null
  tier:        LoyaltyTier
  joinedAt:    string
}

export default function MembershipCard({ userId, name, tier, joinedAt }: Props) {
  const t      = useTranslations('account')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const memberId = formatMemberId(userId)
  const joined   = new Date(joinedAt).toLocaleDateString(
    isAr ? 'ar-BH' : 'en-BH',
    { month: 'long', year: 'numeric' },
  )

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-brand-gold/20 bg-brand-black p-6
                 min-h-[140px]"
    >
      {/* subtle gold gradient glow on the border edges */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(200,169,81,0.10) 0%, rgba(200,169,81,0) 40%, rgba(200,169,81,0) 60%, rgba(200,169,81,0.08) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Right side on LTR / Left side on RTL — name + meta */}
        <div className="flex flex-col gap-1 order-1 sm:order-2 sm:text-end">
          <h1
            className={`text-2xl font-black text-brand-gold leading-tight
              ${isAr ? 'font-cairo' : 'font-editorial'}`}
          >
            {name ?? t('kahramanaMember')}
          </h1>
          <p
            className={`text-xs text-brand-muted/80 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {t('memberSince')} · {joined}
          </p>
          <p
            className={`text-[10px] uppercase tracking-[0.2em] text-brand-gold/60
              ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {t('kahramanaMember')}
          </p>
        </div>

        {/* Left side on LTR / Right side on RTL — tier badge + member id */}
        <div className="flex flex-col gap-2 items-start order-2 sm:order-1">
          <TierBadge tier={tier} size="lg" locale={locale} />
          <p
            className={`text-[10px] uppercase tracking-wide text-brand-muted/70
              ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {t('memberId')}
          </p>
          <p className="font-mono text-sm font-bold text-brand-text tabular-nums">
            {memberId}
          </p>
        </div>
      </div>
    </div>
  )
}
