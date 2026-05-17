'use client'

import { useRef, useState, useCallback } from 'react'
import { importRecipesExcel } from '@/app/[locale]/dashboard/inventory/recipes/import/actions'
import type { RecipeImportActionResult } from '@/app/[locale]/dashboard/inventory/recipes/import/actions'
import { toast } from '@/lib/toast'

interface Props {
  locale: string
}

type Phase = 'idle' | 'selected' | 'analyzing' | 'analyzed' | 'importing' | 'done'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function RecipeImportClient({ locale }: Props) {
  const isAr = locale === 'ar'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<RecipeImportActionResult | null>(null)

  const acceptFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.xlsx')) {
      toast.error(isAr ? 'يجب أن يكون الملف بصيغة .xlsx فقط' : 'Only .xlsx files are accepted')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error(isAr ? 'حجم الملف يتجاوز 10 MB' : 'File size exceeds 10 MB')
      return
    }
    setFile(f)
    setPhase('selected')
    setResult(null)
  }, [isAr])

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) acceptFile(dropped)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) acceptFile(picked)
    e.target.value = ''
  }

  function handleReset() {
    setPhase('idle')
    setFile(null)
    setResult(null)
  }

  async function handleAnalyze() {
    if (!file) return
    setPhase('analyzing')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', 'analyze')
    try {
      const res = await importRecipesExcel(fd)
      setResult(res)
      if (res.fatal_ar) {
        toast.error(isAr ? res.fatal_ar : (res.fatal_en ?? res.fatal_ar))
        setPhase('selected')
        return
      }
      setPhase('analyzed')
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء التحليل' : 'Analysis failed')
      setPhase('selected')
    }
  }

  async function handleConfirm() {
    if (!file) return
    setPhase('importing')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', 'import')
    try {
      const res = await importRecipesExcel(fd)
      setResult(res)
      if (res.fatal_ar) {
        toast.error(isAr ? res.fatal_ar : (res.fatal_en ?? res.fatal_ar))
        setPhase('analyzed')
        return
      }
      if (res.imported) {
        toast.success(isAr ? 'تم استيراد الوصفات' : 'Recipes imported')
        setPhase('done')
      } else {
        toast.error(isAr ? 'لم يتم الاستيراد — راجع الأخطاء' : 'Nothing imported — review errors')
        setPhase('analyzed')
      }
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء الاستيراد' : 'Import failed')
      setPhase('analyzed')
    }
  }

  const busy = phase === 'analyzing' || phase === 'importing'

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border">
          <h2 className="font-cairo text-base font-bold text-brand-text">
            {isAr ? 'رفع ملف الوصفات' : 'Upload Recipes File'}
          </h2>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {(phase === 'idle' || phase === 'selected') && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
                cursor-pointer py-10 px-6 transition-colors duration-150 select-none
                ${dragOver
                  ? 'border-brand-gold bg-brand-gold/5'
                  : 'border-brand-border hover:border-brand-gold/50 hover:bg-brand-surface-2'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={handleFileInput}
              />
              <p className="font-cairo text-sm font-medium text-brand-text text-center">
                {isAr ? 'اسحب الملف هنا أو انقر للاختيار' : 'Drop the file here or click to select'}
              </p>
              <p className="font-satoshi text-xs text-brand-muted">
                {isAr ? 'الحد الأقصى: 10 MB' : 'Max: 10 MB'}
              </p>
            </div>
          )}

          {file && phase !== 'idle' && (
            <div className="flex items-center gap-3 rounded-lg bg-brand-surface-2 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-satoshi text-sm font-medium text-brand-text truncate">{file.name}</p>
                <p className="font-satoshi text-xs text-brand-muted">{formatBytes(file.size)}</p>
              </div>
              {!busy && phase !== 'done' && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-cairo text-xs text-brand-muted hover:text-red-400 transition-colors"
                >
                  {isAr ? 'إزالة' : 'Remove'}
                </button>
              )}
            </div>
          )}

          {phase === 'selected' && (
            <button
              type="button"
              onClick={handleAnalyze}
              className="self-start rounded-lg px-5 py-2.5 bg-brand-gold text-brand-black
                font-cairo text-sm font-semibold hover:brightness-110 active:scale-[0.98]
                transition-all duration-150"
            >
              {isAr ? 'تحليل الملف' : 'Analyze File'}
            </button>
          )}

          {busy && (
            <p className="font-cairo text-sm text-brand-muted">
              {phase === 'analyzing'
                ? (isAr ? 'جارٍ التحليل...' : 'Analyzing...')
                : (isAr ? 'جارٍ الاستيراد...' : 'Importing...')}
            </p>
          )}
        </div>
      </div>

      {result && (phase === 'analyzed' || phase === 'importing' || phase === 'done') && (
        <ResultPanel
          result={result}
          locale={locale}
          phase={phase}
          onConfirm={handleConfirm}
          onCancel={() => setPhase('selected')}
          onReset={handleReset}
        />
      )}
    </div>
  )
}

