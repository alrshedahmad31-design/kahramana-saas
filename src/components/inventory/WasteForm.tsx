'use client'
import { useTransition, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations('inventory.waste')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
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

  const reasons = [
    'expired', 'damaged', 'spillage', 'overproduction', 'quality',
    'returned', 'theft_suspected', 'prep_error', 'over_portioning', 'other'
  ]

  const inputClass = `w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`
  const labelClass = `${font} text-sm font-medium text-brand-text`

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-xl">
      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className={`${font} text-sm text-brand-error`}>{error}</p>
        </div>
      )}

      {/* Branch */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          {t('branch')} *
        </label>
        <select
          name="branch_id"
          defaultValue={defaultBranchId ?? ''}
          required
          className={inputClass}
        >
          <option value="">{t('selectBranch')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name_ar}</option>
          ))}
        </select>
      </div>

      {/* Ingredient search */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          {t('ingredient')} *
        </label>
        <input
          type="text"
          placeholder={t('searchIngredient')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
        />
        <select
          name="ingredient_id"
          required
          value={selectedIngredientId}
          onChange={(e) => setSelectedIngredientId(e.target.value)}
          className={inputClass}
          size={Math.min(filteredIngredients.length + 1, 6)}
        >
          <option value="">{t('selectIngredient')}</option>
          {filteredIngredients.map((i) => (
            <option key={i.id} value={i.id}>
              {isAr ? i.name_ar : i.name_en} ({i.unit})
            </option>
          ))}
        </select>
      </div>

      {/* Quantity */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          {t('quantity')} {selectedIngredient ? `(${selectedIngredient.unit})` : ''} *
        </label>
        <input
          name="quantity"
          type="number"
          min={0.001}
          step="any"
          required
          value={quantity || ''}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className={inputClass}
        />
        {selectedIngredient && quantity > 0 && (
          <p className={`${font} text-xs text-brand-gold`}>
            {t('estimatedCost')} {estimatedCost.toFixed(3)} {tCommon('currency')}
          </p>
        )}
      </div>

      {/* Hidden cost */}
      <input type="hidden" name="cost_bhd" value={estimatedCost.toFixed(3)} />

      {/* Reason */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          {t('reason')} *
        </label>
        <select
          name="reason"
          required
          defaultValue=""
          className={inputClass}
        >
          <option value="">{t('selectReason')}</option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {t(`reasons.${r}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          {t('notes')}
        </label>
        <textarea
          name="notes"
          rows={3}
          placeholder={t('additionalDetails')}
          className={inputClass}
        />
      </div>

      {/* Photo URL */}
      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          {t('photoUrl')}
        </label>
        <input
          name="photo_url"
          type="url"
          placeholder="https://..."
          className={inputClass}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className={`inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 ${font} text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50`}
        >
          {isPending ? t('saving') : t('logWaste')}
        </button>
        <a
          href={`${prefix}/dashboard/inventory/waste`}
          className={`inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 ${font} text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors`}
        >
          {t('cancel')}
        </a>
      </div>
    </form>
  )
}

