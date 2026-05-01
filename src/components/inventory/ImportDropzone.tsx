'use client'

import { useState, useRef, useCallback } from 'react'
import ImportPreview from './ImportPreview'
import { importInventoryExcel } from '@/app/[locale]/dashboard/inventory/import/actions'
import type { ImportActionResult } from '@/app/[locale]/dashboard/inventory/import/actions'

interface Branch { id: string; name_ar: string; name_en: string }

interface Props {
  branches: Branch[]
  menuSlugs: string[]
  locale: string
}

type Phase = 'idle' | 'selected' | 'analyzing' | 'analyzed' | 'confirming' | 'done'

function UploadIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function FileIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ExportIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ImportDropzone({ locale }: Props) {
  const ar = locale === 'ar'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [analysisResult, setAnalysisResult] = useState<ImportActionResult | null>(null)
  const [importSuccess, setImportSuccess] = useState<ImportActionResult | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const acceptFile = useCallback((f: File) => {
    if (!f.name.endsWith('.xlsx')) {
      alert(ar ? 'يجب أن يكون الملف بصيغة .xlsx فقط' : 'Only .xlsx files are accepted')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      alert(ar ? 'حجم الملف يتجاوز الحد المسموح (10 MB)' : 'File size exceeds 10 MB limit')
      return
    }
    setFile(f)
    setPhase('selected')
    setAnalysisResult(null)
    setImportSuccess(null)
  }, [ar])

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

  async function handleAnalyze() {
    if (!file) return
    setPhase('analyzing')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', 'analyze')
    try {
      const result = await importInventoryExcel(fd)
      setAnalysisResult(result)
      setPhase('analyzed')
    } catch {
      setPhase('selected')
      alert(ar ? 'حدث خطأ أثناء التحليل' : 'An error occurred during analysis')
    }
  }

  async function handleConfirmImport() {
    if (!file) return
    setPhase('confirming')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('mode', 'import')
    try {
      const result = await importInventoryExcel(fd)
      if (result.imported) {
        setImportSuccess(result)
        setPhase('done')
      } else {
        setAnalysisResult(result)
        setPhase('analyzed')
      }
    } catch {
      setPhase('analyzed')
      alert(ar ? 'حدث خطأ أثناء الاستيراد' : 'An error occurred during import')
    }
  }

  function handleCancel() {
    setPhase('selected')
    setAnalysisResult(null)
  }

  function handleReset() {
    setPhase('idle')
    setFile(null)
    setAnalysisResult(null)
    setImportSuccess(null)
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const res = await fetch('/api/inventory/export')
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'kahramana-inventory-export.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert(ar ? 'فشل تصدير البيانات' : 'Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Import card ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border flex items-center gap-3">
          <UploadIcon size={18} />
          <h2 className="font-cairo text-base font-bold text-brand-text">
            {ar ? 'استيراد البيانات' : 'Import Data'}
          </h2>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Download template button */}
          <a
            href="/api/inventory/template"
            download="kahramana-inventory-template.xlsx"
            className="inline-flex items-center gap-2 self-start rounded-lg px-4 py-2.5
              border border-brand-border font-satoshi text-sm font-medium text-brand-text
              hover:border-brand-gold hover:text-brand-gold transition-colors duration-150"
          >
            <FileIcon size={16} />
            {ar ? 'تحميل نموذج Excel' : 'Download Excel Template'}
          </a>

          {/* Dropzone — only shown when idle or selecting */}
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
              <UploadIcon size={32} />
              <div className="text-center">
                <p className="font-satoshi text-sm font-medium text-brand-text">
                  {ar ? 'اسحب ملف .xlsx هنا أو انقر للاختيار' : 'Drag .xlsx file here or click to select'}
                </p>
                <p className="font-satoshi text-xs text-brand-muted mt-1">
                  {ar ? 'الحد الأقصى: 10 MB' : 'Max size: 10 MB'}
                </p>
              </div>
            </div>
          )}

          {/* Selected file info */}
          {file && phase !== 'idle' && (
            <div className="flex items-center gap-3 rounded-lg bg-brand-surface-2 px-4 py-3">
              <FileIcon size={18} />
              <div className="flex-1 min-w-0">
                <p className="font-satoshi text-sm font-medium text-brand-text truncate">{file.name}</p>
                <p className="font-satoshi text-xs text-brand-muted">{formatBytes(file.size)}</p>
              </div>
              {phase === 'selected' && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-satoshi text-xs text-brand-muted hover:text-brand-error transition-colors"
                >
                  {ar ? 'إزالة' : 'Remove'}
                </button>
              )}
            </div>
          )}

          {/* Analyze button */}
          {phase === 'selected' && (
            <button
              type="button"
              onClick={handleAnalyze}
              className="self-start flex items-center gap-2 rounded-lg px-5 py-2.5
                bg-brand-gold text-brand-black font-satoshi text-sm font-semibold
                hover:brightness-110 active:scale-[0.98] transition-all duration-150"
            >
              {ar ? 'رفع وتحليل' : 'Upload & Analyze'}
            </button>
          )}

          {/* Analyzing spinner */}
          {phase === 'analyzing' && (
            <div className="flex items-center gap-3">
              <svg className="animate-spin" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
              </svg>
              <span className="font-satoshi text-sm text-brand-muted">
                {ar ? 'جاري التحليل...' : 'Analyzing...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Analysis results ──────────────────────────────────────────────── */}
      {(phase === 'analyzed' || phase === 'confirming') && analysisResult && (
        <ImportPreview
          summary={analysisResult.summary}
          errors={analysisResult.errors}
          warnings={analysisResult.warnings}
          onConfirm={handleConfirmImport}
          onCancel={handleCancel}
          confirming={phase === 'confirming'}
          locale={locale}
        />
      )}

      {/* ── Success state ─────────────────────────────────────────────────── */}
      {phase === 'done' && importSuccess && (
        <div className="rounded-xl border border-brand-success/30 bg-brand-success/5 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="text-brand-success text-2xl">✓</span>
            <h3 className="font-cairo text-lg font-bold text-brand-success">
              {ar ? 'تم الاستيراد بنجاح' : 'Import Successful'}
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {importSuccess.summary.ingredients > 0 && <StatBadge label={ar ? 'مكونات' : 'Ingredients'} count={importSuccess.summary.ingredients} />}
            {importSuccess.summary.prepItems > 0 && <StatBadge label="Prep Items" count={importSuccess.summary.prepItems} />}
            {importSuccess.summary.recipes > 0 && <StatBadge label={ar ? 'وصفات' : 'Recipes'} count={importSuccess.summary.recipes} />}
            {importSuccess.summary.openingStock > 0 && <StatBadge label={ar ? 'أرصدة افتتاحية' : 'Opening stock'} count={importSuccess.summary.openingStock} />}
            {importSuccess.summary.parLevels > 0 && <StatBadge label={ar ? 'مستويات Par' : 'Par levels'} count={importSuccess.summary.parLevels} />}
          </div>
          <div className="flex gap-3 flex-wrap">
            <a
              href={`${locale === 'en' ? '/en' : ''}/dashboard/inventory`}
              className="rounded-lg px-4 py-2.5 bg-brand-gold text-brand-black
                font-satoshi text-sm font-semibold hover:brightness-110 transition-all"
            >
              {ar ? 'عرض المخزون' : 'View Inventory'}
            </a>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg px-4 py-2.5 border border-brand-border
                font-satoshi text-sm text-brand-muted hover:bg-brand-surface-2 transition-colors"
            >
              {ar ? 'استيراد آخر' : 'Import Another'}
            </button>
          </div>
        </div>
      )}

      {/* ── Export card ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-5 flex items-center gap-4">
        <div className="flex-1">
          <h3 className="font-satoshi text-sm font-semibold text-brand-text">
            {ar ? 'تصدير البيانات الحالية' : 'Export Current Data'}
          </h3>
          <p className="font-satoshi text-xs text-brand-muted mt-0.5">
            {ar
              ? 'تصدير جميع المكونات والوصفات والمخزون إلى Excel'
              : 'Export all ingredients, recipes and stock to Excel'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportLoading}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5
            border border-brand-border font-satoshi text-sm font-medium text-brand-text
            hover:border-brand-gold hover:text-brand-gold transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ExportIcon size={16} />
          {exportLoading
            ? (ar ? 'جاري التصدير...' : 'Exporting...')
            : (ar ? 'تصدير Excel' : 'Export Excel')}
        </button>
      </div>
    </div>
  )
}

function StatBadge({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-lg bg-brand-surface-2 px-4 py-3 text-center">
      <p className="font-cairo text-2xl font-black text-brand-gold tabular-nums">{count}</p>
      <p className="font-satoshi text-xs text-brand-muted mt-0.5">{label}</p>
    </div>
  )
}
