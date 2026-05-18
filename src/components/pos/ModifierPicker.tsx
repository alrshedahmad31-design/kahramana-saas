'use client'

import { useMemo, useState } from 'react'
import type { CartModifier, POSItem, POSModifierGroup } from './types'

interface Props {
  item:   POSItem
  isAr:   boolean
  /** Base unit price already resolved (size/variant applied if present). */
  baseUnitPriceBhd: number
  onCancel:  () => void
  onConfirm: (modifiers: CartModifier[], unitPriceBhd: number) => void
}

export default function ModifierPicker({ item, isAr, baseUnitPriceBhd, onCancel, onConfirm }: Props) {
  const bhd = isAr ? 'د.ب' : 'BHD'
  // selected[groupId] = Set<optionId>
  const [selected, setSelected] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {}
    for (const g of item.modifierGroups) init[g.id] = new Set()
    return init
  })

  function toggle(group: POSModifierGroup, optionId: string) {
    setSelected((prev) => {
      const next = { ...prev }
      const current = new Set(prev[group.id] ?? [])
      if (group.multiSelect) {
        if (current.has(optionId)) current.delete(optionId)
        else current.add(optionId)
      } else {
        current.clear()
        current.add(optionId)
      }
      next[group.id] = current
      return next
    })
  }

  const missingRequired = useMemo(() => {
    return item.modifierGroups
      .filter((g) => g.required && (selected[g.id]?.size ?? 0) === 0)
      .map((g) => (isAr ? g.nameAr : g.nameEn))
  }, [item.modifierGroups, selected, isAr])

  const flat: CartModifier[] = useMemo(() => {
    const out: CartModifier[] = []
    for (const g of item.modifierGroups) {
      const ids = selected[g.id]
      if (!ids) continue
      for (const optionId of ids) {
        const opt = g.options.find((o) => o.id === optionId)
        if (!opt) continue
        out.push({
          group_id:        g.id,
          group_name_ar:   g.nameAr,
          group_name_en:   g.nameEn,
          option_id:       opt.id,
          option_name_ar:  opt.nameAr,
          option_name_en:  opt.nameEn,
          price_modifier:  opt.priceModifier,
        })
      }
    }
    return out
  }, [item.modifierGroups, selected])

  const adjustedUnit = Number(
    (baseUnitPriceBhd + flat.reduce((s, m) => s + m.price_modifier, 0)).toFixed(3),
  )

  function handleConfirm() {
    if (missingRequired.length > 0) return
    onConfirm(flat, adjustedUnit)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-xl bg-brand-surface p-5 sm:rounded-xl border border-brand-gold/20">
        <h3 className={`mb-1 text-lg font-bold text-brand-gold ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {isAr ? item.nameAr : item.nameEn}
        </h3>
        <p className="mb-4 text-xs text-brand-muted">
          {isAr ? 'اختر الإضافات' : 'Choose options'}
        </p>

        <div className="space-y-4">
          {item.modifierGroups.map((g) => (
            <div key={g.id} className="rounded-md border border-brand-border bg-brand-surface-2 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-brand-text">
                  {isAr ? g.nameAr : g.nameEn}
                  {g.required && (
                    <span className="ms-1 text-xs font-normal text-brand-gold">
                      {isAr ? '— مطلوب' : '— required'}
                    </span>
                  )}
                </h4>
                <span className="text-[10px] uppercase tracking-wider text-brand-muted">
                  {g.multiSelect
                    ? (isAr ? 'متعدد' : 'multi')
                    : (isAr ? 'واحد' : 'single')}
                </span>
              </div>

              <div className="grid gap-1.5">
                {g.options.map((o) => {
                  const isSelected = selected[g.id]?.has(o.id) ?? false
                  return (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors min-h-[44px] ${
                        isSelected
                          ? 'border-brand-gold/60 bg-brand-gold/10 text-brand-text'
                          : 'border-brand-border hover:border-brand-gold/30 text-brand-muted'
                      }`}
                    >
                      <input
                        type={g.multiSelect ? 'checkbox' : 'radio'}
                        name={`group-${g.id}`}
                        checked={isSelected}
                        onChange={() => toggle(g, o.id)}
                        className="h-4 w-4 accent-brand-gold"
                      />
                      <span className="flex-1">{isAr ? o.nameAr : o.nameEn}</span>
                      {o.priceModifier !== 0 && (
                        <span className="font-satoshi tabular-nums text-brand-gold">
                          {o.priceModifier > 0 ? '+' : ''}{o.priceModifier.toFixed(3)}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {missingRequired.length > 0 && (
          <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {isAr ? 'مطلوب اختيار: ' : 'Required: '}
            {missingRequired.join('، ')}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-brand-border pt-4">
          <span className="font-satoshi tabular-nums text-brand-text">
            {adjustedUnit.toFixed(3)} {bhd}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] rounded-md border border-brand-border bg-brand-surface-2 px-4 text-sm text-brand-muted hover:border-brand-gold/40"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={missingRequired.length > 0}
              className="min-h-[44px] rounded-md bg-brand-gold px-5 text-sm font-bold text-brand-black hover:bg-brand-gold-light disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAr ? 'أضف للطلب' : 'Add to order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
