'use client'

import { MIN_REDEMPTION, pointsToCredit } from '@/lib/loyalty/calculations'
import { formatPrice } from '@/lib/format'

interface LoyaltyRedemptionWidgetProps {
  pointsBalance: number
  isActive: boolean
  onToggle: (active: boolean) => void
  locale: string
  t: (key: string, values?: Record<string, string | number>) => string
}

export function LoyaltyRedemptionWidget({
  pointsBalance,
  isActive,
  onToggle,
  locale,
  t,
}: LoyaltyRedemptionWidgetProps) {
  const creditBhd = pointsToCredit(pointsBalance)
  const canRedeem  = pointsBalance >= MIN_REDEMPTION

  if (!canRedeem) {
    const needed = MIN_REDEMPTION - pointsBalance
    return (
      <div className="flex items-center gap-3 rounded-xl border border-brand-border bg-brand-surface-2 p-4 opacity-60">
        <span className="flex-shrink-0 text-xl">✦</span>
        <p className="text-sm text-brand-muted">
          {t('checkout.loyalty.needMore', { count: needed })}
        </p>
      </div>
    )
  }

  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl border transition-all duration-300',
        isActive
          ? 'border-brand-gold/60 bg-brand-gold/5 shadow-[0_0_0_1px_var(--color-brand-gold,#c8a96a)_inset]'
          : 'border-brand-border bg-brand-surface-2',
      ].join(' ')}
    >
      {/* shimmer line when active */}
      {isActive && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold to-transparent" />
      )}

      <div className="flex items-center justify-between gap-4 p-4">
        {/* Left: icon + info */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={[
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base transition-colors duration-300',
              isActive
                ? 'bg-brand-gold/15 text-brand-gold'
                : 'bg-brand-surface-3 text-brand-muted',
            ].join(' ')}
            aria-hidden="true"
          >
            ✦
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-text">
              {t('checkout.loyalty.balance', {
                count: pointsBalance.toLocaleString(locale === 'ar' ? 'ar-BH' : 'en-BH'),
              })}
            </p>
            <p
              className={[
                'mt-0.5 text-xs transition-colors duration-300',
                isActive ? 'text-brand-gold' : 'text-brand-muted',
              ].join(' ')}
            >
              {t('checkout.loyalty.equivalent', { amount: formatPrice(creditBhd, locale) })}
            </p>
          </div>
        </div>

        {/* Right: toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          aria-label={t('checkout.loyalty.toggle')}
          onClick={() => onToggle(!isActive)}
          dir="ltr"
          className={[
            'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2',
            isActive ? 'bg-brand-gold' : 'bg-brand-surface-3',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm',
              'transition-transform duration-300',
              isActive ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Saving row — appears when active */}
      {isActive && (
        <div className="border-t border-brand-gold/20 px-4 py-3">
          <p className="text-xs font-medium text-brand-gold">
            {t('checkout.loyalty.saving', { amount: formatPrice(creditBhd, locale) })}
          </p>
        </div>
      )}
    </div>
  )
}
