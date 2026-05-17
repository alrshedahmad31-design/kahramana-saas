'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { RecipeRow } from '@/lib/supabase/custom-types'
import { useTranslations } from 'next-intl'
import { Icon } from '@/components/ui/Icon'

export interface RecipeRowInput {
  ingredient_id?: string | null
  prep_item_id?: string | null
  quantity: number
  yield_factor?: number | null
  variant_key?: string | null
  is_optional?: boolean
}

interface ExistingIngredientRow extends RecipeRow {
  ingredient_name_ar: string
  ingredient_unit: string
  ingredient_cost: number
}

interface ExistingPrepRow extends RecipeRow {
  prep_item_name_ar: string
  prep_item_unit: string
}

interface Props {
  slug: string
  dishName: string
  dishPrice: number | null
  existingIngredients: ExistingIngredientRow[]
  existingPrepItems: ExistingPrepRow[]
  allIngredients: { id: string; name_ar: string; unit: string; cost_per_unit: number }[]
  allPrepItems: { id: string; name_ar: string; unit: string }[]
  saveAction: (slug: string, rows: RecipeRowInput[]) => Promise<{ error?: string }>
  locale: string
}

interface IngRow {
  key: string
  ingredient_id: string
  quantity: number
  yield_factor: number
  is_optional: boolean
}

interface PrepRow {
  key: string
  prep_item_id: string
  quantity: number
  yield_factor: number
  is_optional: boolean
}

let keyCounter = 0
function nextKey() { return `k${++keyCounter}` }

