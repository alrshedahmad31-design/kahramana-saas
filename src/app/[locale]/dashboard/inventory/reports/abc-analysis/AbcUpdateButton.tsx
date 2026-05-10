'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { callUpdateAbcClassification } from '../actions'

export default function AbcUpdateButton({ locale }: { locale: string }) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const t = useTranslations('inventory.reports.abcAnalysis')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  function handleClick() {
    startTransition(async () => {
      const result = await callUpdateAbcClassification()
      if (result.error) {
        setMessage({ text: result.error, ok: false })
      } else {
        setMessage({ text: t('updateSuccess'), ok: true })
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
        className={`inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 py-2 ${font} text-[10px] font-black uppercase tracking-widest text-brand-muted hover:border-brand-gold hover:text-brand-gold disabled:opacity-40 transition-all shadow-sm active:scale-95`}
      >
        {isPending ? '...' : t('updateBtn')}
      </button>
      {message && (
        <p className={`${font} text-[10px] font-black uppercase tracking-widest ${message.ok ? 'text-brand-success' : 'text-brand-error'} animate-in fade-in slide-in-from-top-1 shadow-sm px-2 py-1 bg-brand-surface border border-brand-border rounded-md`}>
          {message.text}
        </p>
      )}
    </div>
  )
}


