'use client'

import { useState, useTransition } from 'react'
import AllergenSelector from './AllergenSelector'
import type { IngredientRow, IngredientUnit, IngredientCategory, StorageTemp } from '@/lib/supabase/custom-types'

const UNITS: IngredientUnit[] = ['g','kg','ml','l','unit','tbsp','tsp','oz','lb','piece','portion','bottle','can','bag','box']

const CATEGORIES: { value: IngredientCategory; ar: string; en: string }[] = [
  { value: 'protein',    ar: 'بروتين',      en: 'Protein' },
  { value: 'grain',      ar: 'حبوب',        en: 'Grain' },
  { value: 'vegetable',  ar: 'خضراوات',     en: 'Vegetable' },
  { value: 'dairy',      ar: 'ألبان',       en: 'Dairy' },
  { value: 'seafood',    ar: 'مأكولات بحرية', en: 'Seafood' },
  { value: 'spice',      ar: 'بهارات',      en: 'Spice' },
  { value: 'oil',        ar: 'زيوت',        en: 'Oil' },
  { value: 'beverage',   ar: 'مشروبات',     en: 'Beverage' },
  { value: 'sauce',      ar: 'صلصات',       en: 'Sauce' },
  { value: 'packaging',  ar: 'تعبئة',       en: 'Packaging' },
  { value: 'cleaning',   ar: 'تنظيف',       en: 'Cleaning' },
  { value: 'disposable', ar: 'مستهلكات',    en: 'Disposable' },
  { value: 'other',      ar: 'أخرى',        en: 'Other' },
]

const STORAGE_TEMPS: { value: StorageTemp; ar: string; en: string }[] = [
  { value: 'frozen',   ar: 'مجمد',        en: 'Frozen' },
  { value: 'chilled',  ar: 'مبرد',        en: 'Chilled' },
  { value: 'ambient',  ar: 'درجة الغرفة', en: 'Ambient' },
  { value: 'dry',      ar: 'جاف',         en: 'Dry' },
]

interface IngredientWithAllergens extends IngredientRow {
  allergens: string[]
}

interface Props {
  ingredient?: IngredientWithAllergens
  suppliers: { id: string; name_ar: string; name_en: string | null }[]
  locale: string
  action: (formData: FormData) => Promise<{ error?: string }>
}

const inputClass = 'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none transition-colors'
const labelClass = 'block font-satoshi text-sm font-medium text-brand-text mb-1'
const selectClass = 'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors'

