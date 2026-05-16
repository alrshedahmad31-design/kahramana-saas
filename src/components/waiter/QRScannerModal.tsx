'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { TIER_COLORS } from '@/lib/design-tokens'
import { formatPoints, type LoyaltyTier } from '@/lib/loyalty/calculations'
import {
  lookupMemberByQR,
  type MemberLookupResult,
  type MemberLookupRow,
} from '@/app/[locale]/waiter/actions'

interface Props {
  open:        boolean
  onClose:     () => void
  onResolved?: (member: MemberLookupRow) => void
}

const TIER_LABELS: Record<LoyaltyTier, { ar: string; en: string }> = {
  bronze:   { ar: 'برونزي', en: 'BRONZE' },
  silver:   { ar: 'فضي',    en: 'SILVER' },
  gold:     { ar: 'ذهبي',   en: 'GOLD'   },
  platinum: { ar: 'VIP',    en: 'VIP'    },
}

type ViewState =
  | { kind: 'scanning' }
  | { kind: 'looking-up' }
  | { kind: 'resolved'; member: MemberLookupRow }
  | { kind: 'error';    code: Exclude<Extract<MemberLookupResult, { ok: false }>['code'], never> }

export default function QRScannerModal({ open, onClose, onResolved }: Props) {
  const t        = useTranslations('waiter.qrScanner')
  const locale   = useLocale()
  const isAr     = locale === 'ar'
  const readerId = useId().replace(/:/g, '-')

  const [state, setState] = useState<ViewState>({ kind: 'scanning' })

  // Track the running scanner instance so we can stop it across renders.
  // Typed as unknown to avoid pulling html5-qrcode types into the bundle when
  // the modal is mounted but never opened.
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null)
  // Single-flight latch so the first decode wins; subsequent frames are ignored
  // until the modal is reopened.
  const decodedRef = useRef(false)

  const handleDecoded = useCallback(async (raw: string) => {
    if (decodedRef.current) return
    decodedRef.current = true
    setState({ kind: 'looking-up' })
    try {
      const result = await lookupMemberByQR(raw)
      if (result.ok) {
        setState({ kind: 'resolved', member: result.member })
        onResolved?.(result.member)
      } else {
        setState({ kind: 'error', code: result.code })
      }
    } catch {
      setState({ kind: 'error', code: 'lookup_failed' })
    }
  }, [onResolved])

  // Start / stop the scanner around the modal lifecycle.
  useEffect(() => {
    if (!open) return
    decodedRef.current = false
    setState({ kind: 'scanning' })

    let cancelled = false
    let instance: { stop: () => Promise<void>; clear: () => void } | null = null

    ;(async () => {
      try {
        // Dynamic import keeps html5-qrcode out of the waiter dashboard bundle
        // until the scanner is actually opened.
        const mod = await import('html5-qrcode')
        if (cancelled) return
        const Html5Qrcode = mod.Html5Qrcode
        instance = new Html5Qrcode(readerId) as unknown as typeof instance
        scannerRef.current = instance
        await (instance as unknown as {
          start: (
            cam: { facingMode: string },
            cfg: { fps: number; qrbox: { width: number; height: number } },
            onDecoded: (decoded: string) => void,
            onError:   (msg: string) => void,
          ) => Promise<void>
        }).start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => { void handleDecoded(decoded) },
          () => { /* frame-level decode misses — silent */ },
        )
      } catch {
        if (!cancelled) setState({ kind: 'error', code: 'lookup_failed' })
      }
    })()

    return () => {
      cancelled = true
      const live = scannerRef.current
      scannerRef.current = null
      if (live) {
        live.stop().catch(() => {}).finally(() => {
          try { live.clear() } catch { /* no-op */ }
        })
      }
    }
  }, [open, readerId, handleDecoded])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${readerId}-title`}
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:w-[28rem] max-w-md bg-brand-surface border border-brand-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 ps-5 pe-3 py-3 border-b border-brand-border">
          <h2
            id={`${readerId}-title`}
            className={`text-base font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}
          >
            {t('title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="min-h-[44px] min-w-[44px] px-3 text-sm font-bold text-brand-muted hover:text-brand-text"
          >
            ×
          </button>
        </header>

        <div className="p-4 space-y-4">
          {state.kind === 'scanning' && (
            <>
              <div
                id={readerId}
                className="mx-auto w-full aspect-square max-w-xs rounded-xl overflow-hidden bg-black/60 border border-brand-border"
              />
              <p className={`text-center text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('aimAtCode')}
              </p>
            </>
          )}

          {state.kind === 'looking-up' && (
            <div className="py-10 text-center">
              <div
                className="mx-auto h-10 w-10 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin"
                aria-hidden="true"
              />
              <p className={`mt-4 text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('lookingUp')}
              </p>
            </div>
          )}

          {state.kind === 'resolved' && (
            <ResolvedCard member={state.member} isAr={isAr} t={t} onClose={onClose} />
          )}

          {state.kind === 'error' && (
            <div className="py-8 text-center space-y-3">
              <p className={`text-sm text-red-400 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t(`error.${state.code}`)}
              </p>
              <button
                type="button"
                onClick={() => {
                  decodedRef.current = false
                  setState({ kind: 'scanning' })
                }}
                className="min-h-[44px] px-4 text-sm font-bold text-brand-gold bg-brand-gold/5 border border-brand-gold/20 rounded-lg hover:bg-brand-gold/10 transition-colors"
              >
                {t('tryAgain')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface ResolvedCardProps {
  member:  MemberLookupRow
  isAr:    boolean
  t:       (key: string, values?: Record<string, string | number>) => string
  onClose: () => void
}

function ResolvedCard({ member, isAr, t, onClose }: ResolvedCardProps) {
  const tierColor = TIER_COLORS[member.tier]
  const tierLabel = TIER_LABELS[member.tier][isAr ? 'ar' : 'en']
  const displayName = (member.name?.trim()) || (isAr ? 'عضو' : 'Member')

  return (
    <div className="py-2 space-y-4">
      <p className={`text-center text-base text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
        {t('welcome', { name: displayName })}
      </p>

      <div className="flex items-center justify-between gap-3 bg-brand-surface2 border border-brand-border rounded-xl p-4">
        <div className="min-w-0">
          <p className={`text-[10px] uppercase tracking-[0.3em] text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('points')}
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums text-brand-text" dir="ltr">
            {formatPoints(member.points_balance)}
          </p>
        </div>
        <span
          className="shrink-0 px-3 py-1.5 text-[11px] font-black tracking-[0.24em] uppercase rounded-md border"
          style={{
            color:           tierColor.text,
            borderColor:     tierColor.border,
            backgroundColor: tierColor.bg,
          }}
        >
          {tierLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={onClose}
        className={`w-full min-h-[44px] px-4 text-sm font-bold text-brand-bg bg-brand-gold rounded-lg hover:bg-brand-gold/90 transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
      >
        {t('done')}
      </button>
    </div>
  )
}
