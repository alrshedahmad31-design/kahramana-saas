'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ReceiveLine {
  id: string
  quantity_received: number
  lot_number?: string
  expiry_date?: string
  quality_rating?: number
  discrepancy_note?: string
}

interface POItem {
  id: string
  ingredient_name_ar: string
  unit: string
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  lot_number: string | null
  expiry_date: string | null
  quality_rating: number | null
}

interface Props {
  poId: string
  items: POItem[]
  locale: string
  receiveAction: (poId: string, lines: ReceiveLine[]) => Promise<{ error?: string }>
}

export default function POReceiveForm({ poId, items, locale, receiveAction }: Props) {
  const isAr = locale !== 'en'
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [lines, setLines] = useState<ReceiveLine[]>(
    items.map((item) => ({
      id:                item.id,
      quantity_received: item.quantity_ordered,
      lot_number:        item.lot_number ?? '',
      expiry_date:       item.expiry_date ?? '',
      quality_rating:    item.quality_rating ?? undefined,
      discrepancy_note:  '',
    })),
  )

  function updateLine<K extends keyof ReceiveLine>(
    index: number,
    field: K,
    value: ReceiveLine[K],
  ) {
    setLines((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await receiveAction(poId, lines)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-4">
      <h2 className="font-cairo text-lg font-bold text-brand-text">
        {isAr ? 'استلام الطلب' : 'Receive Order'}
      </h2>

      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className="font-satoshi text-sm text-brand-error">{error}</p>
        </div>
      )}

      <div className="border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-brand-surface-2">
            <tr>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'المكوّن' : 'Ingredient'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'مطلوب' : 'Ordered'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'مستلم' : 'Received'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الفرق' : 'Variance'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'رقم الدفعة' : 'Lot #'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'تاريخ الانتهاء' : 'Expiry'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الجودة' : 'Quality'}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const line = lines[index]
              const variance = (line?.quantity_received ?? 0) - item.quantity_ordered
              return (
                <tr key={item.id} className="border-t border-brand-border">
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                    {item.ingredient_name_ar}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                    {item.quantity_ordered} {item.unit}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={line?.quantity_received ?? item.quantity_ordered}
                      onChange={(e) =>
                        updateLine(index, 'quantity_received', Number(e.target.value))
                      }
                      className="w-24 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
                    />
                  </td>
                  <td className={`px-4 py-3 font-satoshi text-sm font-semibold ${
                    variance < 0 ? 'text-red-400' : variance > 0 ? 'text-brand-gold' : 'text-green-400'
                  }`}>
                    {variance >= 0 ? '+' : ''}{variance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={line?.lot_number ?? ''}
                      onChange={(e) => updateLine(index, 'lot_number', e.target.value)}
                      placeholder={isAr ? 'رقم الدفعة' : 'Lot #'}
                      className="w-24 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={line?.expiry_date ?? ''}
                      onChange={(e) => updateLine(index, 'expiry_date', e.target.value)}
                      className="w-32 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {/* Star rating 1–5 */}
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => updateLine(index, 'quality_rating', star)}
                          className={`text-lg transition-colors ${
                            (line?.quality_rating ?? 0) >= star
                              ? 'text-brand-gold'
                              : 'text-brand-muted'
                          }`}
                          aria-label={`${star} stars`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
        >
          {isPending
            ? (isAr ? 'جارٍ الاستلام...' : 'Receiving...')
            : (isAr ? 'استلام الطلب' : 'Receive Order')}
        </button>
      </div>
    </div>
  )
}
