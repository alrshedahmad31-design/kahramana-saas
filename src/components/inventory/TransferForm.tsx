'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface Branch {
  id: string
  name_ar: string
}

interface Ingredient {
  id: string
  name_ar: string
  name_en?: string
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
  const t = useTranslations('inventory.transfers')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
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
    return ingredients.filter((i) =>
      i.name_ar.includes(q) || (i.name_en?.toLowerCase().includes(q) ?? false)
    )
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

  const inputClass = `w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`
  const labelClass = `${font} text-sm font-medium text-brand-text`

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-brand-surface border border-brand-border rounded-xl w-full max-w-md flex flex-col gap-5 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <h2 className="font-cairo text-xl font-black text-brand-text">
            {t('newTransfer')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brand-surface-2 text-brand-muted hover:text-brand-text transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
              <p className={`${font} text-sm text-brand-error`}>{error}</p>
            </div>
          )}

          {/* from_branch */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              {t('fromBranch')} *
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
              className={inputClass}
            >
              <option value="">{t('selectBranch')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name_ar}</option>
              ))}
            </select>
          </div>

          {/* to_branch */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              {t('toBranch')} *
            </label>
            <select
              name="to_branch_id"
              required
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
              disabled={!fromBranchId}
              className={inputClass + ' disabled:opacity-50'}
            >
              <option value="">{t('selectBranch')}</option>
              {toBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name_ar}</option>
              ))}
            </select>
          </div>

          {/* ingredient search + select */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              {t('ingredient')} *
            </label>
            <input
              type="text"
              placeholder={t('search')}
              value={ingredientSearch}
              onChange={(e) => setIngredientSearch(e.target.value)}
              className={inputClass}
            />
            <select
              name="ingredient_id"
              required
              value={ingredientId}
              onChange={(e) => {
                setIngredientId(e.target.value)
                setQuantity(0)
              }}
              className={inputClass}
              size={Math.min(filteredIngredients.length + 1, 5)}
            >
              <option value="">{t('selectIngredient')}</option>
              {filteredIngredients.map((i) => {
                const avail = fromBranchId ? (stockByBranch[fromBranchId]?.[i.id] ?? 0) : null
                return (
                  <option key={i.id} value={i.id}>
                    {isAr ? i.name_ar : i.name_en} ({i.unit}){avail !== null ? ` — ${t('availShort')} ${avail}` : ''}
                  </option>
                )
              })}
            </select>
            {availableQty !== null && ingredientId && (
              <p className={`${font} text-xs text-brand-gold`}>
                {t('available')} {availableQty} {selectedIngredient?.unit ?? ''}
              </p>
            )}
          </div>

          {/* quantity */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              {t('quantity')} {selectedIngredient ? `(${selectedIngredient.unit})` : ''} *
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
              className={inputClass}
            />
            {availableQty !== null && quantity > availableQty && (
              <p className={`${font} text-xs text-red-400`}>
                {t('exceedsStock')}
              </p>
            )}
          </div>

          {/* notes */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>
              {t('notes')}
            </label>
            <textarea
              name="notes"
              rows={2}
              placeholder={t('optionalNotes')}
              className={inputClass + ' resize-none'}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg border border-brand-border px-4 py-2 ${font} text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending || (availableQty !== null && quantity > availableQty)}
              className={`rounded-lg bg-brand-gold px-6 py-2 ${font} text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50`}
            >
              {isPending ? t('transferring') : t('transfer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

