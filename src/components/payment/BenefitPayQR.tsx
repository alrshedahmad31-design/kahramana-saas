'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Timer, CheckCircle2, AlertTriangle } from 'lucide-react'

const PAYMENT_TIMEOUT_SECONDS = 15 * 60

interface Props {
  qrBase64:    string
  orderNumber: string
  amountBHD:   number
  onPaid:      () => Promise<void>
  disabled?:   boolean
}

export default function BenefitPayQR({
  qrBase64,
  orderNumber,
  amountBHD,
  onPaid,
  disabled,
}: Props) {
  const t       = useTranslations('payment.benefit')
  const tCommon = useTranslations('common')

  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_TIMEOUT_SECONDS)
  const [confirming,  setConfirming]  = useState(false)
  const [expired,     setExpired]     = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          setExpired(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  async function handlePaid() {
    if (confirming || disabled || expired) return
    setConfirming(true)
    try {
      await onPaid()
    } catch {
      setConfirming(false)
    }
  }

  if (expired) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <AlertTriangle className="w-10 h-10 text-brand-error" />
        <p className="text-brand-text font-cairo text-lg font-bold">
          {t('expired_title')}
        </p>
        <p className="text-brand-muted font-satoshi text-sm max-w-xs">
          {t('expired_message')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* QR image */}
      <div className="rounded-xl overflow-hidden border border-brand-gold/20 p-3 bg-brand-cream">
        <Image
          src={qrBase64}
          alt={`Benefit Pay QR — Order ${orderNumber}`}
          width={240}
          height={240}
          unoptimized
          priority
        />
      </div>

      {/* Order + amount */}
      <div className="text-center">
        <p className="text-brand-muted font-satoshi text-xs mb-1">
          {t('order_label')} #{orderNumber}
        </p>
        <p className="text-brand-gold font-satoshi text-2xl font-medium tabular-nums">
          {amountBHD.toFixed(3)}{' '}
          <span className="text-base font-normal">{tCommon('currency')}</span>
        </p>
      </div>

      {/* Instructions */}
      <p className="text-brand-muted font-satoshi text-sm text-center max-w-xs leading-relaxed">
        {t('instructions')}
      </p>

      {/* Countdown timer */}
      <div className="flex items-center gap-2 text-brand-muted font-satoshi text-sm">
        <Timer className="w-4 h-4 flex-shrink-0" />
        <span>
          {t('timer_label')}: {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={handlePaid}
        disabled={confirming || !!disabled}
        className={[
          'w-full flex items-center justify-center gap-2',
          'rounded-lg py-4 px-6 font-satoshi font-semibold text-sm',
          'bg-brand-gold text-brand-black',
          'transition-colors duration-150',
          'hover:bg-brand-gold-light',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {confirming ? (
          tCommon('loading')
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            {t('paid_button')}
          </>
        )}
      </button>
    </div>
  )
}
