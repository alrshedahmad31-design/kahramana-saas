'use client'

import { useLocale, useTranslations } from 'next-intl'

interface Props {
  // ISO date string YYYY-MM-DD as stored in customer_profiles.birthday.
  // Null/empty when the customer hasn't set a birthday — caller may
  // choose to render a CTA card via the alternate `prompt` mode.
  birthday: string | null
}

interface Countdown {
  daysUntil: number
  targetDate: Date
}

function computeCountdown(birthday: string): Countdown | null {
  // birthday is YYYY-MM-DD. Parse as a UTC-local boundary to avoid TZ slip
  // on the day-of-birthday calculation (which is otherwise off-by-one near
  // Bahrain's UTC+3 boundary).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday)
  if (!m) return null
  const month = Number(m[2])
  const day   = Number(m[3])
  if (!month || !day) return null

  const now    = new Date()
  const year   = now.getFullYear()

  // Build "this year" in local time.
  let target = new Date(year, month - 1, day, 0, 0, 0, 0)
  const today = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0, 0)

  if (target.getTime() < today.getTime()) {
    target = new Date(year + 1, month - 1, day, 0, 0, 0, 0)
  }

  const dayMs = 24 * 60 * 60 * 1000
  const daysUntil = Math.round((target.getTime() - today.getTime()) / dayMs)
  return { daysUntil, targetDate: target }
}

function formatTargetDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-BH' : 'en-GB', {
    day:   'numeric',
    month: 'long',
  }).format(date)
}

export default function BirthdayGiftCard({ birthday }: Props) {
  const t      = useTranslations('account.birthdayGift')
  const locale = useLocale()
  const isAr   = locale === 'ar'

  if (!birthday) {
    return (
      <div className="bg-brand-surface border border-dashed border-brand-border rounded-2xl p-5 flex flex-col gap-2">
        <p className={`text-xs font-bold text-brand-muted uppercase tracking-wide ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('promptTitle')}
        </p>
        <p className={`text-sm text-brand-text ${isAr ? 'font-cairo text-end' : 'font-satoshi text-start'}`}>
          {t('promptBody')}
        </p>
      </div>
    )
  }

  const countdown = computeCountdown(birthday)
  if (!countdown) return null

  const { daysUntil, targetDate } = countdown
  const isToday = daysUntil === 0
  const dateLabel = formatTargetDate(targetDate, locale)

  return (
    <div
      className="rounded-2xl p-5 border border-brand-gold/40 bg-brand-gold/10 flex flex-col gap-2"
      aria-label={t('ariaLabel')}
    >
      <p className={`text-xs font-bold text-brand-gold uppercase tracking-wide ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {t('title')}
      </p>

      <div className="flex items-baseline gap-2">
        <span className="font-satoshi font-black text-4xl tabular-nums leading-none text-brand-gold">
          {isToday ? '🎂' : daysUntil}
        </span>
        {!isToday && (
          <span className={`text-sm text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('daysUntil', { count: daysUntil })}
          </span>
        )}
      </div>

      <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
        {isToday ? t('happyBirthday') : t('giftLandsOn', { date: dateLabel })}
      </p>
    </div>
  )
}
