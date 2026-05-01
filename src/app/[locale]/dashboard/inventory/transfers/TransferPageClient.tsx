'use client'
import { useState } from 'react'
import TransferForm from '@/components/inventory/TransferForm'

interface Props {
  branches: { id: string; name_ar: string }[]
  ingredients: { id: string; name_ar: string; unit: string }[]
  stockByBranch: Record<string, Record<string, number>>
  defaultFromBranch?: string
  locale: string
  action: (formData: FormData) => Promise<{ error?: string }>
}

export default function TransferPageClient({
  branches, ingredients, stockByBranch, defaultFromBranch, locale, action,
}: Props) {
  const isAr = locale !== 'en'
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
        >
          {isAr ? '+ تحويل جديد' : '+ New Transfer'}
        </button>
      </div>

      {showModal && (
        <TransferForm
          branches={branches}
          ingredients={ingredients}
          stockByBranch={stockByBranch}
          defaultFromBranch={defaultFromBranch}
          locale={locale}
          action={action}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
