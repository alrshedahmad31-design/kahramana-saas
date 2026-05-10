'use client'

import { useState, useTransition } from 'react'
import AllergenSelector from './AllergenSelector'
import type { IngredientRow, IngredientUnit, IngredientCategory, StorageTemp } from '@/lib/supabase/custom-types'
import { useTranslations } from 'next-intl'

interface IngredientWithAllergens extends IngredientRow {
  allergens: string[]
}

interface Props {
  ingredient?: IngredientWithAllergens
  suppliers: { id: string; name_ar: string; name_en: string | null }[]
  locale: string
  action: (formData: FormData) => Promise<{ error?: string }>
}

export default function IngredientForm({ ingredient, suppliers, locale, action }: Props) {
  const t = useTranslations('inventory.ingredients')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  const [allergens, setAllergens] = useState<string[]>(ingredient?.allergens ?? [])
  const [isActive, setIsActive] = useState(ingredient?.is_active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('is_active', isActive ? 'true' : 'false')
    
    const existingAllergens = fd.getAll('allergens')
    existingAllergens.forEach(() => fd.delete('allergens'))
    allergens.forEach((a) => fd.append('allergens', a))

    startTransition(async () => {
      const result = await action(fd)
      if (result.error) {
        setError(result.error)
      } else {
        setError(null)
      }
    })
  }

  const inputClass = `w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 ${font} text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none transition-colors`
  const labelClass = `block ${font} text-sm font-medium text-brand-text mb-1`
  const selectClass = `w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`

  const units: IngredientUnit[] = ['g', 'kg', 'ml', 'l', 'unit', 'tbsp', 'tsp', 'oz', 'lb', 'piece', 'portion', 'bottle', 'can', 'bag', 'box']
  const categories: IngredientCategory[] = ['protein', 'grain', 'vegetable', 'dairy', 'seafood', 'spice', 'oil', 'beverage', 'sauce', 'packaging', 'cleaning', 'disposable', 'other']
  const storageTemps: StorageTemp[] = ['frozen', 'chilled', 'ambient', 'dry']

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {ingredient?.id && <input type="hidden" name="id" value={ingredient.id} />}

      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className={`${font} text-sm text-brand-error`}>{error}</p>
        </div>
      )}

      {/* Names */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t('arabicName')} *</label>
          <input
            type="text"
            name="name_ar"
            required
            defaultValue={ingredient?.name_ar}
            placeholder={t('placeholderAr')}
            className={inputClass}
            dir="rtl"
          />
        </div>
        <div>
          <label className={labelClass}>{t('englishName')} *</label>
          <input
            type="text"
            name="name_en"
            required
            defaultValue={ingredient?.name_en}
            placeholder={t('placeholderEn')}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      {/* Unit & Purchase Unit */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>{t('unit')} *</label>
          <select name="unit" required defaultValue={ingredient?.unit ?? 'g'} className={selectClass}>
            {units.map((u) => (
              <option key={u} value={u}>{t(`units.${u}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('purchaseUnit')}</label>
          <input
            type="text"
            name="purchase_unit"
            defaultValue={ingredient?.purchase_unit ?? ''}
            placeholder={t('placeholderCarton')}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('purchaseFactor')}</label>
          <input
            type="number"
            name="purchase_unit_factor"
            defaultValue={ingredient?.purchase_unit_factor ?? ''}
            step="0.001"
            min="0"
            placeholder={t('placeholderFactor')}
            className={inputClass}
          />
        </div>
      </div>

      {/* Cost & Yield */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>{t('costPerUnit')} ({tCommon('currency')})</label>
          <div className="relative">
            <input
              type="number"
              name="cost_per_unit"
              required
              defaultValue={ingredient?.cost_per_unit ?? ''}
              step="0.001"
              min="0"
              placeholder="0.000"
              className={inputClass + ' pe-10'}
            />
            <span className={`absolute end-3 top-1/2 -translate-y-1/2 ${font} text-xs text-brand-muted`}>{tCommon('currency')}</span>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('idealCost')}</label>
          <input
            type="number"
            name="ideal_cost_pct"
            defaultValue={ingredient?.ideal_cost_pct ?? ''}
            step="0.1"
            min="0"
            max="100"
            placeholder="30"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('yieldFactor')}</label>
          <input
            type="number"
            name="default_yield_factor"
            defaultValue={ingredient?.default_yield_factor ?? 1}
            step="0.001"
            min="0.001"
            max="1"
            className={inputClass}
          />
        </div>
      </div>

      {/* Category & ABC */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{t('category')}</label>
          <select name="category" defaultValue={ingredient?.category ?? ''} className={selectClass}>
            <option value="">{t('selectCategory')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{t(`categories.${c}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('abcClass')}</label>
          <select name="abc_class" defaultValue={ingredient?.abc_class ?? 'C'} className={selectClass}>
            <option value="A">A — {t('abcCritical')}</option>
            <option value="B">B — {t('abcModerate')}</option>
            <option value="C">C — {t('abcLow')}</option>
          </select>
        </div>
      </div>

      {/* Stock Levels */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>{t('reorderPoint')}</label>
          <input
            type="number"
            name="reorder_point"
            defaultValue={ingredient?.reorder_point ?? ''}
            step="0.001"
            min="0"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('maxStock')}</label>
          <input
            type="number"
            name="max_stock_level"
            defaultValue={ingredient?.max_stock_level ?? ''}
            step="0.001"
            min="0"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('reorderQty')}</label>
          <input
            type="number"
            name="reorder_qty"
            defaultValue={ingredient?.reorder_qty ?? ''}
            step="0.001"
            min="0"
            className={inputClass}
          />
        </div>
      </div>

      {/* Storage */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>{t('shelfLife')}</label>
          <input
            type="number"
            name="shelf_life_days"
            defaultValue={ingredient?.shelf_life_days ?? ''}
            step="1"
            min="0"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('storageTemp')}</label>
          <select name="storage_temp" defaultValue={ingredient?.storage_temp ?? ''} className={selectClass}>
            <option value="">{t('select')}</option>
            {storageTemps.map((s) => (
              <option key={s} value={s}>{t(`storageTemps.${s}`)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('barcode')}</label>
          <input
            type="text"
            name="barcode"
            defaultValue={ingredient?.barcode ?? ''}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      {/* Supplier */}
      <div>
        <label className={labelClass}>{t('supplier')}</label>
        <select name="supplier_id" defaultValue={ingredient?.supplier_id ?? ''} className={selectClass}>
          <option value="">{t('noSupplier')}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{isAr ? s.name_ar : (s.name_en || s.name_ar)}</option>
          ))}
        </select>
      </div>

      {/* Allergens */}
      <AllergenSelector
        selected={allergens}
        onChange={setAllergens}
        locale={locale}
      />

      {/* Is Active */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          onClick={() => setIsActive((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
            ${isActive ? 'bg-brand-gold' : 'bg-brand-border'}`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
              ${isActive ? 'translate-x-6' : 'translate-x-1'}`}
          />
        </button>
        <span className={`${font} text-sm text-brand-text`}>
          {isActive ? t('active') : t('inactive')}
        </span>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>{t('notes')}</label>
        <textarea
          name="notes"
          defaultValue={ingredient?.notes ?? ''}
          rows={3}
          className={inputClass + ' resize-none'}
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-brand-border">
        <button
          type="submit"
          disabled={isPending}
          className={`inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 ${font} text-sm font-semibold text-brand-black hover:bg-brand-gold/90 disabled:opacity-50 transition-colors`}
        >
          {isPending ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  )
}