function ResultPanel({
  result,
  locale,
  phase,
  onConfirm,
  onCancel,
  onReset,
}: {
  result: RecipeImportActionResult
  locale: string
  phase: Phase
  onConfirm: () => void
  onCancel: () => void
  onReset: () => void
}) {
  const isAr = locale === 'ar'
  const { summary, errors, skipped, failed, imported } = result

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-border">
        <h2 className="font-cairo text-base font-bold text-brand-text">
          {imported
            ? (isAr ? 'اكتمل الاستيراد' : 'Import Complete')
            : (isAr ? 'معاينة الاستيراد' : 'Import Preview')}
        </h2>
      </div>

      <div className="p-5 flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={isAr ? 'الإجمالي' : 'Total'} count={summary.total} tone="muted" />
          <StatCard label={isAr ? 'مُدرج' : 'Inserted'} count={summary.inserted} tone="success" />
          <StatCard label={isAr ? 'تم تخطّيها' : 'Skipped'} count={summary.skipped} tone="warning" />
          <StatCard label={isAr ? 'فشل' : 'Failed'} count={summary.failed} tone="error" />
        </div>

        {errors.length > 0 && (
          <div>
            <h3 className="font-cairo text-sm font-bold text-brand-text mb-2">
              {isAr ? `أخطاء في الملف (${errors.length})` : `File errors (${errors.length})`}
            </h3>
            <div className="border border-red-500/30 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-red-500/5">
                  <tr>
                    <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted">{isAr ? 'الصف' : 'Row'}</th>
                    <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted">{isAr ? 'العمود' : 'Column'}</th>
                    <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted">{isAr ? 'الخطأ' : 'Error'}</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.slice(0, 50).map((e, i) => (
                    <tr key={i} className="border-t border-red-500/20">
                      <td className="px-3 py-2 font-mono text-xs text-brand-text">{e.row}</td>
                      <td className="px-3 py-2 font-mono text-xs text-brand-muted">{e.column}</td>
                      <td className="px-3 py-2 font-satoshi text-sm text-red-400">{isAr ? e.message_ar : e.message_en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              {errors.length > 50 && (
                <p className="px-3 py-2 bg-red-500/5 font-satoshi text-xs text-brand-muted">
                  {isAr ? `... و${errors.length - 50} خطأ آخر` : `... and ${errors.length - 50} more`}
                </p>
              )}
            </div>
          </div>
        )}

        {failed.length > 0 && (
          <div>
            <h3 className="font-cairo text-sm font-bold text-brand-text mb-2">
              {isAr ? `صفوف لم تُدرج (${failed.length})` : `Rows that failed (${failed.length})`}
            </h3>
            <RowsTable rows={failed} locale={locale} tone="error" />
          </div>
        )}

        {skipped.length > 0 && (
          <div>
            <h3 className="font-cairo text-sm font-bold text-brand-text mb-2">
              {isAr ? `صفوف تم تخطّيها (${skipped.length})` : `Rows skipped (${skipped.length})`}
            </h3>
            <RowsTable rows={skipped} locale={locale} tone="warning" />
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          {phase === 'analyzed' && (
            <>
              <button
                type="button"
                onClick={onConfirm}
                disabled={summary.inserted === 0 || errors.length > 0}
                className="rounded-lg px-5 py-2.5 bg-brand-gold text-brand-black font-cairo text-sm font-semibold
                  hover:brightness-110 active:scale-[0.98] transition-all duration-150
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAr
                  ? `تأكيد إدراج ${summary.inserted} وصفة`
                  : `Confirm import of ${summary.inserted} recipe${summary.inserted === 1 ? '' : 's'}`}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-5 py-2.5 border border-brand-border font-cairo text-sm text-brand-muted
                  hover:bg-brand-surface-2 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg px-5 py-2.5 bg-brand-gold text-brand-black font-cairo text-sm font-semibold
                hover:brightness-110 transition-all"
            >
              {isAr ? 'استيراد ملف آخر' : 'Import another file'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, count, tone }: { label: string; count: number; tone: 'muted' | 'success' | 'warning' | 'error' }) {
  const toneClass =
    tone === 'success' ? 'text-green-400'
    : tone === 'warning' ? 'text-brand-gold'
    : tone === 'error' ? 'text-red-400'
    : 'text-brand-text'
  return (
    <div className="rounded-lg bg-brand-surface-2 px-4 py-3 text-center">
      <p className={`font-cairo text-2xl font-black tabular-nums ${toneClass}`}>{count}</p>
      <p className="font-satoshi text-xs text-brand-muted mt-0.5">{label}</p>
    </div>
  )
}

function RowsTable({
  rows,
  locale,
  tone,
}: {
  rows: { row: number; menu_item_slug: string; ingredient_id: string; reason_ar: string; reason_en: string }[]
  locale: string
  tone: 'warning' | 'error'
}) {
  const isAr = locale === 'ar'
  const borderClass = tone === 'error' ? 'border-red-500/30' : 'border-brand-gold/30'
  const headBgClass = tone === 'error' ? 'bg-red-500/5' : 'bg-brand-gold/5'
  const reasonClass = tone === 'error' ? 'text-red-400' : 'text-brand-gold'

  return (
    <div className={`border ${borderClass} rounded-lg overflow-hidden`}>
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[560px]">
        <thead className={headBgClass}>
          <tr>
            <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted">{isAr ? 'الصف' : 'Row'}</th>
            <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted">menu_item_slug</th>
            <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted">ingredient_id</th>
            <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted">{isAr ? 'السبب' : 'Reason'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, i) => (
            <tr key={i} className={`border-t ${borderClass}`}>
              <td className="px-3 py-2 font-mono text-xs text-brand-text">{r.row}</td>
              <td className="px-3 py-2 font-mono text-xs text-brand-text break-all">{r.menu_item_slug}</td>
              <td className="px-3 py-2 font-mono text-[11px] text-brand-muted break-all">{r.ingredient_id}</td>
              <td className={`px-3 py-2 font-satoshi text-sm ${reasonClass}`}>{isAr ? r.reason_ar : r.reason_en}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {rows.length > 50 && (
        <p className={`px-3 py-2 ${headBgClass} font-satoshi text-xs text-brand-muted`}>
          {isAr ? `... و${rows.length - 50} صف آخر` : `... and ${rows.length - 50} more`}
        </p>
      )}
    </div>
  )
}
