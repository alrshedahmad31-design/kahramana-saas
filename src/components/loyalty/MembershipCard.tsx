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
                 shadow-[0_24px_56px_-16px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(232,184,109,0.10)]"
      style={{
        backgroundImage: `
          radial-gradient(circle at 92% 6%, rgba(232,184,109,0.22) 0%, rgba(232,184,109,0) 45%),
          radial-gradient(circle at 8% 96%, rgba(166,124,0,0.20) 0%, rgba(166,124,0,0) 50%),
          ${tokens.color.membership.cardGradient}
        `,
        backgroundColor: tokens.color.black,
      }}
    >
      {/* Baghdadi geometric pattern — very subtle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,${PATTERN_SVG}")`,
          backgroundSize:  '84px 84px',
        }}
      />

      {/* Inner gold hairline frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[7px] rounded-[14px] border border-brand-gold/15"
      />

      {/* Diagonal sheen — subtle reflection across the card face */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-16 -inset-x-4 rotate-[18deg] opacity-[0.05]"
        style={{
          background:
            'linear-gradient(90deg, rgba(255,255,255,0) 30%, rgba(232,184,109,0.85) 50%, rgba(255,255,255,0) 70%)',
        }}
      />

      {/* Hairline gold divider — separates brand row from card body */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[14%] top-[31%] h-px"
        style={{
          background:
            'linear-gradient(90deg, rgba(232,184,109,0) 0%, rgba(232,184,109,0.4) 50%, rgba(232,184,109,0) 100%)',
        }}
      />

      {/* Card content — three-row column layout (brand · number · footer) */}
      <div className="absolute inset-0 flex flex-col p-5 sm:p-6">

        {/* ── ROW 1: brand lockup (start) · tier stamp (end) ────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <Image
              src="/assets/brand/logo.webp"
              alt={isAr ? 'كهرمانة بغداد' : 'Kahramana Baghdad'}
              width={64}
              height={104}
              priority
              className="h-12 sm:h-14 w-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)]"
            />
            <div className="flex flex-col leading-[1.05] min-w-0">
              <span
                className={`text-base sm:text-lg font-black tracking-[0.16em] uppercase text-brand-gold
                  ${isAr ? 'font-cairo' : 'font-editorial'}`}
                style={{ textShadow: '0 1px 1px rgba(0,0,0,0.55)' }}
              >
                {isAr ? 'كهرمانة' : 'KAHRAMANA'}
              </span>
              <span
                className={`mt-0.5 text-[10px] sm:text-[11px] tracking-[0.42em] uppercase text-brand-gold/65
                  ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                {isAr ? 'بغداد' : 'BAGHDAD'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className="font-satoshi text-[11px] sm:text-[12px] font-black tracking-[0.34em] uppercase"
              style={{
                color: tierColor.text,
                textShadow: '0 1px 1px rgba(0,0,0,0.55)',
              }}
            >
              {tierLabel}
            </span>
            <span
              className={`text-[9px] sm:text-[10px] tracking-[0.32em] uppercase text-brand-gold/70
                ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {t('premiumMember')}
            </span>
          </div>
        </div>

        {/* ── ROW 2: member id — the embossed focal point ───────────── */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <p
            className={`text-[9px] sm:text-[10px] uppercase tracking-[0.42em] text-brand-gold/55 mb-2
              ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {t('memberId')}
          </p>
          <p
            dir="ltr"
            className="font-mono text-2xl sm:text-3xl font-bold tabular-nums tracking-[0.22em] text-brand-text truncate"
            style={{
              textShadow:
                '0 1px 0 rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.35), 0 0 18px rgba(232,184,109,0.20)',
            }}
          >
            {memberId}
          </p>
        </div>

        {/* ── ROW 3: name + dates (start) · QR (end) ────────────────── */}
        <div className="flex items-end justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <p
              className={`text-lg sm:text-xl font-black text-brand-gold leading-tight truncate
                ${isAr ? 'font-cairo' : 'font-editorial'}`}
              title={displayName}
              style={{ textShadow: '0 1px 1px rgba(0,0,0,0.55)' }}
            >
              {displayName}
            </p>

            <div className="mt-2 flex items-end gap-5 sm:gap-7">
              <div className="min-w-0">
                <p
                  className={`text-[8px] sm:text-[9px] uppercase tracking-[0.3em] text-brand-gold/55
                    ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                >
                  {t('memberSince')}
                </p>
                <p
                  dir="ltr"
                  className={`mt-0.5 text-[11px] sm:text-xs font-bold tabular-nums text-brand-text
                    ${isAr ? 'font-almarai' : 'font-mono'}`}
                >
                  {memberSince}
                </p>
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[8px] sm:text-[9px] uppercase tracking-[0.3em] text-brand-gold/55
                    ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                >
                  {t('validThru')}
                </p>
                <p
                  dir="ltr"
                  className="mt-0.5 font-mono text-[11px] sm:text-xs font-bold tabular-nums text-brand-text"
                >
                  {validThru}
                </p>
              </div>
            </div>
          </div>

          {/* QR — paper-white panel with gold hairline + soft drop */}
          <div
            className="shrink-0 rounded-md p-1 sm:p-1.5 border border-brand-gold/40
                       shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
            style={{ backgroundColor: tokens.color.qrPaper }}
            aria-hidden="true"
          >
            <canvas
              ref={qrRef}
              className="block h-[52px] w-[52px] sm:h-[64px] sm:w-[64px]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
