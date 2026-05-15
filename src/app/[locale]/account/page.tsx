import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { createClient } from '@/lib/supabase/server'
import PointsHistory from '@/components/loyalty/PointsHistory'
import MembershipCard from '@/components/loyalty/MembershipCard'
import TierJourney from '@/components/loyalty/TierJourney'
import TierBenefitsCards from '@/components/loyalty/TierBenefitsCards'
import ProfileEditForm from './ProfileEditForm'
import {
  formatPoints,
  MIN_REDEMPTION,
  POINT_VALUE_BHD,
  pointsToCredit,
  tierProgressToNext,
  getNextTier,
  TIER_THRESHOLDS_LEGACY as TIER_THRESHOLDS,
<<<<<<< Updated upstream
  POINT_VALUE_BHD,
=======
>>>>>>> Stashed changes
} from '@/lib/loyalty/calculations'
import { TIER_COLORS } from '@/lib/design-tokens'
import type { PointsTransactionRow } from '@/lib/supabase/custom-types'

interface Props {
  params: Promise<{ locale: string }>
}

const TIER_LABELS = {
  ar: {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
  },
  en: {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
  },
} as const

function formatBhd(value: number): string {
  return `BD ${value.toFixed(3)}`
}

function formatMemberId(id: string): string {
  return `KHM-${id.slice(0, 8).toUpperCase()}`
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

  const progress  = tierProgressToNext(customer.total_orders, customer.total_spent_bhd, customer.loyalty_tier)
  const nextTier  = getNextTier(customer.loyalty_tier)
  const tierColor = TIER_COLORS[customer.loyalty_tier]
  const bhdValue  = pointsToCredit(customer.points_balance)
  const rewardUnlocked = customer.points_balance >= MIN_REDEMPTION
  const pointValueLabel = formatBhd(pointsToCredit(Math.round(1 / POINT_VALUE_BHD)))
  const memberId = formatMemberId(customer.id)
  const nextTierLabel = nextTier ? TIER_LABELS[isAr ? 'ar' : 'en'][nextTier] : null
  const remainingOrders = nextTier
    ? Math.max(TIER_THRESHOLDS[nextTier].minOrders - customer.total_orders, 0)
    : 0
  const remainingSpend = nextTier
    ? Math.max(TIER_THRESHOLDS[nextTier].minSpent - Number(customer.total_spent_bhd), 0)
    : 0
  const benefitCards = [
    { value: '10', label: t('loyaltyDashboard.benefitPoints') },
    { value: '12', label: t('loyaltyDashboard.benefitExpiry') },
    { value: '%', label: t('loyaltyDashboard.benefitOffers') },
  ]

  const nextTierLabel = nextTier ? t(`tierName.${nextTier}`) : null
  const ordersRemaining = nextTier
    ? Math.max(TIER_THRESHOLDS[nextTier].minOrders - customer.total_orders, 0)
    : 0

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-brand-black px-4 py-8 sm:py-12"
    >
<<<<<<< Updated upstream
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
=======
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">

        {/* Premium membership card */}
        <div
          className="relative overflow-hidden rounded-[2rem] border p-5 sm:p-7"
          style={{ borderColor: tierColor.border, backgroundColor: tierColor.bg }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-brand-gold/60" aria-hidden="true" />
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem] lg:items-stretch">
            <div className="flex min-w-0 flex-col justify-between gap-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={`mb-2 text-xs font-bold uppercase tracking-[0.28em] text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('loyaltyDashboard.membership')}
                  </p>
                  <h1 className={`text-3xl font-black leading-tight text-brand-text sm:text-4xl ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                    {customer.name ?? t('title')}
                  </h1>
                  <p className="mt-2 font-satoshi text-sm text-brand-muted">
                    {customer.phone}
                  </p>
                </div>
                <TierBadge tier={customer.loyalty_tier} size="lg" locale={locale} />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-brand-border bg-brand-black/45 p-4">
                  <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('loyaltyDashboard.tier')}
                  </p>
                  <p className="mt-2 font-satoshi text-lg font-black text-brand-text">
                    {TIER_LABELS[isAr ? 'ar' : 'en'][customer.loyalty_tier]}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-brand-black/45 p-4">
                  <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {tL('pointsBalance')}
                  </p>
                  <p className="mt-2 font-satoshi text-lg font-black text-brand-text tabular-nums">
                    {formatPoints(customer.points_balance)}
                  </p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-brand-black/45 p-4">
                  <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('loyaltyDashboard.rewardValue')}
                  </p>
                  <p className="mt-2 font-satoshi text-lg font-black text-brand-text tabular-nums">
                    {formatBhd(bhdValue)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-brand-border bg-brand-black/55 p-5">
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.22em] text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('loyaltyDashboard.memberId')}
                </p>
                <p className="mt-3 break-all font-satoshi text-xl font-black text-brand-text tabular-nums">
                  {memberId}
                </p>
              </div>
              <div className="mt-6 grid grid-cols-5 gap-1" aria-hidden="true">
                {Array.from({ length: 25 }).map((_, index) => (
                  <span
                    key={index}
                    className={`aspect-square rounded-[3px] ${index % 3 === 0 || index % 7 === 0 ? 'bg-brand-gold' : 'bg-brand-surface-2'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <section className="rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-6" aria-labelledby="points-balance-heading">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="points-balance-heading" className={`text-sm font-bold uppercase tracking-[0.24em] text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {tL('pointsBalance')}
                </h2>
                <div className="mt-5 flex items-end gap-3">
                  <span className="font-satoshi text-6xl font-black leading-none tabular-nums text-brand-text">
                    {formatPoints(customer.points_balance)}
                  </span>
                  <span className={`pb-2 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {tL('points')}
                  </span>
                </div>
              </div>
              <a
                href={isAr ? '/menu' : '/en/menu'}
                aria-label={customer.points_balance > 0 ? t('loyaltyDashboard.browseMenu') : t('loyaltyDashboard.startEarning')}
                className={`inline-flex min-h-11 items-center justify-center rounded-full bg-brand-gold px-5 py-3 text-sm font-bold text-brand-black transition-colors hover:bg-brand-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                {customer.points_balance > 0 ? t('loyaltyDashboard.browseMenu') : t('loyaltyDashboard.startEarning')}
              </a>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-brand-surface-2 p-4">
                <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('loyaltyDashboard.pointsValueRule', { points: Math.round(1 / POINT_VALUE_BHD), value: pointValueLabel })}
                </p>
                <p className="mt-2 font-satoshi text-2xl font-black text-brand-text tabular-nums">
                  {formatBhd(bhdValue)}
                </p>
              </div>
              <div className="rounded-2xl bg-brand-surface-2 p-4">
                <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {tL('expiryNote')}
                </p>
                <p className="mt-2 font-satoshi text-2xl font-black text-brand-text tabular-nums">
                  {t('loyaltyDashboard.months', { count: 12 })}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-6" aria-labelledby="available-rewards-heading">
            <h2 id="available-rewards-heading" className={`text-sm font-bold uppercase tracking-[0.24em] text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('loyaltyDashboard.availableRewards')}
            </h2>
            {rewardUnlocked ? (
              <div className="mt-5 rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-5">
                <p className={`text-sm font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('loyaltyDashboard.rewardReadyTitle')}
                </p>
                <p className={`mt-2 text-sm leading-6 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('loyaltyDashboard.rewardReadyCopy', { value: formatBhd(bhdValue) })}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-brand-border bg-brand-surface-2 p-5">
                <p className={`text-sm font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('loyaltyDashboard.noRewardsTitle')}
                </p>
                <p className={`mt-2 text-sm leading-6 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('loyaltyDashboard.noRewardsCopy', { points: Math.max(MIN_REDEMPTION - customer.points_balance, 0) })}
                </p>
                <a
                  href={isAr ? '/menu' : '/en/menu'}
                  aria-label={t('loyaltyDashboard.browseMenu')}
                  className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-brand-gold px-5 py-3 text-sm font-bold text-brand-gold transition-colors hover:bg-brand-gold hover:text-brand-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                >
                  {t('loyaltyDashboard.browseMenu')}
                </a>
              </div>
            )}
          </section>
        </div>

        {progress && nextTier && nextTierLabel && (
          <section className="rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-6" aria-labelledby="tier-progress-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="tier-progress-heading" className={`text-sm font-bold uppercase tracking-[0.24em] text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {tL('progressToNextTier', { tier: nextTierLabel })}
                </h2>
                <p className={`mt-2 text-sm leading-6 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('loyaltyDashboard.remainingToNext', {
                    orders: remainingOrders,
                    spend: formatBhd(remainingSpend),
                    tier: nextTierLabel,
                  })}
                </p>
              </div>
              <p className="font-satoshi text-sm font-bold text-brand-text tabular-nums">
                {Math.max(Math.round(Math.max(progress.byOrders, progress.bySpend) * 100), 0)}%
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:           `${Math.round(progress.byOrders * 100)}%`,
                      backgroundColor: tierColor.text,
                    }}
=======
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.round(progress.byOrders * 100)}%`, backgroundColor: tierColor.text }}
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:           `${Math.round(progress.bySpend * 100)}%`,
                      backgroundColor: tierColor.text,
                    }}
=======
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.round(progress.bySpend * 100)}%`, backgroundColor: tierColor.text }}
>>>>>>> Stashed changes
                  />
                </div>
              </div>
            </div>
<<<<<<< Updated upstream

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
          }}
        />

        {/* ── S7 — Points history ──────────────────────────────────────── */}
        <div>
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
=======
          </section>
        )}

        <section className="rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-6" aria-labelledby="membership-benefits-heading">
          <h2 id="membership-benefits-heading" className={`text-sm font-bold uppercase tracking-[0.24em] text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {tL('benefits')}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {benefitCards.map((benefit) => (
              <div key={benefit.label} className="rounded-2xl border border-brand-border bg-brand-surface-2 p-4">
                <p className="font-satoshi text-3xl font-black text-brand-text tabular-nums">
                  {benefit.value}
                </p>
                <p className={`mt-2 text-sm leading-6 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {benefit.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-6" aria-labelledby="my-info-heading">
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-brand-border pb-4">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.24em] text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('loyaltyDashboard.myDataTab')}
              </p>
              <h2 id="my-info-heading" className={`mt-2 text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                {t('myInfo.heading')}
              </h2>
            </div>
            <p className="hidden font-satoshi text-xs text-brand-muted tabular-nums sm:block">
              {memberId}
            </p>
          </div>
          <ProfileEditForm
            initial={{
              name:             customer.name,
              phone:            customer.phone,
              default_block:    customer.default_block,
              default_road:     customer.default_road,
              default_building: customer.default_building,
              default_flat:     customer.default_flat,
              default_area:     customer.default_area,
            }}
          />
        </section>

        <section aria-labelledby="points-history-heading">
          <h2 id="points-history-heading" className={`mb-4 text-sm font-bold uppercase tracking-[0.24em] text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
>>>>>>> Stashed changes
            {t('pointsHistory')}
          </h2>
          <PointsHistory transactions={transactions} />
        </section>

      </div>
    </div>
  )
}
