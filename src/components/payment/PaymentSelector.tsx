'use client'

import { useTranslations } from 'next-intl'
import { Banknote, QrCode, CreditCard, ShieldCheck } from 'lucide-react'
import type { PaymentMethod } from '@/lib/supabase/custom-types'

interface MethodConfig {
  id:        PaymentMethod
  Icon:      React.FC<{ className?: string }>
  available: boolean
}

const METHODS: MethodConfig[] = [
  { id: 'cash',       Icon: Banknote,   available: true  },
  { id: 'benefit_qr', Icon: QrCode,     available: true  },
  { id: 'tap_card',   Icon: CreditCard, available: false },
  { id: 'tap_knet',   Icon: CreditCard, available: false },
]

interface Props {
  selected:  PaymentMethod
  onChange:  (method: PaymentMethod) => void
  disabled?: boolean
}

export default function PaymentSelector({ selected, onChange, disabled }: Props) {
  const t = useTranslations('payment')

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-col gap-3"
        role="radiogroup"
        aria-label={t('selectMethod')}
      >
        {METHODS.map(({ id, Icon, available }) => {
          const isSelected = selected === id
          const isDisabled = disabled ?? !available

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(id)}
              className={[
                'relative flex items-center gap-4 w-full rounded-lg border p-4 text-start',
                'transition-all duration-150',
                isSelected
                  ? 'border-brand-gold bg-brand-gold/5'
                  : 'border-brand-border/40 bg-brand-surface',
                isDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'cursor-pointer hover:border-brand-gold/60',
              ].join(' ')}
            >
              {/* Radio dot */}
              <span
                className={[
                  'flex-shrink-0 w-5 h-5 rounded-full border-2',
                  'flex items-center justify-center',
                  isSelected ? 'border-brand-gold' : 'border-brand-muted/40',
                ].join(' ')}
                aria-hidden="true"
              >
                {isSelected && (
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
                )}
              </span>

              <Icon
                className={`w-5 h-5 flex-shrink-0 ${
                  isSelected ? 'text-brand-gold' : 'text-brand-muted'
                }`}
              />

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight font-satoshi ${
                  isSelected ? 'text-brand-gold' : 'text-brand-text'
                }`}>
                  {t(`methods.${id}`)}
                </p>
                <p className="text-xs text-brand-muted font-satoshi mt-0.5">
                  {!available ? t('methods.coming_soon') : t(`methods.${id}_desc`)}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="rounded-lg border border-brand-border/40 bg-brand-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-muted">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-border/50 px-2 py-1">
            <QrCode className="h-3.5 w-3.5 text-brand-gold" />
            {t('trust.benefit')}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-border/50 px-2 py-1">
            <CreditCard className="h-3.5 w-3.5 text-brand-gold" />
            {t('trust.tap')}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs text-brand-muted font-satoshi">
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand-gold" />
          {t('trust.note')}
        </p>
      </div>
    </div>
  )
}
