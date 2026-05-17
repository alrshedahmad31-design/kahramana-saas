import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { createClient } from '@/lib/supabase/server'
import PointsHistory from '@/components/loyalty/PointsHistory'
import OrderHistorySection from '@/components/orders/OrderHistorySection'
import MembershipCard from '@/components/loyalty/MembershipCard'
import TierJourney from '@/components/loyalty/TierJourney'
import TierBenefitsCards from '@/components/loyalty/TierBenefitsCards'
import BirthdayGiftCard from '@/components/loyalty/BirthdayGiftCard'
import { getLoyaltyConfig } from '@/lib/loyalty/config.server'
import ProfileEditForm from './ProfileEditForm'
import {
  formatPoints,
  POINT_VALUE_BHD,
  pointsToCredit,
  tierProgressToNext,
  getNextTier,
  TIER_THRESHOLDS_LEGACY as TIER_THRESHOLDS,
} from '@/lib/loyalty/calculations'
import { TIER_COLORS } from '@/lib/design-tokens'
import type { PointsTransactionRow } from '@/lib/supabase/custom-types'

// Per-user account dashboard — never statically rendered or cached. Pinned so
// a future refactor that hoists the session call into a layout can't downgrade
// this page to ISR.
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

function formatBhd(value: number): string {
  return `BD ${value.toFixed(3)}`
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'account' })
  return { title: t('title'), robots: { index: false } }
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params
  const isAr   = locale === 'ar'
  const t      = await getTranslations({ locale, namespace: 'account' })
  const tL     = await getTranslations({ locale, namespace: 'loyalty' })

  const customer = await getCustomerSession()

  // Not logged in — show CTA to create account
  if (!customer) {
    return (
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="min-h-screen bg-brand-black flex flex-col items-center justify-center gap-6 px-4"
      >
        <h1 className={`text-3xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {t('title')}
        </h1>
        <p className={`text-brand-muted text-center max-w-xs ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('createAccountHint')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <a
            href={isAr ? '/account/login' : '/en/account/login'}
            aria-label={t('login')}
            className="flex-1 bg-brand-gold text-brand-black font-satoshi font-bold text-sm
                       px-6 py-3 rounded-xl text-center hover:bg-brand-gold-light transition-colors"
          >
            {t('login')}
          </a>
          <a
            href={isAr ? '/account/register' : '/en/account/register'}
            aria-label={t('register')}
            className="flex-1 bg-brand-surface-2 border border-brand-border text-brand-text font-satoshi
                       font-bold text-sm px-6 py-3 rounded-xl text-center hover:border-brand-gold/50
                       transition-colors"
          >
            {t('register')}
          </a>
        </div>
      </div>
    )
  }

  // Fetch transaction history
  const supabase = await createClient()
  const { data: txRaw } = await supabase
    .from('points_transactions')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const transactions = (txRaw ?? []) as PointsTransactionRow[]

  // Compute total saved from all redemption transactions (separate aggregate fetch
  // because the history above is capped at 100 rows)
  let totalSavedBhd = 0
  try {
    const { data: redemptionsRaw } = await supabase
      .from('points_transactions')
      .select('points_spent')
      .eq('customer_id', customer.id)
      .eq('transaction_type', 'redeemed')

    const totalPointsSpent = (redemptionsRaw ?? []).reduce(
      (sum, r) => sum + Number(r.points_spent ?? 0),
      0,
    )
    totalSavedBhd = totalPointsSpent * POINT_VALUE_BHD
  } catch {
    totalSavedBhd = 0
  }

  const loyaltyConfig = await getLoyaltyConfig()

  const progress  = tierProgressToNext(customer.total_orders, customer.total_spent_bhd, customer.loyalty_tier)
  const nextTier  = getNextTier(customer.loyalty_tier)
  const tierColor = TIER_COLORS[customer.loyalty_tier]
  const bhdValue  = pointsToCredit(customer.points_balance)
  const nextTierLabel = nextTier ? t(`tierName.${nextTier}`) : null
  const ordersRemaining = nextTier
    ? Math.max(TIER_THRESHOLDS[nextTier].minOrders - customer.total_orders, 0)
    : 0

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-brand-black px-4 py-8 sm:py-12"
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        {/* ── S1 — Membership card ─────────────────────────────────────── */}
        <MembershipCard
          userId={customer.id}
          name={customer.name}
          tier={customer.loyalty_tier}
          joinedAt={customer.joined_at}
        />

        {/* ── S2 — Points balance + Total saved ────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Points balance */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
            <p
              className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-3
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {t('pointsBalance')}
            </p>
            <div className="flex items-end gap-2 mb-1">
              <span
                className="font-satoshi font-black text-4xl tabular-nums leading-none"
                style={{ color: tierColor.text }}
              >
                {formatPoints(customer.points_balance)}
              </span>
              <span
                className={`text-brand-muted text-sm mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                {tL('points')}
              </span>
            </div>
            <p className="font-satoshi text-xs text-brand-muted">
              ≈ {bhdValue.toFixed(3)} BD {isAr ? 'قابلة للاسترداد' : 'redeemable'}
            </p>
          </div>

          {/* Total saved */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
            <p
              className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-3
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {t('totalSaved')}
            </p>
            <div className="flex items-end gap-2 mb-1">
              <span
                className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                {t('youSaved')}
              </span>
              <span
                className="font-satoshi font-black text-4xl tabular-nums leading-none text-brand-gold"
              >
                {totalSavedBhd.toFixed(3)}
              </span>
              <span
                className={`text-brand-muted text-sm mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                BD
              </span>
            </div>
            <p className="font-satoshi text-xs text-brand-muted">
              {tL('expiryNote')}
            </p>
          </div>
        </div>

        {/* ── S3 — Tier journey + progress ─────────────────────────────── */}
        <TierJourney currentTier={customer.loyalty_tier} />

        {progress && nextTier && nextTierLabel && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
            <h2
              className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {tL('progressToNextTier', { tier: nextTierLabel })}
            </h2>

            <div className="flex flex-col gap-3">
              {/* Progress by orders */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={`text-sm font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('loyaltyDashboard.ordersProgress', {
                      current: customer.total_orders,
                      target: TIER_THRESHOLDS[nextTier].minOrders,
                    })}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-brand-surface-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:           `${Math.round(progress.byOrders * 100)}%`,
                      backgroundColor: tierColor.text,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={`text-sm font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('loyaltyDashboard.spendProgress', {
                      current: formatBhd(Number(customer.total_spent_bhd)),
                      target: formatBhd(TIER_THRESHOLDS[nextTier].minSpent),
                    })}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-brand-surface-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:           `${Math.round(progress.bySpend * 100)}%`,
                      backgroundColor: tierColor.text,
                    }}
                  />
                </div>
              </div>
            </div>

            <p className={`text-xs text-brand-gold mt-3 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {ordersRemaining === 1
                ? t('oneOrderToNext', { tier: nextTierLabel })
                : t('ordersToNext',   { n: ordersRemaining, tier: nextTierLabel })}
            </p>
          </div>
        )}

        {!nextTier && (
          <p
            className={`text-center text-sm text-brand-gold font-bold
              ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {t('topTier')}
          </p>
        )}

        {/* ── S4 — Redemption widget (skipped — see report)
            LoyaltyRedemptionWidget is a checkout-only control that requires
            isActive + onToggle props tied to an active order. Not applicable
            on the account page; redemption happens at checkout. */}

        {/* ── S5 — Tier benefits cards ─────────────────────────────────── */}
        <TierBenefitsCards currentTier={customer.loyalty_tier} />

        {/* ── S5b — Birthday gift countdown ────────────────────────────── */}
        <BirthdayGiftCard
          birthday={customer.birthday}
          bonusPoints={loyaltyConfig.birthdayBonusPoints}
        />

        {/* ── S6 — My Info ─────────────────────────────────────────────── */}
        <ProfileEditForm
          initial={{
            name:             customer.name,
            phone:            customer.phone,
            default_block:    customer.default_block,
            default_road:     customer.default_road,
            default_building: customer.default_building,
            default_flat:     customer.default_flat,
            default_area:     customer.default_area,
            birthday:         customer.birthday,
          }}
        />

        {/* ── S6b — Order history (last 5 orders + reorder CTA) ────────── */}
        <OrderHistorySection customerId={customer.id} locale={locale} />

        {/* ── S7 — Points history ──────────────────────────────────────── */}
        <section aria-labelledby="points-history-heading">
          <h2 id="points-history-heading" className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('pointsHistory')}
          </h2>
          <PointsHistory transactions={transactions} />
        </section>

      </div>
    </div>
  )
}
