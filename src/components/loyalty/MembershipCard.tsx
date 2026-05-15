'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { formatMemberId } from '@/lib/member-id'
import { TIER_COLORS, tokens } from '@/lib/design-tokens'
import type { LoyaltyTier } from '@/lib/loyalty/calculations'

interface Props {
  userId:   string
  name:     string | null
  tier:     LoyaltyTier
  joinedAt: string
}

const TIER_LABELS: Record<LoyaltyTier, { ar: string; en: string }> = {
  bronze:   { ar: 'برونزي', en: 'BRONZE' },
  silver:   { ar: 'فضي',    en: 'SILVER' },
  gold:     { ar: 'ذهبي',   en: 'GOLD'   },
  platinum: { ar: 'VIP',    en: 'VIP'    },
}

const VALIDITY_YEARS = 5

function safeDate(input: string | null | undefined): Date {
  if (!input) return new Date()
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function formatValidThru(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year  = String(d.getFullYear())
  return `${month}/${year}`
}

function formatMonthYear(d: Date, locale: string): string {
  // `-u-nu-latn` keeps Latin numerals on the Arabic locale so the card stays
  // visually consistent with the LTR-formatted Valid Thru (e.g. "مايو 2026"
  // instead of "مايو ٢٠٢٦").
  const tag = locale === 'ar' ? 'ar-BH-u-nu-latn' : 'en-BH'
  return d.toLocaleDateString(tag, {
    month: 'short',
    year:  'numeric',
  })
}

// Inline Baghdadi/Iraqi geometric pattern — used as a very subtle background overlay
const PATTERN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="84" height="84" viewBox="0 0 84 84">` +
    `<g fill="none" stroke="${tokens.color.membership.guilloche}" stroke-width="0.55">` +
      `<path d="M42 0 L84 42 L42 84 L0 42 Z"/>` +
      `<path d="M42 10 L74 42 L42 74 L10 42 Z"/>` +
      `<path d="M42 20 L64 42 L42 64 L20 42 Z"/>` +
      `<path d="M0 0 L20 20 M64 64 L84 84 M84 0 L64 20 M20 64 L0 84"/>` +
      `<circle cx="42" cy="42" r="4"/>` +
    `</g>` +
  `</svg>`,
)

export default function MembershipCard({ userId, name, tier, joinedAt }: Props) {
  const t        = useTranslations('account')
  const locale   = useLocale()
  const isAr     = locale === 'ar'
  const qrRef    = useRef<HTMLCanvasElement>(null)

  const memberId   = formatMemberId(userId)
  const tierColor  = TIER_COLORS[tier]
  const tierLabel  = TIER_LABELS[tier][isAr ? 'ar' : 'en']

  const joinedDate    = safeDate(joinedAt)
  const validDate     = new Date(joinedDate)
  validDate.setFullYear(joinedDate.getFullYear() + VALIDITY_YEARS)

  const validThru   = formatValidThru(validDate)
  const memberSince = formatMonthYear(joinedDate, locale)
  const displayName = (name?.trim()) || (isAr ? 'عضو كهرمانة' : 'KAHRAMANA MEMBER')

  useEffect(() => {
    if (!qrRef.current) return
    QRCode.toCanvas(
      qrRef.current,
      `KAHRAMANA:${memberId}`,
      {
        width:  88,
        margin: 1,
        color: {
          dark:  tokens.color.qrInk,
          light: tokens.color.qrPaper,
        },
      },
      (err) => { if (err) console.error('QR error:', err) },
    )
  }, [memberId])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      role="img"
      aria-label={`${t('memberCard')} — ${tierLabel} — ${displayName} — ${memberId}`}
      className="relative w-full max-w-md sm:max-w-lg mx-auto overflow-hidden
                 rounded-2xl border border-brand-gold/40
                 aspect-[1.586/1]
                 shadow-[0_14px_40px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(232,184,109,0.08)]"
      style={{
        backgroundImage: `
          radial-gradient(ellipse at top right, rgba(232,184,109,0.22) 0%, rgba(232,184,109,0) 55%),
          radial-gradient(ellipse at bottom left,  rgba(166,124,0,0.22) 0%, rgba(166,124,0,0) 60%),
          ${tokens.color.membership.cardGradient}
        `,
        backgroundColor: tokens.color.black,
      }}
    >
      {/* Baghdadi geometric pattern — very subtle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,${PATTERN_SVG}")`,
          backgroundSize:  '84px 84px',
        }}
      />

      {/* Inner gold hairline frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[6px] rounded-[14px] border border-brand-gold/15"
      />

      {/* Diagonal sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-12 -inset-x-4 rotate-12 opacity-[0.06]"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0) 30%, rgba(232,184,109,0.7) 50%, rgba(255,255,255,0) 70%)',
        }}
      />

      {/* ── Top row: logo (start) · tier (end) ───────────────────── */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Image
            src="/assets/logo.svg"
            alt="Kahramana Baghdad"
            width={42}
            height={100}
            className="h-9 sm:h-11 w-auto drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
          />
          <div className="flex flex-col leading-tight min-w-0">
            <span
              className={`text-[11px] sm:text-xs font-black tracking-[0.25em] uppercase text-brand-gold
                ${isAr ? 'font-cairo' : 'font-editorial'}`}
            >
              {isAr ? 'كهرمانة' : 'KAHRAMANA'}
            </span>
            <span
              className={`text-[8px] sm:text-[10px] tracking-[0.3em] uppercase text-brand-gold/60
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {isAr ? 'بغداد' : 'BAGHDAD'}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className="font-satoshi text-[10px] sm:text-xs font-black tracking-[0.3em] uppercase
                       px-2.5 py-1 rounded-md border"
            style={{
              color:           tierColor.text,
              borderColor:     tierColor.border,
              backgroundColor: tierColor.bg,
            }}
          >
            {tierLabel}
          </span>
          <span
            className={`text-[9px] sm:text-[10px] tracking-[0.25em] uppercase text-brand-gold/70
              ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {t('premiumMember')}
          </span>
        </div>
      </div>

      {/* ── Bottom: name + meta · QR ─────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p
            className={`text-[9px] sm:text-[10px] uppercase tracking-[0.3em] text-brand-gold/60 mb-0.5
              ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {t('memberId')}
          </p>
          <p
            dir="ltr"
            className="font-mono text-sm sm:text-base font-bold tabular-nums tracking-[0.18em]
                       text-brand-text mb-2 sm:mb-3 truncate"
          >
            {memberId}
          </p>

          <p
            className={`text-base sm:text-lg font-black text-brand-gold leading-tight truncate
              ${isAr ? 'font-cairo' : 'font-editorial'}`}
            title={displayName}
          >
            {displayName}
          </p>

          <div className="mt-1.5 sm:mt-2 flex items-end gap-4 sm:gap-6">
            <div className="min-w-0">
              <p
                className={`text-[8px] sm:text-[9px] uppercase tracking-[0.25em] text-brand-gold/60
                  ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                {t('memberSince')}
              </p>
              <p
                dir="ltr"
                className={`text-[11px] sm:text-xs font-bold tabular-nums text-brand-text
                  ${isAr ? 'font-almarai' : 'font-mono'}`}
              >
                {memberSince}
              </p>
            </div>
            <div className="min-w-0">
              <p
                className={`text-[8px] sm:text-[9px] uppercase tracking-[0.25em] text-brand-gold/60
                  ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                {t('validThru')}
              </p>
              <p
                dir="ltr"
                className="font-mono text-[11px] sm:text-xs font-bold tabular-nums text-brand-text"
              >
                {validThru}
              </p>
            </div>
          </div>
        </div>

        {/* QR — paper-white panel with gold hairline */}
        <div
          className="shrink-0 rounded-md p-1 sm:p-1.5 border border-brand-gold/30
                     shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
          style={{ backgroundColor: tokens.color.qrPaper }}
          aria-hidden="true"
        >
          <canvas
            ref={qrRef}
            className="block h-[56px] w-[56px] sm:h-[68px] sm:w-[68px]"
          />
        </div>
      </div>
    </div>
  )
}
