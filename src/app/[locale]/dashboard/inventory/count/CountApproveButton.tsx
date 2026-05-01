'use client'
import { useTransition, useState } from 'react'

interface Props {
  sessionName: string
  branchId: string
  locale: string
  approveAction: (sessionName: string, branchId: string) => Promise<{ error?: string }>
}

export default function CountApproveButton({ sessionName, branchId, locale, approveAction }: Props) {
  const isAr = locale !== 'en'
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleApprove() {
    startTransition(async () => {
      const result = await approveAction(sessionName, branchId)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      {error && <p className="font-satoshi text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending}
        className="inline-flex items-center rounded-lg bg-green-500/10 px-3 py-1.5 font-satoshi text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
      >
        {isPending ? '...' : isAr ? 'موافقة على الكل' : 'Approve All'}
      </button>
    </div>
  )
}
