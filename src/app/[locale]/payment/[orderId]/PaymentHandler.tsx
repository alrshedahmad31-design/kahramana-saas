'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import PaymentSelector from '@/components/payment/PaymentSelector'
import BenefitPayQR from '@/components/payment/BenefitPayQR'
import {
  initializePayment,
  completeCashPayment,
  confirmBenefitPayment,
  initiateTapPayment,
} from './actions'
import type { PaymentMethod } from '@/lib/supabase/custom-types'

interface Props {
  orderId:           string
  orderNumber:       string
  amountBHD:         number
  customerName:      string | null
  customerPhone:     string | null
  locale:            string
  accessToken:       string | null
  existingPaymentId: string | null
  existingMethod:    PaymentMethod | null
}

type UIState = 'selecting' | 'confirming' | 'qr' | 'redirecting' | 'error'

function withAccessToken(path: string, accessToken: string | null): string {
  return accessToken ? `${path}?t=${encodeURIComponent(accessToken)}` : path
}

export default function PaymentHandler({
  orderId,
  orderNumber,
  amountBHD,
  customerName,
  customerPhone,
  locale,
  accessToken,
  existingPaymentId,
  existingMethod,
}: Props) {
  const t       = useTranslations('payment')
  const tCommon = useTranslations('common')
  const router  = useRouter()

  const [method,    setMethod]    = useState<PaymentMethod>(existingMethod ?? 'cash')
  const [paymentId, setPaymentId] = useState<string | null>(existingPaymentId)
  const [qrBase64,  setQrBase64]  = useState<string | null>(null)
  const [uiState,   setUiState]   = useState<UIState>('selecting')
  const [error,     setError]     = useState<string | null>(null)

  async function handleConfirmMethod() {
    setUiState('confirming')
    setError(null)

    const result = await initializePayment(orderId, method, amountBHD, accessToken)

    if (result.error === 'already_completed') {
      router.push(withAccessToken(`/order/${orderId}`, accessToken))
      return
    }
    if (!result.paymentId) {
      setError(result.error ?? tCommon('error'))
      setUiState('error')
      return
    }

    setPaymentId(result.paymentId)

    switch (method) {
      case 'cash': {
        const { error: err } = await completeCashPayment(result.paymentId)
        if (err) { setError(err); setUiState('error'); return }
        setUiState('redirecting')
        router.push(withAccessToken(`/order/${orderId}`, accessToken))
        break
      }

      case 'benefit_qr': {
        setQrBase64(result.qrBase64 ?? null)
        setUiState('qr')
        break
      }

      case 'tap_card':
      case 'tap_knet': {
        setUiState('redirecting')
        const { checkoutUrl, error: err } = await initiateTapPayment(
          result.paymentId,
          orderId,
          amountBHD,
          customerName,
          customerPhone,
          locale,
          accessToken,
        )
        if (err || !checkoutUrl) {
          setError(err ?? tCommon('error'))
          setUiState('error')
          return
        }
        window.location.href = checkoutUrl
        break
      }
    }
  }

  async function handleBenefitPaid() {
    if (!paymentId) throw new Error('No payment ID')
    const { error: err } = await confirmBenefitPayment(paymentId, accessToken)
    if (err) {
      setError(err)
      setUiState('error')
      throw new Error(err) // propagates to BenefitPayQR to reset its confirming state
    }
    setUiState('redirecting')
    router.push(withAccessToken(`/order/${orderId}`, accessToken))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-16">

      {/* Order summary header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand-gold font-cairo mb-1">
          {t('title')}
        </h1>
        <p className="text-brand-muted font-satoshi text-sm">
          {t('order_label')} #{orderNumber}
        </p>
        <p className="text-brand-text font-satoshi text-3xl font-medium mt-3 tabular-nums">
          {amountBHD.toFixed(3)}{' '}
          <span className="text-lg font-normal text-brand-muted">
            {tCommon('currency')}
          </span>
        </p>
      </div>

      {/* Benefit Pay QR display */}
      {uiState === 'qr' && qrBase64 && (
        <div className="mb-8">
          <BenefitPayQR
            qrBase64={qrBase64}
            orderNumber={orderNumber}
            amountBHD={amountBHD}
            onPaid={handleBenefitPaid}
            disabled={false}
          />
        </div>
      )}

      {/* Method selector + confirm (selecting state only) */}
      {uiState === 'selecting' && (
        <>
          <div className="mb-6">
            <p className="text-brand-muted font-satoshi text-sm mb-3">
              {t('selectMethod')}
            </p>
            <PaymentSelector
              selected={method}
              onChange={setMethod}
            />
          </div>

          <button
            type="button"
            onClick={handleConfirmMethod}
            className={[
              'w-full py-4 rounded-lg',
              'bg-brand-gold text-brand-black',
              'font-satoshi font-semibold text-sm',
              'hover:bg-brand-gold-light transition-colors duration-150',
            ].join(' ')}
          >
            {t('confirm_method')}
          </button>
        </>
      )}

      {/* Loading spinner */}
      {(uiState === 'confirming' || uiState === 'redirecting') && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-brand-muted font-satoshi text-sm">
            {t('processing')}
          </p>
        </div>
      )}

      {/* Error state */}
      {uiState === 'error' && error && (
        <div className="mt-4 rounded-lg border border-brand-error/30 bg-brand-error/10 p-4">
          <p className="text-brand-error font-satoshi text-sm">{error}</p>
          <button
            type="button"
            onClick={() => { setUiState('selecting'); setError(null) }}
            className="mt-3 text-brand-gold font-satoshi text-sm hover:underline"
          >
            {tCommon('retry')}
          </button>
        </div>
      )}
    </div>
  )
}
