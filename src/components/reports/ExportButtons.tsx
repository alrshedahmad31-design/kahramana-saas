'use client'

import { useState }          from 'react'
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react'
import { buildCSVWithMeta }  from '@/lib/reports/export-csv'
import { logExportFormat }   from '@/app/[locale]/dashboard/reports/actions'
import type { ReportResult } from '@/app/[locale]/dashboard/reports/actions'

interface Props {
  report: ReportResult
  isAr:   boolean
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function buildFilename(report: ReportResult, ext: string): string {
  const slug = report.type.replace(/_/g, '-')
  const date = new Date().toISOString().slice(0, 10)
  return `kahramana-${slug}-${date}.${ext}`
}

export default function ExportButtons({ report, isAr }: Props) {
  const [busy, setBusy] = useState<'csv' | 'excel' | 'pdf' | null>(null)

  const filterLabel = `${report.filters.from} → ${report.filters.to}${report.filters.branchName ? ` | ${report.filters.branchName}` : ''}`
  const columns     = isAr ? report.columns_ar : report.columns_en

  async function handleCSV() {
    setBusy('csv')
    try {
      const csv  = buildCSVWithMeta(
        isAr ? report.title_ar : report.title_en,
        report.generatedAt,
        filterLabel,
        columns,
        report.rows,
      )
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
      downloadBlob(blob, buildFilename(report, 'csv'))
      await logExportFormat(report.type, 'csv')
    } finally {
      setBusy(null)
    }
  }

  async function handleExcel() {
    setBusy('excel')
    try {
      const { buildExcelBlob } = await import('@/lib/reports/export-excel')
      const blob = await buildExcelBlob(
        isAr ? report.title_ar : report.title_en,
        report.generatedAt,
        filterLabel,
        [{
          sheetName: isAr ? report.title_ar : report.title_en,
          headers:   columns,
          rows:      report.rows,
        }],
      )
      downloadBlob(blob, buildFilename(report, 'xlsx'))
      await logExportFormat(report.type, 'excel')
    } finally {
      setBusy(null)
    }
  }

  async function handlePDF() {
    setBusy('pdf')
    try {
      const { buildPDFBlob } = await import('@/lib/reports/export-pdf')
      const blob = await buildPDFBlob({
        reportName:  isAr ? report.title_ar : report.title_en,
        generatedAt: report.generatedAt,
        filterLabel,
        columns,
        rows:        report.rows,
        summary:     report.summary.map((s) => ({
          label: isAr ? s.label_ar : s.label_en,
          value: s.value,
        })),
      })
      downloadBlob(blob, buildFilename(report, 'pdf'))
      await logExportFormat(report.type, 'pdf')
    } finally {
      setBusy(null)
    }
  }

  const btn = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border'
  const disabled = busy !== null

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {isAr ? 'تصدير:' : 'Export:'}
      </span>

      <button
        onClick={handleCSV}
        disabled={disabled}
        className={`${btn} border-brand-border bg-brand-surface-2 text-brand-text hover:border-brand-gold/50 hover:text-brand-gold disabled:opacity-40`}
      >
        <File size={14} />
        {busy === 'csv'
          ? (isAr ? 'جاري...' : 'Saving...')
          : 'CSV'
        }
      </button>

      <button
        onClick={handleExcel}
        disabled={disabled}
        className={`${btn} border-brand-border bg-brand-surface-2 text-brand-text hover:border-brand-success/60 hover:text-brand-success disabled:opacity-40`}
      >
        <FileSpreadsheet size={14} />
        {busy === 'excel'
          ? (isAr ? 'جاري...' : 'Saving...')
          : 'Excel'
        }
      </button>

      <button
        onClick={handlePDF}
        disabled={disabled}
        className={`${btn} border-brand-border bg-brand-surface-2 text-brand-text hover:border-brand-error/60 hover:text-brand-error disabled:opacity-40`}
      >
        <FileText size={14} />
        {busy === 'pdf'
          ? (isAr ? 'جاري...' : 'Saving...')
          : 'PDF'
        }
      </button>

      {busy && (
        <span className="text-xs text-brand-muted animate-pulse font-satoshi">
          {isAr ? 'جاري التصدير...' : 'Generating…'}
        </span>
      )}

      <div className="flex items-center gap-1.5 ms-auto">
        <Download size={12} className="text-brand-muted" />
        <span className="text-xs text-brand-muted font-satoshi">
          {report.validation.rowCount} {isAr ? 'سجل' : 'records'}
        </span>
      </div>
    </div>
  )
}
