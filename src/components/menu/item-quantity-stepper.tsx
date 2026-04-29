'use client'

import { Minus, Plus } from 'lucide-react'

interface ItemQuantityStepperProps {
  quantity: number
  onChange: (quantity: number) => void
  decreaseLabel: string
  increaseLabel: string
  isRTL: boolean
}

export default function ItemQuantityStepper({
  quantity,
  onChange,
  decreaseLabel,
  increaseLabel,
  isRTL,
}: ItemQuantityStepperProps) {
  return (
    <div
      className="flex min-h-11 items-center overflow-hidden rounded-lg border border-brand-border bg-brand-surface-2"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, quantity - 1))}
        aria-label={decreaseLabel}
        className="flex h-11 w-11 items-center justify-center text-brand-muted transition-colors duration-150 hover:bg-brand-surface hover:text-brand-text"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="w-10 text-center font-satoshi text-base font-bold tabular-nums text-brand-text">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        aria-label={increaseLabel}
        className="flex h-11 w-11 items-center justify-center text-brand-muted transition-colors duration-150 hover:bg-brand-surface hover:text-brand-text"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
