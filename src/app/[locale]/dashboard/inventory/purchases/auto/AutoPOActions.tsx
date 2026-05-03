'use client'
import { useTransition, useState } from 'react'

type POStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'

interface Props {
  poId: string
  locale: string
  updateStatusAction: (id: string, status: POStatus) => Promise<{ error?: string }>
}

export default function AutoPOActions({ poId, locale, updateStatusAction }: Props) {
  const isAr = locale !== 'en'
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAction(status: POStatus) {
    setError(null)
    startTransition(async () => {
      const result = await updateStatusAction(poId, status)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      {error && <p className="font-satoshi text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleAction('ordered')}
          className="inline-flex items-center rounded-lg bg-blue-500/10 px-3 py-1.5 font-satoshi text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
        >
          {isPending ? '...' : isAr ? 'إرسال للمورد' : 'Send to Supplier'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleAction('cancelled')}
          className="inline-flex items-center rounded-lg bg-red-500/10 px-3 py-1.5 font-satoshi text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
