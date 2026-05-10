'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface Supplier {
  id: string
  name_ar: string
}

interface Branch {
  id: string
  name_ar: string
}

interface Ingredient {
  id: string
  name_ar: string
  unit: string
  cost_per_unit: number
  reorder_qty: number | null
}

interface LowStockSuggestion {
  ingredient_id: string
  name_ar: string
  suggested_order: number | null
  cost_per_unit: number
}

interface LineItem {
  ingredient_id: string
  quantity_ordered: number
  unit_cost: number
  lot_number: string
  expiry_date: string
}

interface Props {
  suppliers: Supplier[]
  branches: Branch[]
  ingredients: Ingredient[]
  lowStockSuggestions?: LowStockSuggestion[]
  locale: string
  action: (formData: FormData) => Promise<{ error?: string; id?: string }>
}

const emptyLine = (): LineItem => ({
  ingredient_id:    '',
  quantity_ordered: 1,
  unit_cost:        0,
  lot_number:       '',
  expiry_date:      '',
})

export default function POForm({
  suppliers, branches, ingredients, lowStockSuggestions, locale, action,
}: Props) {
  const t = useTranslations('inventory.purchases')
  const tCommon = useTranslations('common')
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''
  const router = useRouter()

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<LineItem[]>([emptyLine()])

  const font = isAr ? 'font-almarai' : 'font-satoshi'

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      // Auto-fill unit_cost when ingredient changes
      if (field === 'ingredient_id') {
        const ing = ingredients.find((i) => i.id === value)
        if (ing) next[index].unit_cost = ing.cost_per_unit
      }
      return next
    })
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function fillFromSuggestions() {
    if (!lowStockSuggestions?.length) return
    const suggested: LineItem[] = lowStockSuggestions
      .filter((s) => s.suggested_order && s.suggested_order > 0)
      .map((s) => ({
        ingredient_id:    s.ingredient_id,
        quantity_ordered: s.suggested_order ?? 1,
        unit_cost:        s.cost_per_unit,
        lot_number:       '',
        expiry_date:      '',
      }))
    if (suggested.length > 0) setLines(suggested)
  }

  const grandTotal = lines.reduce(
    (sum, l) => sum + l.quantity_ordered * l.unit_cost,
    0,
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const validLines = lines.filter((l) => l.ingredient_id && l.quantity_ordered > 0)
    fd.set('items', JSON.stringify(validLines))
    startTransition(async () => {
      const result = await action(fd)
      if (result.error) {
        setError(result.error)
      } else if (result.id) {
        router.push(`${prefix}/dashboard/inventory/purchases/${result.id}`)
      } else {
        router.push(`${prefix}/dashboard/inventory/purchases`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className={`${font} text-sm text-brand-error`}>{error}</p>
        </div>
      )}

      {/* PO meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <div className="flex flex-col gap-1.5">
          <label className={`${font} text-sm font-medium text-brand-text`}>
            {t('supplier')} *
          </label>
          <select
            name="supplier_id"
            required
            defaultValue=""
            className={`w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
          >
            <option value="">{t('selectSupplier')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name_ar}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={`${font} text-sm font-medium text-brand-text`}>
            {t('branch')} *
          </label>
          <select
            name="branch_id"
            required
            defaultValue=""
            className={`w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
          >
            <option value="">{t('selectBranch')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name_ar}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={`${font} text-sm font-medium text-brand-text`}>
            {t('expectedDelivery')}
          </label>
          <input
            name="expected_at"
            type="date"
            className={`w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={`${font} text-sm font-medium text-brand-text`}>
            {t('notes')}
          </label>
          <input
            name="notes"
            type="text"
            placeholder={t('optionalNotes')}
            className={`w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-cairo text-lg font-bold text-brand-text">
            {t('orderItems')}
          </h2>
          <div className="flex gap-2">
            {lowStockSuggestions && lowStockSuggestions.length > 0 && (
              <button
                type="button"
                onClick={fillFromSuggestions}
                className={`inline-flex items-center gap-2 rounded-lg border border-brand-gold px-3 py-1.5 ${font} text-sm font-medium text-brand-gold hover:bg-brand-gold/10 transition-colors`}
              >
                {t('autoSuggest')}
              </button>
            )}
            <button
              type="button"
              onClick={addLine}
              className={`inline-flex items-center gap-2 rounded-lg border border-brand-border px-3 py-1.5 ${font} text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors`}
            >
              {t('addItem')}
            </button>
          </div>
        </div>

        <div className="border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-brand-surface-2">
              <tr>
                <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>
                  {t('ingredient')}
                </th>
                <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>
                  {t('qty')}
                </th>
                <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>
                  {t('unitCost')}
                </th>
                <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>
                  {t('total')}
                </th>
                <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>
                  {t('lotNumber')}
                </th>
                <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>
                  {t('expiry')}
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const lineTotal = line.quantity_ordered * line.unit_cost
                const ing = ingredients.find((i) => i.id === line.ingredient_id)
                return (
                  <tr key={index} className="border-t border-brand-border">
                    <td className="px-3 py-2">
                      <select
                        value={line.ingredient_id}
                        onChange={(e) => updateLine(index, 'ingredient_id', e.target.value)}
                        className={`w-40 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
                      >
                        <option value="">{t('select')}</option>
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name_ar} ({i.unit})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={line.quantity_ordered}
                        onChange={(e) => updateLine(index, 'quantity_ordered', Number(e.target.value))}
                        className={`w-20 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
                      />
                      {ing && <span className={`ms-1 ${font} text-xs text-brand-muted`}>{ing.unit}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        value={line.unit_cost}
                        onChange={(e) => updateLine(index, 'unit_cost', Number(e.target.value))}
                        className={`w-24 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
                      />
                    </td>
                    <td className={`px-3 py-2 ${font} text-sm text-brand-gold font-semibold`}>
                      {lineTotal.toFixed(3)} {tCommon('currency')}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.lot_number}
                        onChange={(e) => updateLine(index, 'lot_number', e.target.value)}
                        placeholder={t('lotNumber')}
                        className={`w-24 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 ${font} text-xs text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={line.expiry_date}
                        onChange={(e) => updateLine(index, 'expiry_date', e.target.value)}
                        className={`w-32 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 ${font} text-xs text-brand-text focus:border-brand-gold focus:outline-none transition-colors`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className={`${font} text-xs text-red-400 hover:text-red-300 transition-colors`}
                        >
                          {t('remove')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Grand total */}
        <div className="flex justify-end">
          <div className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3 flex items-center gap-3">
            <p className={`${font} text-sm text-brand-muted`}>
              {t('grandTotal')}
            </p>
            <p className="font-cairo text-xl font-black text-brand-gold">
              {grandTotal.toFixed(3)} {tCommon('currency')}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className={`inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 ${font} text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50`}
        >
          {isPending ? t('creating') : t('create')}
        </button>
        <a
          href={`${prefix}/dashboard/inventory/purchases`}
          className={`inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 ${font} text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors`}
        >
          {t('cancel')}
        </a>
      </div>
    </form>
  )
}

