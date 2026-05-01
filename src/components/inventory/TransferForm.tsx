'use client'
import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface Branch {
  id: string
  name_ar: string
}

interface Ingredient {
  id: string
  name_ar: string
  unit: string
}

interface Props {
  branches: Branch[]
  ingredients: Ingredient[]
  stockByBranch: Record<string, Record<string, number>>
  defaultFromBranch?: string
  locale: string
  action: (formData: FormData) => Promise<{ error?: string }>
  onClose: () => void
}

export default function TransferForm({
  branches, ingredients, stockByBranch, defaultFromBranch, locale, action, onClose,
}: Props) {
  const isAr = locale !== 'en'
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [fromBranchId, setFromBranchId] = useState(defaultFromBranch ?? '')
  const [toBranchId, setToBranchId] = useState('')
  const [ingredientId, setIngredientId] = useState('')
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [quantity, setQuantity] = useState<number>(0)

  const toBranches = useMemo(
    () => branches.filter((b) => b.id !== fromBranchId),
    [branches, fromBranchId],
  )

  const filteredIngredients = useMemo(() => {
    if (!ingredientSearch.trim()) return ingredients
    const q = ingredientSearch.toLowerCase()
    return ingredients.filter((i) => i.name_ar.includes(q))
  }, [ingredients, ingredientSearch])

  const availableQty = fromBranchId && ingredientId
    ? (stockByBranch[fromBranchId]?.[ingredientId] ?? 0)
    : null

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId) ?? null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await action(fd)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-brand-surface border border-brand-border rounded-xl w-full max-w-md mx-4 flex flex-col gap-5 p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-cairo text-xl font-black text-brand-text">
            {isAr ? 'تحويل جديد' : 'New Transfer'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
              <p className="font-satoshi text-sm text-brand-error">{error}</p>
            </div>
          )}

          {/* from_branch */}
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'من فرع' : 'From Branch'} *
            </label>
            <select
              name="from_branch_id"
              required
              value={fromBranchId}
              onChange={(e) => {
                setFromBranchId(e.target.value)
                setToBranchId('')
                setIngredientId('')
              }}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            >
              <option value="">{isAr ? 'اختر الفرع' : 'Select branch'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name_ar}</option>
              ))}
            </select>
          </div>

          {/* to_branch */}
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'إلى فرع' : 'To Branch'} *
            </label>
            <select
              name="to_branch_id"
              required
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
              disabled={!fromBranchId}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors disabled:opacity-50"
            >
              <option value="">{isAr ? 'اختر الفرع' : 'Select branch'}</option>
              {toBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name_ar}</option>
              ))}
            </select>
          </div>

          {/* ingredient search + select */}
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'المكوّن' : 'Ingredient'} *
            </label>
            <input
              type="text"
              placeholder={isAr ? 'ابحث...' : 'Search...'}
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            />
            <select
              name="ingredient_id"
              required
              value={ingredientId}
              onChange={(e) => {
                setIngredientId(e.target.value)
                setQuantity(0)
              }}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
              size={Math.min(filteredIngredients.length + 1, 5)}
            >
              <option value="">{isAr ? 'اختر المكوّن' : 'Select ingredient'}</option>
              {filteredIngredients.map((i) => {
                const avail = fromBranchId ? (stockByBranch[fromBranchId]?.[i.id] ?? 0) : null
                return (
                  <option key={i.id} value={i.id}>
                    {i.name_ar} ({i.unit}){avail !== null ? ` — ${isAr ? 'متاح:' : 'avail:'} ${avail}` : ''}
                  </option>
                )
              })}
            </select>
            {availableQty !== null && ingredientId && (
              <p className="font-satoshi text-xs text-brand-gold">
                {isAr ? `المتاح: ${availableQty} ${selectedIngredient?.unit ?? ''}` : `Available: ${availableQty} ${selectedIngredient?.unit ?? ''}`}
              </p>
            )}
          </div>

          {/* quantity */}
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'الكمية' : 'Quantity'} {selectedIngredient ? `(${selectedIngredient.unit})` : ''} *
            </label>
            <input
              name="quantity"
              type="number"
              required
              min={0.001}
              step="any"
              max={availableQty ?? undefined}
              value={quantity || ''}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            />
            {availableQty !== null && quantity > availableQty && (
              <p className="font-satoshi text-xs text-red-400">
                {isAr ? 'الكمية تتجاوز المخزون المتاح' : 'Quantity exceeds available stock'}
              </p>
            )}
          </div>

          {/* notes */}
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'ملاحظات' : 'Notes'}
            </label>
            <textarea
              name="notes"
              rows={2}
              placeholder={isAr ? 'ملاحظات اختيارية...' : 'Optional notes...'}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isPending || (availableQty !== null && quantity > availableQty)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
            >
              {isPending
                ? (isAr ? 'جارٍ التحويل...' : 'Transferring...')
                : (isAr ? 'تحويل' : 'Transfer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
