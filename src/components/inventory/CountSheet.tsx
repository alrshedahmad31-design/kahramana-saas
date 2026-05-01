'use client'
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Branch {
  id: string
  name_ar: string
}

interface StockItem {
  ingredient_id: string
  name_ar: string
  unit: string
  on_hand: number
  barcode: string | null
}

interface Props {
  branches: Branch[]
  stockItems: StockItem[]
  locale: string
  action: (
    sessionName: string,
    branchId: string,
    counts: { ingredient_id: string; system_qty: number; actual_qty: number }[],
  ) => Promise<{ error?: string }>
}

function generateSessionName() {
  const d = new Date()
  const date = d.toISOString().slice(0, 10)
  const suffix = Math.random().toString(36).slice(2, 5)
  return `${date}-${suffix}`
}

export default function CountSheet({ branches, stockItems, locale, action }: Props) {
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Step 1
  const [branchId, setBranchId] = useState('')
  const [sessionName, setSessionName] = useState(generateSessionName)

  // Step 2
  const [barcodeFilter, setBarcodeFilter] = useState('')
  const [actuals, setActuals] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of stockItems) {
      init[item.ingredient_id] = item.on_hand
    }
    return init
  })

  const filteredItems = useMemo(() => {
    if (!barcodeFilter.trim()) return stockItems
    const q = barcodeFilter.toLowerCase()
    return stockItems.filter(
      (i) =>
        i.barcode?.toLowerCase().includes(q) ||
        i.name_ar.includes(q),
    )
  }, [stockItems, barcodeFilter])

  function varianceColor(actual: number, system: number) {
    const v = actual - system
    if (v === 0) return 'text-green-400'
    if (v < 0) return 'text-red-400'
    return 'text-brand-gold'
  }

  const counts = useMemo(
    () =>
      stockItems.map((item) => ({
        ingredient_id: item.ingredient_id,
        system_qty:    item.on_hand,
        actual_qty:    actuals[item.ingredient_id] ?? item.on_hand,
      })),
    [stockItems, actuals],
  )

  const variantItems = counts.filter((c) => c.actual_qty !== c.system_qty)

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await action(sessionName, branchId, counts)
      if (result.error) {
        setError(result.error)
      } else {
        router.push(`${prefix}/dashboard/inventory/count`)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-satoshi text-xs font-bold ${
                step === s
                  ? 'bg-brand-gold text-brand-black'
                  : step > s
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-brand-surface-2 text-brand-muted'
              }`}
            >
              {s}
            </div>
            {s < 3 && <div className="w-8 h-px bg-brand-border" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
          <p className="font-satoshi text-sm text-brand-error">{error}</p>
        </div>
      )}

      {/* Step 1: Branch + session name */}
      {step === 1 && (
        <div className="flex flex-col gap-5 max-w-md">
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'الفرع' : 'Branch'} *
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            >
              <option value="">{isAr ? 'اختر الفرع' : 'Select branch'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name_ar}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'اسم الجلسة' : 'Session Name'} *
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              required
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            />
            <p className="font-satoshi text-xs text-brand-muted">
              {isAr ? 'يُنشأ تلقائياً — يمكنك تعديله' : 'Auto-generated — you can edit it'}
            </p>
          </div>

          <button
            type="button"
            disabled={!branchId || !sessionName}
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50 w-fit"
          >
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      )}

      {/* Step 2: Count table */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder={isAr ? 'تصفية بالباركود أو الاسم...' : 'Filter by barcode or name...'}
              value={barcodeFilter}
              onChange={(e) => setBarcodeFilter(e.target.value)}
              className="w-full max-w-xs rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            />
          </div>

          <div className="border border-brand-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-surface-2">
                <tr>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'المكوّن' : 'Ingredient'}
                  </th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'نظام' : 'System'}
                  </th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'فعلي' : 'Actual'}
                  </th>
                  <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                    {isAr ? 'الفرق' : 'Variance'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const actual = actuals[item.ingredient_id] ?? item.on_hand
                  const variance = actual - item.on_hand
                  return (
                    <tr
                      key={item.ingredient_id}
                      className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors"
                    >
                      <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                        {item.name_ar}
                        {item.barcode && (
                          <span className="ms-2 font-satoshi text-xs text-brand-muted">
                            {item.barcode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                        {item.on_hand} {item.unit}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={actual}
                          onChange={(e) =>
                            setActuals((prev) => ({
                              ...prev,
                              [item.ingredient_id]: Number(e.target.value),
                            }))
                          }
                          className="w-24 rounded-lg border border-brand-border bg-brand-surface px-2 py-1 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
                        />
                      </td>
                      <td className={`px-4 py-3 font-satoshi text-sm font-semibold ${varianceColor(actual, item.on_hand)}`}>
                        {variance >= 0 ? '+' : ''}{variance.toFixed(2)} {item.unit}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              {isAr ? 'السابق' : 'Back'}
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
            >
              {isAr ? 'مراجعة' : 'Review'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review + submit */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="bg-brand-surface border border-brand-border rounded-xl p-4 flex flex-col gap-2">
            <p className="font-satoshi text-sm text-brand-muted">
              {isAr ? 'الجلسة:' : 'Session:'}{' '}
              <span className="text-brand-text font-medium">{sessionName}</span>
            </p>
            <p className="font-satoshi text-sm text-brand-muted">
              {isAr ? 'العناصر:' : 'Items:'}{' '}
              <span className="text-brand-text font-medium">{counts.length}</span>
            </p>
            <p className="font-satoshi text-sm text-brand-muted">
              {isAr ? 'عناصر بفروقات:' : 'Items with variance:'}{' '}
              <span className="text-brand-gold font-medium">{variantItems.length}</span>
            </p>
          </div>

          {variantItems.length > 0 && (
            <div className="border border-brand-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-brand-surface-2">
                  <tr>
                    <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                      {isAr ? 'المكوّن' : 'Ingredient'}
                    </th>
                    <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                      {isAr ? 'نظام' : 'System'}
                    </th>
                    <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                      {isAr ? 'فعلي' : 'Actual'}
                    </th>
                    <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                      {isAr ? 'الفرق' : 'Variance'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {variantItems.map((c) => {
                    const item = stockItems.find((s) => s.ingredient_id === c.ingredient_id)
                    const variance = c.actual_qty - c.system_qty
                    return (
                      <tr key={c.ingredient_id} className="border-t border-brand-border">
                        <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                          {item?.name_ar ?? c.ingredient_id}
                        </td>
                        <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                          {c.system_qty} {item?.unit}
                        </td>
                        <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                          {c.actual_qty} {item?.unit}
                        </td>
                        <td className={`px-4 py-3 font-satoshi text-sm font-semibold ${
                          variance < 0 ? 'text-red-400' : 'text-brand-gold'
                        }`}>
                          {variance >= 0 ? '+' : ''}{variance.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              {isAr ? 'السابق' : 'Back'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
            >
              {isPending
                ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                : (isAr ? 'إرسال الجرد' : 'Submit Count')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
