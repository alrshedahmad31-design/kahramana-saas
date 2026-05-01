'use client'

import { useState, useTransition } from 'react'
import { callUpdateAbcClassification } from '../actions'

export default function AbcUpdateButton({ isAr }: { isAr: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  function handleClick() {
    startTransition(async () => {
      const result = await callUpdateAbcClassification()
      if (result.error) {
        setMessage({ text: result.error, ok: false })
      } else {
        setMessage({ text: isAr ? 'تم تحديث التصنيف بنجاح' : 'Classification updated successfully', ok: true })
      }
      setTimeout(() => setMessage(null), 4000)
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold disabled:opacity-40 transition-colors"
      >
        {isPending ? '...' : (isAr ? 'تحديث التصنيف الآن' : 'Update ABC Classification')}
      </button>
      {message && (
        <p className={`font-satoshi text-xs ${message.ok ? 'text-green-400' : 'text-brand-error'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
