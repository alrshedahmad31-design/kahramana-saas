'use client'
import { useTransition, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const WASTE_REASONS = [
  { value: 'expired',         labelAr: 'منتهي الصلاحية',     labelEn: 'Expired' },
  { value: 'damaged',         labelAr: 'تالف',               labelEn: 'Damaged' },
  { value: 'spillage',        labelAr: 'انسكاب',             labelEn: 'Spillage' },
  { value: 'overproduction',  labelAr: 'إنتاج زائد',         labelEn: 'Overproduction' },
  { value: 'quality',         labelAr: 'جودة سيئة',          labelEn: 'Bad Quality' },
  { value: 'returned',        labelAr: 'مُرجَّع',             labelEn: 'Returned' },
  { value: 'theft_suspected', labelAr: 'شبهة سرقة',          labelEn: 'Theft Suspected' },
  { value: 'prep_error',      labelAr: 'خطأ في التحضير',     labelEn: 'Prep Error' },
  { value: 'over_portioning', labelAr: 'إفراط في التقديم',   labelEn: 'Over Portioning' },
  { value: 'other',           labelAr: 'أخرى',               labelEn: 'Other' },
] as const

interface Ingredient {
  id: string
  name_ar: string
  name_en: string
  unit: string
  cost_per_unit: number
}

interface Branch {
  id: string
  name_ar: string
}

interface Props {
  branches: Branch[]
  ingredients: Ingredient[]
  locale: string
  action: (formData: FormData) => Promise<{ error?: string }>
  defaultBranchId?: string
}

export default function WasteForm({ branches, ingredients, locale, action, defaultBranchId }: Props) {
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''
  const router = useRouter()

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [quantity, setQuantity] = useState<number>(0)

  const selectedIngredient = useMemo(
    () => ingredients.find((i) => i.id === selectedIngredientId) ?? null,
    [ingredients, selectedIngredientId],
  )

  const estimatedCost = selectedIngredient ? quantity * selectedIngredient.cost_per_unit : 0

  const filteredIngredients = useMemo(() => {
    if (!search.trim()) return ingredients
    const q = search.toLowerCase()
    return ingredients.filter(
      (i) => i.name_ar.includes(q) || i.name_en.toLowerCase().includes(q),
    )
  }, [ingredients, search])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('cost_bhd', estimatedCost.toFixed(3))
    startTransition(async () => {
      const result = await action(fd)
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`${prefix}/dashboard/inventory/waste`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl">
      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className="font-satoshi text-sm text-brand-error">{error}</p>
        </div>
      )}

      {/* Branch */}
      <div className="flex flex-col gap-1.5">
        <label className="font-satoshi text-sm font-medium text-brand-text">
          {isAr ? 'الفرع' : 'Branch'} *
        </label>
        <select
          name="branch_id"
          defaultValue={defaultBranchId ?? ''}
          required
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
        >
          <option value="">{isAr ? 'اختر الفرع' : 'Select branch'}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name_ar}</option>
          ))}
        </select>
      </div>

      {/* Ingredient search */}
      <div className="flex flex-col gap-1.5">
        <label className="font-satoshi text-sm font-medium text-brand-text">
          {isAr ? 'المكوّن' : 'Ingredient'} *
        </label>
        <input
          type="text"
          placeholder={isAr ? 'ابحث عن مكوّن...' : 'Search ingredient...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
        />
        <select
          name="ingredient_id"
          required
          value={selectedIngredientId}
          onChange={(e) => setSelectedIngredientId(e.target.value)}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
          size={Math.min(filteredIngredients.length + 1, 6)}
        >
          <option value="">{isAr ? 'اختر المكوّن' : 'Select ingredient'}</option>
          {filteredIngredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name_ar} ({i.unit})
            </option>
          ))}
        </select>
      </div>

      {/* Quantity */}
      <div className="flex flex-col gap-1.5">
        <label className="font-satoshi text-sm font-medium text-brand-text">
          {isAr ? 'الكمية' : 'Quantity'} {selectedIngredient ? `(${selectedIngredient.unit})` : ''} *
        </label>
        <input
          name="quantity"
          type="number"
          min={0.001}
          step="any"
          required
          value={quantity || ''}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
        />
        {selectedIngredient && quantity > 0 && (
          <p className="font-satoshi text-xs text-brand-gold">
            {isAr ? 'الكلفة التقديرية:' : 'Estimated cost:'} {estimatedCost.toFixed(3)} BD
          </p>
        )}
      </div>

      {/* Hidden cost */}
      <input type="hidden" name="cost_bhd" value={estimatedCost.toFixed(3)} />

      {/* Reason */}
      <div className="flex flex-col gap-1.5">
        <label className="font-satoshi text-sm font-medium text-brand-text">
          {isAr ? 'السبب' : 'Reason'} *
        </label>
        <select
          name="reason"
          required
          defaultValue=""
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
        >
          <option value="">{isAr ? 'اختر السبب' : 'Select reason'}</option>
          {WASTE_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {isAr ? r.labelAr : r.labelEn}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className="font-satoshi text-sm font-medium text-brand-text">
          {isAr ? 'ملاحظات' : 'Notes'}
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder={isAr ? 'تفاصيل إضافية...' : 'Additional details...'}
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
        />
      </div>

      {/* Photo URL */}
      <div className="flex flex-col gap-1.5">
        <label className="font-satoshi text-sm font-medium text-brand-text">
          {isAr ? 'رابط الصورة (اختياري)' : 'Photo URL (optional)'}
        </label>
        <input
          name="photo_url"
          type="url"
          placeholder="https://..."
          className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
        >
          {isPending ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'تسجيل الهدر' : 'Log Waste')}
        </button>
        <a
          href={`${prefix}/dashboard/inventory/waste`}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </a>
      </div>
    </form>
  )
}
