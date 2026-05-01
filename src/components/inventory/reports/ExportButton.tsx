'use client'

import { useState, useTransition } from 'react'

interface Column {
  key: string
  header: string
}

interface Props {
  rows: Record<string, unknown>[]
  columns: Column[]
  filename: string
  label?: string
  exportAction: (
    rows: Record<string, unknown>[],
    columns: Column[],
    sheetName: string,
  ) => Promise<{ base64?: string; error?: string }>
}

export default function ExportButton({ rows, columns, filename, label, exportAction }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleExport() {
    startTransition(async () => {
      const result = await exportAction(rows, columns, 'Report')
      if (result.error || !result.base64) {
        setError(result.error ?? 'Export failed')
        return
      }
      const binary = atob(result.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending || rows.length === 0}
        className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold disabled:opacity-40 transition-colors"
      >
        {isPending ? '...' : (label ?? 'تصدير Excel')}
      </button>
      {error && <p className="font-satoshi text-xs text-brand-error mt-1">{error}</p>}
    </div>
  )
}