export default function RecipeEditor({
  slug, dishName, dishPrice,
  existingIngredients, existingPrepItems,
  allIngredients, allPrepItems,
  saveAction, locale
}: Props) {
  const t = useTranslations('inventory.recipes')
  const tInv = useTranslations('inventory')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const prefix = locale === 'en' ? '/en' : ''
  const catalogEmpty = allIngredients.length === 0

  const [ingRows, setIngRows] = useState<IngRow[]>(() =>
    existingIngredients.map((r) => ({
      key: nextKey(),
      ingredient_id: r.ingredient_id!,
      quantity: r.quantity,
      yield_factor: r.yield_factor ?? 1,
      is_optional: r.is_optional,
    }))
  )

  const [prepRows, setPrepRows] = useState<PrepRow[]>(() =>
    existingPrepItems.map((r) => ({
      key: nextKey(),
      prep_item_id: r.prep_item_id!,
      quantity: r.quantity,
      yield_factor: r.yield_factor ?? 1,
      is_optional: r.is_optional,
    }))
  )

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const ingMap = new Map(allIngredients.map((i) => [i.id, i]))

  // COGS calculation
  const cogs = ingRows.reduce((sum, row) => {
    const ing = ingMap.get(row.ingredient_id)
    if (!ing) return sum
    return sum + row.quantity * row.yield_factor * ing.cost_per_unit
  }, 0)

  const margin = dishPrice && dishPrice > 0
    ? ((dishPrice - cogs) / dishPrice) * 100
    : null

  function marginColor(m: number | null): string {
    if (m === null) return 'text-brand-muted'
    if (m >= 60) return 'text-green-400'
    if (m >= 40) return 'text-brand-gold'
    return 'text-red-400'
  }

  function addIngRow() {
    const first = allIngredients[0]
    if (!first) return
    setIngRows((rows) => [...rows, { key: nextKey(), ingredient_id: first.id, quantity: 1, yield_factor: 1, is_optional: false }])
  }

  function removeIngRow(key: string) {
    setIngRows((rows) => rows.filter((r) => r.key !== key))
  }

  function updateIngRow(key: string, patch: Partial<IngRow>) {
    setIngRows((rows) => rows.map((r) => r.key === key ? { ...r, ...patch } : r))
  }

  function addPrepRow() {
    const first = allPrepItems[0]
    if (!first) return
    setPrepRows((rows) => [...rows, { key: nextKey(), prep_item_id: first.id, quantity: 1, yield_factor: 1, is_optional: false }])
  }

  function removePrepRow(key: string) {
    setPrepRows((rows) => rows.filter((r) => r.key !== key))
  }

  function updatePrepRow(key: string, patch: Partial<PrepRow>) {
    setPrepRows((rows) => rows.map((r) => r.key === key ? { ...r, ...patch } : r))
  }

  function handleSave() {
    const rows: RecipeRowInput[] = [
      ...ingRows.map((r) => ({
        ingredient_id: r.ingredient_id,
        prep_item_id: null,
        quantity: r.quantity,
        yield_factor: r.yield_factor,
        is_optional: r.is_optional,
      })),
      ...prepRows.map((r) => ({
        ingredient_id: null,
        prep_item_id: r.prep_item_id,
        quantity: r.quantity,
        yield_factor: r.yield_factor,
        is_optional: r.is_optional,
      })),
    ]

    startTransition(async () => {
      const result = await saveAction(slug, rows)
      if (result.error) {
        setError(result.error)
      } else {
        setError(null)
      }
    })
  }

  const inputSm = `rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors w-full`
  const selectSm = `rounded-lg border border-brand-border bg-brand-surface px-2 py-1.5 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors w-full`

  return (
    <div className="flex flex-col gap-6">
      {/* Header + COGS */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-cairo text-xl font-black text-brand-text">{dishName}</h2>
          {dishPrice !== null && (
            <p className={`${font} text-sm text-brand-muted mt-0.5`}>
              {t('price')}: <span className="text-brand-text font-medium">{dishPrice.toFixed(3)} {tCommon('currency')}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-end">
            <p className={`${font} text-xs text-brand-muted uppercase tracking-wide`}>
              {t('dishCost')}
            </p>
            <p className="font-cairo text-lg font-black text-brand-gold">{cogs.toFixed(3)} {tCommon('currency')}</p>
          </div>
          {margin !== null && (
            <div className="text-end">
              <p className={`${font} text-xs text-brand-muted uppercase tracking-wide`}>
                {t('margin')}
              </p>
              <p className={`font-cairo text-lg font-black ${marginColor(margin)}`}>
                {margin.toFixed(1)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className={`${font} text-sm text-brand-error`}>{error}</p>
        </div>
      )}

      {/* Ingredient Rows */}
      <div>
        {/* Empty-catalog notice — shown above the add button so the user knows
            why it is disabled and where to go to populate the catalog. */}
        {catalogEmpty && (
          <div
            className={`mb-3 flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2 ${font} text-sm text-brand-muted`}
          >
            <span>{tInv('recipeNoIngredients')}</span>
            <Link
              href={`${prefix}/dashboard/inventory/ingredients/new`}
              className="inline-flex items-center gap-1 text-brand-gold hover:underline"
              aria-label={tInv('recipeNoIngredients')}
            >
              <Icon name={isAr ? 'arrow-left' : 'arrow-right'} size={14} />
            </Link>
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-cairo text-base font-bold text-brand-text">
            {t('directIngredients')}
          </h3>
          <button
            type="button"
            onClick={addIngRow}
            disabled={catalogEmpty}
            className={`inline-flex items-center gap-2 rounded-lg border border-brand-border px-3 py-1.5 ${font} text-sm text-brand-muted transition-colors hover:border-brand-gold hover:text-brand-gold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-brand-border disabled:hover:text-brand-muted`}
          >
            <span>+</span>
            {t('addIngredient')}
          </button>
        </div>

        {ingRows.length === 0 ? (
          <p className={`${font} text-sm text-brand-muted italic`}>
            {t('noDirectIngredients')}
          </p>
        ) : (
          <div className="border border-brand-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-brand-surface-2">
                <tr>
                  <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('ingredient')}</th>
                  <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('qty')}</th>
                  <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('yield')}</th>
                  <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('optional')}</th>
                  <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('cost')}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {ingRows.map((row) => {
                  const ing = ingMap.get(row.ingredient_id)
                  const rowCost = ing ? row.quantity * row.yield_factor * ing.cost_per_unit : 0
                  return (
                    <tr key={row.key} className="border-t border-brand-border">
                      <td className="px-3 py-2 min-w-[160px]">
                        <select
                          value={row.ingredient_id}
                          onChange={(e) => updateIngRow(row.key, { ingredient_id: e.target.value })}
                          className={selectSm}
                        >
                          {allIngredients.map((i) => (
                            <option key={i.id} value={i.id}>{i.name_ar} ({i.unit})</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 w-24">
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) => updateIngRow(row.key, { quantity: Number(e.target.value) })}
                          step="0.001"
                          min="0"
                          className={inputSm}
                        />
                      </td>
                      <td className="px-3 py-2 w-24">
                        <input
                          type="number"
                          value={row.yield_factor}
                          onChange={(e) => updateIngRow(row.key, { yield_factor: Number(e.target.value) })}
                          step="0.001"
                          min="1"
                          className={inputSm}
                        />
                      </td>
                      <td className="px-3 py-2 w-16 text-center">
                        <input
                          type="checkbox"
                          checked={row.is_optional}
                          onChange={(e) => updateIngRow(row.key, { is_optional: e.target.checked })}
                          className="w-4 h-4 accent-brand-gold"
                        />
                      </td>
                      <td className="px-3 py-2 w-24">
                        <span className={`${font} text-xs text-brand-muted`}>{rowCost.toFixed(3)}</span>
                      </td>
                      <td className="px-3 py-2 w-10">
                        <button
                          type="button"
                          onClick={() => removeIngRow(row.key)}
                          className="text-brand-muted hover:text-brand-error transition-colors"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Prep Item Rows */}
      {allPrepItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-cairo text-base font-bold text-brand-text">
              {t('prepItems')}
            </h3>
            <button
              type="button"
              onClick={addPrepRow}
              className={`inline-flex items-center gap-2 rounded-lg border border-brand-border px-3 py-1.5 ${font} text-sm text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors`}
            >
              <span>+</span>
              {t('addPrepItem')}
            </button>
          </div>

          {prepRows.length > 0 && (
            <div className="border border-brand-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="bg-brand-surface-2">
                  <tr>
                    <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('prepItems')}</th>
                    <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('qty')}</th>
                    <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('yield')}</th>
                    <th className={`px-3 py-2 text-start ${font} text-xs text-brand-muted uppercase tracking-wide`}>{t('optional')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {prepRows.map((row) => {
                    const _prep = allPrepItems.find((p) => p.id === row.prep_item_id)
                    return (
                      <tr key={row.key} className="border-t border-brand-border">
                        <td className="px-3 py-2 min-w-[160px]">
                          <select
                            value={row.prep_item_id}
                            onChange={(e) => updatePrepRow(row.key, { prep_item_id: e.target.value })}
                            className={selectSm}
                          >
                            {allPrepItems.map((p) => (
                              <option key={p.id} value={p.id}>{p.name_ar} ({p.unit})</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 w-24">
                          <input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => updatePrepRow(row.key, { quantity: Number(e.target.value) })}
                            step="0.001"
                            min="0"
                            className={inputSm}
                          />
                        </td>
                        <td className="px-3 py-2 w-24">
                          <input
                            type="number"
                            value={row.yield_factor}
                            onChange={(e) => updatePrepRow(row.key, { yield_factor: Number(e.target.value) })}
                            step="0.001"
                            min="1"
                            className={inputSm}
                          />
                        </td>
                        <td className="px-3 py-2 w-16 text-center">
                          <input
                            type="checkbox"
                            checked={row.is_optional}
                            onChange={(e) => updatePrepRow(row.key, { is_optional: e.target.checked })}
                            className="w-4 h-4 accent-brand-gold"
                          />
                        </td>
                        <td className="px-3 py-2 w-10">
                          <button
                            type="button"
                            onClick={() => removePrepRow(row.key)}
                            className="text-brand-muted hover:text-brand-error transition-colors"
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-brand-border">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className={`inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 ${font} text-sm font-semibold text-brand-black hover:bg-brand-gold/90 disabled:opacity-50 transition-colors`}
        >
          {isPending ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}

