import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { createClient } from '@/lib/supabase/server'
import TierBadge from '@/components/loyalty/TierBadge'
import PointsHistory from '@/components/loyalty/PointsHistory'
import {
  formatPoints,
  pointsToCredit,
  tierProgressToNext,
  getNextTier,
  TIER_THRESHOLDS,
  TIER_BENEFITS,
} from '@/lib/loyalty/calculations'
import { TIER_COLORS } from '@/lib/design-tokens'
import type { PointsTransactionRow } from '@/lib/supabase/custom-types'

interface Props {
  params: Promise<{ locale: string }>
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
            className="flex-1 bg-brand-gold text-brand-black font-satoshi font-bold text-sm
                       px-6 py-3 rounded-xl text-center hover:bg-brand-gold-light transition-colors"
          >
            {t('login')}
          </a>
          <a
            href={isAr ? '/account/register' : '/en/account/register'}
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

  const progress  = tierProgressToNext(customer.total_orders, customer.total_spent_bhd, customer.loyalty_tier)
  const nextTier  = getNextTier(customer.loyalty_tier)
  const benefits  = TIER_BENEFITS[customer.loyalty_tier][isAr ? 'ar' : 'en']
  const tierColor = TIER_COLORS[customer.loyalty_tier]
  const bhdValue  = pointsToCredit(customer.points_balance)

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-brand-black py-8 px-4"
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-8">

        {/* ── Profile card ─────────────────────────────────────────────── */}
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: tierColor.border, backgroundColor: tierColor.bg }}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className={`text-2xl font-black text-brand-text mb-1
                ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                {customer.name ?? t('title')}
              </h1>
              <p className="font-satoshi text-sm text-brand-muted">
                {customer.phone}
              </p>
            </div>
            <TierBadge tier={customer.loyalty_tier} size="lg" locale={locale} />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: tL('totalOrders'), value: String(customer.total_orders) },
              { label: tL('totalSpent'),  value: `${Number(customer.total_spent_bhd).toFixed(3)} BD` },
              { label: tL('memberSince'), value: new Date(customer.joined_at).toLocaleDateString(
                  isAr ? 'ar-BH' : 'en-BH', { month: 'short', year: 'numeric' }
                ) },
            ].map((stat) => (
              <div key={stat.label} className="bg-brand-surface/60 rounded-xl p-3 text-center">
                <p className="font-satoshi text-xs text-brand-muted mb-1">{stat.label}</p>
                <p className="font-satoshi font-bold text-brand-text text-sm tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Points balance ────────────────────────────────────────────── */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {tL('pointsBalance')}
          </h2>
          <div className="flex items-end gap-3 mb-2">
            <span className="font-satoshi font-black text-5xl tabular-nums"
                  style={{ color: TIER_COLORS[customer.loyalty_tier].text }}>
              {formatPoints(customer.points_balance)}
            </span>
            <span className={`text-brand-muted mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {tL('points')}
            </span>
          </div>
          <p className="font-satoshi text-sm text-brand-muted">
            ≈ {bhdValue.toFixed(3)} BD {isAr ? 'قابلة للاسترداد' : 'redeemable'}
          </p>
          <p className="font-satoshi text-xs text-brand-muted/60 mt-1">
            {tL('pointValue')} · {tL('expiryNote')}
          </p>
        </div>

        {/* ── Tier progress ─────────────────────────────────────────────── */}
        {progress && nextTier && (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
            <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
              ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {tL('progressToNextTier', { tier: isAr
                ? { silver: 'الفضي', gold: 'الذهبي', platinum: 'البلاتيني', bronze: 'البرونزي' }[nextTier]
                : nextTier.charAt(0).toUpperCase() + nextTier.slice(1)
              })}
            </h2>

            <div className="flex flex-col gap-3">
              {/* Progress by orders */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? 'بالطلبات' : 'By orders'}
                  </span>
                  <span className="font-satoshi text-xs text-brand-muted tabular-nums">
                    {customer.total_orders} / {TIER_THRESHOLDS[nextTier].minOrders}
                  </span>
                </div>
                <div className="h-2 bg-brand-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(progress.byOrders * 100)}%`,
                      backgroundColor: tierColor.text,
                    }}
                  />
                </div>
              </div>

              {/* Progress by spend */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? 'بالإنفاق' : 'By spend'}
                  </span>
                  <span className="font-satoshi text-xs text-brand-muted tabular-nums">
                    {Number(customer.total_spent_bhd).toFixed(0)} / {TIER_THRESHOLDS[nextTier].minSpent} BD
                  </span>
                </div>
                <div className="h-2 bg-brand-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(progress.bySpend * 100)}%`,
                      backgroundColor: tierColor.text,
                    }}
                  />
                </div>
              </div>
            </div>

            <p className={`text-xs text-brand-muted mt-3 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr
                ? 'يكفي تحقيق أحد الشرطين للارتقاء للمستوى التالي'
                : 'Either condition alone qualifies you for the next tier'}
            </p>
          </div>
        )}

        {/* ── Benefits ──────────────────────────────────────────────────── */}
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-6">
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {tL('benefits')}
          </h2>
          <ul className="flex flex-col gap-2">
            {benefits.map((b) => (
              <li
                key={b}
                className={`flex items-start gap-2 text-sm text-brand-text
                  ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                <span className="mt-1 shrink-0" style={{ color: tierColor.text }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Points history ────────────────────────────────────────────── */}
        <div>
          <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-4
            ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('pointsHistory')}
          </h2>
          <PointsHistory transactions={transactions} />
        </div>

      </div>
    </div>
  )
}
