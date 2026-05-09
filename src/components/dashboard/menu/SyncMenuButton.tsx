'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncMenuItemsWithDatabase } from '@/app/[locale]/dashboard/menu/actions'
import { toast } from '@/lib/toast'
import { ShoppingBag, Loader2 } from 'lucide-react'

interface Props {
  syncLabel:   string
  successMsg:  string
  errorMsg:    string
}

export default function SyncMenuButton({ syncLabel, successMsg, errorMsg }: Props) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSync() {
    startTransition(async () => {
      const result = await syncMenuItemsWithDatabase()
      if (result.success) {
        toast.success(successMsg.replace('{count}', String(result.count ?? 0)))
        router.refresh()
      } else {
        toast.error(result.error ?? errorMsg)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 h-10 border border-brand-gold/20 disabled:opacity-50 transition-opacity"
    >
      {isPending
        ? <Loader2 className="h-4 w-4 text-brand-gold animate-spin" />
        : <ShoppingBag className="h-4 w-4 text-brand-gold" />}
      {syncLabel}
    </button>
  )
}
