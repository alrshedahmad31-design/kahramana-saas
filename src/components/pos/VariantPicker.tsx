'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { POSItem } from './types'

interface Props {
  item:      POSItem
  isAr:      boolean
  onCancel:  () => void
  onConfirm: (
    size: string | null,
    variant: { ar: string; en: string } | null,
    unitPriceBhd: number,
  ) => void
}

export default function VariantPicker({ item, isAr, onCancel, onConfirm }: Props) {
  const t = useTranslations('pos')
  const tC = useTranslations('common')

  const hasSizes = item.sizes.length > 0
  const hasVariants = item.variants.length > 0

  const [size, setSize] = useState<string | null>(hasSizes ? item.sizes[0].label : null)
  const [variantIndex, setVariantIndex] = useState<number>(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const unitPriceBhd = useMemo(() => {
    let total = 0
    if (hasSizes) {
      const s = item.sizes.find((x) => x.label === size)
      total += s?.priceBhd ?? 0
    }
    if (hasVariants) {
      total += item.variants[variantIndex]?.priceBhd ?? 0
    }
    if (!hasSizes && !hasVariants) {
      total = item.priceBhd ?? 0
    }
    return total
  }, [hasSizes, hasVariants, item, size, variantIndex])

  function confirm() {
    const variant = hasVariants
      ? {
          ar: item.variants[variantIndex].labelAr,
          en: item.variants[variantIndex].labelEn,
        }
      : null
    onConfirm(hasSizes ? size : null, variant, unitPriceBhd)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-brand-black/70 backdrop-blur-sm px-4 py-6"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-5 flex flex-col gap-4"
      >
        <div>
          <h3 className={`text-lg font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {isAr ? item.nameAr : item.nameEn}
          </h3>
        </div>

        {hasVariants && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-brand-muted font-satoshi font-bold mb-2">
              {t('selectVariant')}
            </p>
            <div className="flex flex-col gap-2">
              {item.variants.map((v, i) => (
                <label
                  key={i}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors
                    ${variantIndex === i
                      ? 'bg-brand-gold/10 border-brand-gold/40'
                      : 'bg-brand-surface-2 border-brand-border hover:border-brand-gold/30'
                    }`}
                >
                  <input
                    type="radio"
                    name="variant"
                    checked={variantIndex === i}
                    onChange={() => setVariantIndex(i)}
                    className="sr-only"
                  />
                  <span className={`text-sm text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? v.labelAr : v.labelEn}
                  </span>
                  <span className="font-satoshi font-bold text-brand-gold tabular-nums text-sm">
                    {v.priceBhd.toFixed(3)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {hasSizes && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-brand-muted font-satoshi font-bold mb-2">
              {t('selectSize')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {item.sizes.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSize(s.label)}
                  className={`min-h-[48px] rounded-lg font-satoshi text-sm font-medium transition-colors border flex flex-col items-center justify-center gap-0.5
                    ${size === s.label
                      ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/40'
                      : 'bg-brand-surface-2 text-brand-muted border-brand-border hover:text-brand-text'
                    }`}
                >
                  <span className="text-xs">{s.label}</span>
                  <span className="tabular-nums text-[11px]">{s.priceBhd.toFixed(3)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-brand-border pt-3">
          <span className="text-sm text-brand-muted">{t('total')}</span>
          <span className="font-satoshi text-xl font-black text-brand-gold tabular-nums">
            {unitPriceBhd.toFixed(3)} <span className="text-xs font-normal text-brand-muted">{tC('currency')}</span>
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] rounded-lg border border-brand-border bg-brand-surface-2 text-brand-text font-satoshi text-sm font-medium hover:border-brand-gold/30 transition-colors"
          >
            {tC('cancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={unitPriceBhd <= 0}
            className="flex-1 min-h-[44px] rounded-lg bg-brand-gold text-brand-black font-satoshi text-sm font-bold hover:bg-brand-gold-light transition-colors disabled:opacity-50"
          >
            {tC('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
