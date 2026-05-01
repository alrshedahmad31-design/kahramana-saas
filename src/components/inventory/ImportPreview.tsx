'use client'

import type { ImportError, ImportWarning } from '@/lib/inventory/excel-parser'
import type { ImportSummary } from '@/app/[locale]/dashboard/inventory/import/actions'

interface Props {
  summary: ImportSummary
  errors: ImportError[]
  warnings: ImportWarning[]
  onConfirm: () => void
  onCancel: () => void
  confirming: boolean
  locale: string
}

const isAr = (locale: string) => locale === 'ar'

function SummaryRow({ label, count }: { label: string; count: number }) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-brand-success text-base">✓</span>
      <span className="font-satoshi text-sm text-brand-text flex-1">{label}</span>
      <span className="font-satoshi text-sm font-semibold text-brand-gold tabular-nums">{count}</span>
    </div>
  )
}

export default function ImportPreview({ summary, errors, warnings, onConfirm, onCancel, confirming, locale }: Props) {
  const ar = isAr(locale)
  const hasErrors = errors.length > 0

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-brand-border">
        <h2 className="font-cairo text-lg font-bold text-brand-text">
          {ar ? 'نتائج التحليل' : 'Analysis Results'}
        </h2>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Summary counts */}
        <div className="rounded-lg bg-brand-surface-2 px-4 py-3 flex flex-col divide-y divide-brand-border">
          <SummaryRow label={ar ? 'مكونات جاهزة للاستيراد' : 'Ingredients ready'} count={summary.ingredients} />
          <SummaryRow label={ar ? 'Prep Items' : 'Prep Items'} count={summary.prepItems} />
          <SummaryRow label={ar ? 'مكونات Prep' : 'Prep ingredients'} count={summary.prepIngredients} />
          <SummaryRow label={ar ? 'وصفات' : 'Recipes'} count={summary.recipes} />
          <SummaryRow label={ar ? 'سجلات المخزون الافتتاحي' : 'Opening stock records'} count={summary.openingStock} />
          <SummaryRow label={ar ? 'دفعات (lots)' : 'Lots'} count={summary.lots} />
          <SummaryRow label={ar ? 'مستويات Par' : 'Par levels'} count={summary.parLevels} />
          <SummaryRow label={ar ? 'موردون' : 'Suppliers'} count={summary.suppliers} />
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-brand-warning/30 bg-brand-warning/5 p-4">
            <p className="font-satoshi text-sm font-semibold text-brand-warning mb-2">
              {ar ? `تحذيرات (${warnings.length})` : `Warnings (${warnings.length})`}
            </p>
            <ul className="flex flex-col gap-1.5">
              {warnings.map((w, i) => (
                <li key={i} className="font-satoshi text-xs text-brand-warning flex gap-2">
                  <span className="shrink-0 font-medium">{w.sheet} — {ar ? 'الصف' : 'Row'} {w.row}:</span>
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="rounded-lg border border-brand-error/30 bg-brand-error/5 p-4">
            <p className="font-satoshi text-sm font-semibold text-brand-error mb-2">
              {ar ? `أخطاء (${errors.length}) — أصلح الأخطاء أولاً` : `Errors (${errors.length}) — Fix errors first`}
            </p>
            <ul className="flex flex-col gap-1.5">
              {errors.map((e, i) => (
                <li key={i} className="font-satoshi text-xs text-brand-error flex gap-2">
                  <span className="shrink-0 font-medium">{e.sheet} — {ar ? 'الصف' : 'Row'} {e.row}:</span>
                  <span>{e.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={onConfirm}
            disabled={hasErrors || confirming}
            className={`flex-1 min-w-[160px] flex items-center justify-center gap-2
              rounded-lg px-5 py-3 font-satoshi text-sm font-semibold
              transition-colors duration-150
              ${hasErrors
                ? 'bg-brand-surface-2 text-brand-muted cursor-not-allowed'
                : 'bg-brand-gold text-brand-black hover:brightness-110 active:scale-[0.98]'
              }`}
          >
            {confirming
              ? (ar ? 'جاري الاستيراد...' : 'Importing...')
              : (ar ? 'تأكيد الاستيراد' : 'Confirm Import')}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="px-5 py-3 rounded-lg font-satoshi text-sm font-medium
              text-brand-muted hover:bg-brand-surface-2 border border-brand-border
              transition-colors duration-150"
          >
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
        </div>

        {hasErrors && (
          <p className="font-satoshi text-xs text-brand-muted text-center">
            {ar
              ? 'صحح الأخطاء في ملف Excel وأعد رفعه للمتابعة'
              : 'Fix the errors in your Excel file and re-upload to continue'}
          </p>
        )}
      </div>
    </div>
  )
}
