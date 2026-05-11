'use client'

import { useTransition } from 'react'
import { exportMenuItems } from '@/app/[locale]/dashboard/menu/actions'
import { toast } from '@/lib/toast'
import { Download, Loader2 } from 'lucide-react'

interface Props {
  label:      string
  successMsg: string
  errorMsg:   string
}

export default function ExportMenuButton({ label, successMsg, errorMsg }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleExport() {
    startTransition(async () => {
      const result = await exportMenuItems()
      if (!result.success || !result.data) {
        toast.error(result.error ?? errorMsg)
        return
      }

      const json = JSON.stringify(result.data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10)

      const a = document.createElement('a')
      a.href     = url
      a.download = `menu-export-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`${successMsg} (${result.data.count})`)
    })
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 h-10 border border-brand-gold/20 disabled:opacity-50 transition-opacity"
    >
      {isPending
        ? <Loader2 className="h-4 w-4 text-brand-gold animate-spin" />
        : <Download className="h-4 w-4 text-brand-gold" />}
      {label}
    </button>
  )
}