export default function IngredientForm({ ingredient, suppliers, locale, action }: Props) {
  const isAr = locale === 'ar'
  const [allergens, setAllergens] = useState<string[]>(ingredient?.allergens ?? [])
  const [isActive, setIsActive] = useState(ingredient?.is_active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('is_active', isActive ? 'true' : 'false')
    // allergens already added as checkboxes via AllergenSelector
    // but we manage them in state, so delete the ones from the form and add from state
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {ingredient?.id && <input type="hidden" name="id" value={ingredient.id} />}

      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className="font-satoshi text-sm text-brand-error">{error}</p>
        </div>
      )}

      {/* Names */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{isAr ? 'الاسم بالعربية *' : 'Arabic Name *'}</label>
          <input
            type="text"
            name="name_ar"
            required
            defaultValue={ingredient?.name_ar}
            placeholder="مثال: دجاج مشوي"
            className={inputClass}
            dir="rtl"
          />
        </div>
        <div>
          <label className={labelClass}>{isAr ? 'الاسم بالإنجليزية *' : 'English Name *'}</label>
          <input
            type="text"
            name="name_en"
            required
            defaultValue={ingredient?.name_en}
            placeholder="e.g. Grilled Chicken"
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      {/* Unit & Purchase Unit */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>{isAr ? 'وحدة القياس *' : 'Unit *'}</label>
          <select name="unit" required defaultValue={ingredient?.unit ?? 'g'} className={selectClass}>
            {UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{isAr ? 'وحدة الشراء' : 'Purchase Unit'}</label>
          <input
            type="text"
            name="purchase_unit"
            defaultValue={ingredient?.purchase_unit ?? ''}
            placeholder={isAr ? 'مثال: كرتون' : 'e.g. Carton'}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{isAr ? 'معامل التحويل' : 'Purchase Factor'}</label>
          <input
            type="number"
            name="purchase_unit_factor"
            defaultValue={ingredient?.purchase_unit_factor ?? ''}
            step="0.001"
            min="0"
            placeholder="e.g. 1000"
            className={inputClass}
          />
        </div>
      </div>

      {/* Cost & Yield */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>{isAr ? 'التكلفة / وحدة (BD)' : 'Cost / Unit (BD)'}</label>
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
            <span className="absolute end-3 top-1/2 -translate-y-1/2 font-satoshi text-xs text-brand-muted">BD</span>
          </div>
        </div>
        <div>
          <label className={labelClass}>{isAr ? '% التكلفة المثالية' : 'Ideal Cost %'}</label>
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
          <label className={labelClass}>{isAr ? 'معامل الهدر' : 'Yield Factor'}</label>
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
          <label className={labelClass}>{isAr ? 'الفئة' : 'Category'}</label>
          <select name="category" defaultValue={ingredient?.category ?? ''} className={selectClass}>
            <option value="">{isAr ? '— اختر فئة —' : '— Select Category —'}</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{isAr ? c.ar : c.en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{isAr ? 'تصنيف ABC' : 'ABC Class'}</label>
          <select name="abc_class" defaultValue={ingredient?.abc_class ?? 'C'} className={selectClass}>
            <option value="A">A — {isAr ? 'حرج' : 'Critical'}</option>
            <option value="B">B — {isAr ? 'متوسط' : 'Moderate'}</option>
            <option value="C">C — {isAr ? 'منخفض' : 'Low'}</option>
          </select>
        </div>
      </div>

      {/* Stock Levels */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>{isAr ? 'نقطة إعادة الطلب' : 'Reorder Point'}</label>
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
          <label className={labelClass}>{isAr ? 'الحد الأقصى للمخزون' : 'Max Stock Level'}</label>
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
          <label className={labelClass}>{isAr ? 'كمية إعادة الطلب' : 'Reorder Qty'}</label>
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
          <label className={labelClass}>{isAr ? 'مدة الصلاحية (أيام)' : 'Shelf Life (days)'}</label>
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
          <label className={labelClass}>{isAr ? 'درجة التخزين' : 'Storage Temp'}</label>
          <select name="storage_temp" defaultValue={ingredient?.storage_temp ?? ''} className={selectClass}>
            <option value="">{isAr ? '— اختر —' : '— Select —'}</option>
            {STORAGE_TEMPS.map((s) => (
              <option key={s.value} value={s.value}>{isAr ? s.ar : s.en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{isAr ? 'الباركود' : 'Barcode'}</label>
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
        <label className={labelClass}>{isAr ? 'المورد' : 'Supplier'}</label>
        <select name="supplier_id" defaultValue={ingredient?.supplier_id ?? ''} className={selectClass}>
          <option value="">{isAr ? '— بدون مورد —' : '— No Supplier —'}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name_ar}{s.name_en ? ` / ${s.name_en}` : ''}</option>
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
        <span className="font-satoshi text-sm text-brand-text">
          {isAr ? (isActive ? 'نشط' : 'غير نشط') : (isActive ? 'Active' : 'Inactive')}
        </span>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>{isAr ? 'ملاحظات' : 'Notes'}</label>
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
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 disabled:opacity-50 transition-colors"
        >
          {isPending
            ? (isAr ? 'جاري الحفظ...' : 'Saving...')
            : (isAr ? 'حفظ المكوّن' : 'Save Ingredient')}
        </button>
      </div>
    </form>
  )
}
