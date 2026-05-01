'use client'

import { useState, useTransition } from 'react'

interface Ingredient {
  id: string
  name_ar: string
  name_en: string
  unit: string
}

interface Props {
  branchId: string
  ingredients: Ingredient[]
  locale: string
  recordAction: (branchId: string, ingredientId: string, quantity: number) => Promise<{ error?: string }>
}

export default function OpeningBalanceModal({ branchId, ingredients, locale, recordAction }: Props) {
  const isAr = locale === 'ar'
  const [open, setOpen] = useState(false)
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '')
  const [quantity, setQuantity] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await recordAction(branchId, ingredientId, quantity)
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        setQuantity(0)
      }
    })
  }

  const selectedIng = ingredients.find((i) => i.id === ingredientId)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
      >
        {isAr ? 'تسوية افتتاحية' : 'Opening Balance'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-black/60 backdrop-blur-sm">
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            className="w-full max-w-md bg-brand-surface border border-brand-border rounded-xl p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-cairo text-lg font-black text-brand-text">
                {isAr ? 'تسوية افتتاحية' : 'Opening Balance'}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-brand-muted hover:text-brand-text transition-colors"
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

              <div>
                <label className="block font-satoshi text-sm font-medium text-brand-text mb-1">
                  {isAr ? 'المكوّن' : 'Ingredient'}
                </label>
                <select
                  value={ingredientId}
                  onChange={(e) => setIngredientId(e.target.value)}
                  className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
                >
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name_ar} ({i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-satoshi text-sm font-medium text-brand-text mb-1">
                  {isAr ? `الكمية (${selectedIng?.unit ?? ''})` : `Quantity (${selectedIng?.unit ?? ''})`}
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  step="0.001"
                  min="0"
                  required
                  className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-brand-gold px-5 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 disabled:opacity-50 transition-colors"
                >
                  {isPending ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
