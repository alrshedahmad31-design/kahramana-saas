'use client'

import { useState, useTransition } from 'react'
import type { PrepItemRow, PrepUnit } from '@/lib/supabase/custom-types'

const PREP_UNIT_LABELS: { value: PrepUnit; ar: string; en: string }[] = [
  { value: 'g',       ar: 'غرام',  en: 'g' },
  { value: 'kg',      ar: 'كغم',   en: 'kg' },
  { value: 'ml',      ar: 'مل',    en: 'ml' },
  { value: 'l',       ar: 'لتر',   en: 'L' },
  { value: 'unit',    ar: 'وحدة',  en: 'unit' },
  { value: 'portion', ar: 'حصة',   en: 'portion' },
  { value: 'batch',   ar: 'دفعة',  en: 'batch' },
]

const STORAGE_TEMPS = [
  { value: 'frozen',  ar: 'مجمد',        en: 'Frozen' },
  { value: 'chilled', ar: 'مبرد',        en: 'Chilled' },
  { value: 'ambient', ar: 'درجة الغرفة', en: 'Ambient' },
] as const

interface Props {
  prepItem?: PrepItemRow
  locale: string
  action: (formData: FormData) => Promise<{ error?: string }>
}

const inputClass = 'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none transition-colors'
const labelClass = 'block font-satoshi text-sm font-medium text-brand-text mb-1'
const selectClass = 'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors'

export default function PrepItemForm({ prepItem, locale, action }: Props) {
  const isAr = locale === 'ar'
  const [isActive, setIsActive] = useState(prepItem?.is_active ?? true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('is_active', isActive ? 'true' : 'false')

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
      {prepItem?.id && <input type="hidden" name="id" value={prepItem.id} />}

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
            defaultValue={prepItem?.name_ar}
            placeholder="مثال: صلصة الطماطم"
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
            defaultValue={prepItem?.name_en}
            placeholder="e.g. Tomato Sauce"
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      {/* Unit & Batch Yield */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{isAr ? 'وحدة القياس *' : 'Unit *'}</label>
          <select name="unit" required defaultValue={prepItem?.unit ?? 'kg'} className={selectClass}>
            {PREP_UNIT_LABELS.map((u) => (
              <option key={u.value} value={u.value}>{isAr ? u.ar : u.en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{isAr ? 'إنتاج الدفعة *' : 'Batch Yield *'}</label>
          <input
            type="number"
            name="batch_yield_qty"
            required
            defaultValue={prepItem?.batch_yield_qty ?? ''}
            step="0.001"
            min="0.001"
            placeholder="1.000"
            className={inputClass}
          />
        </div>
      </div>

      {/* Shelf Life & Storage */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>{isAr ? 'مدة الصلاحية (ساعات)' : 'Shelf Life (hours)'}</label>
          <input
            type="number"
            name="shelf_life_hours"
            defaultValue={prepItem?.shelf_life_hours ?? ''}
            step="1"
            min="0"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{isAr ? 'درجة التخزين' : 'Storage Temp'}</label>
          <select name="storage_temp" defaultValue={prepItem?.storage_temp ?? ''} className={selectClass}>
            <option value="">{isAr ? '— اختر —' : '— Select —'}</option>
            {STORAGE_TEMPS.map((s) => (
              <option key={s.value} value={s.value}>{isAr ? s.ar : s.en}</option>
            ))}
          </select>
        </div>
      </div>

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
          defaultValue={prepItem?.notes ?? ''}
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
            : (isAr ? 'حفظ Prep Item' : 'Save Prep Item')}
        </button>
      </div>
    </form>
  )
}
