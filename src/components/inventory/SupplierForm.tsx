'use client'
import { useTransition, useState } from 'react'

interface SupplierRow {
  id: string
  name_ar: string
  name_en: string | null
  phone: string | null
  email: string | null
  lead_time_days: number | null
  reliability_pct: number | null
  payment_terms: string | null
  is_active: boolean
  created_at: string
}

interface Props {
  supplier?: SupplierRow
  action: (formData: FormData) => Promise<{ error?: string }>
  onClose: () => void
  locale: string
}

const PAYMENT_TERMS = [
  { value: 'cash',  labelAr: 'نقداً',    labelEn: 'Cash' },
  { value: 'net7',  labelAr: 'صافي 7',   labelEn: 'Net 7' },
  { value: 'net14', labelAr: 'صافي 14',  labelEn: 'Net 14' },
  { value: 'net30', labelAr: 'صافي 30',  labelEn: 'Net 30' },
  { value: 'net60', labelAr: 'صافي 60',  labelEn: 'Net 60' },
]

export default function SupplierForm({ supplier, action, onClose, locale }: Props) {
  const isAr = locale !== 'en'
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    if (supplier) fd.set('id', supplier.id)
    startTransition(async () => {
      const result = await action(fd)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-brand-surface border border-brand-border rounded-xl w-full max-w-lg mx-4 flex flex-col gap-5 p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-cairo text-xl font-black text-brand-text">
            {supplier ? (isAr ? 'تعديل المورد' : 'Edit Supplier') : (isAr ? 'إضافة مورد' : 'Add Supplier')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
              <p className="font-satoshi text-sm text-brand-error">{error}</p>
            </div>
          )}

          {/* name_ar */}
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'الاسم (عربي)' : 'Name (Arabic)'} *
            </label>
            <input
              name="name_ar"
              type="text"
              required
              defaultValue={supplier?.name_ar ?? ''}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            />
          </div>

          {/* name_en */}
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'الاسم (إنجليزي)' : 'Name (English)'}
            </label>
            <input
              name="name_en"
              type="text"
              defaultValue={supplier?.name_en ?? ''}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            />
          </div>

          {/* phone + email */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-sm font-medium text-brand-text">
                {isAr ? 'الهاتف' : 'Phone'}
              </label>
              <input
                name="phone"
                type="tel"
                defaultValue={supplier?.phone ?? ''}
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-sm font-medium text-brand-text">
                {isAr ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <input
                name="email"
                type="email"
                defaultValue={supplier?.email ?? ''}
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* lead_time_days + payment_terms */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-sm font-medium text-brand-text">
                {isAr ? 'وقت التوريد (أيام)' : 'Lead Time (days)'}
              </label>
              <input
                name="lead_time_days"
                type="number"
                min={1}
                defaultValue={supplier?.lead_time_days ?? 1}
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-sm font-medium text-brand-text">
                {isAr ? 'شروط الدفع' : 'Payment Terms'}
              </label>
              <select
                name="payment_terms"
                defaultValue={supplier?.payment_terms ?? ''}
                className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
              >
                <option value="">{isAr ? 'اختر' : 'Select'}</option>
                {PAYMENT_TERMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {isAr ? t.labelAr : t.labelEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* is_active */}
          <div className="flex items-center gap-3">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'نشط' : 'Active'}
            </label>
            <select
              name="is_active"
              defaultValue={supplier?.is_active === false ? 'false' : 'true'}
              className="rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            >
              <option value="true">{isAr ? 'نشط' : 'Active'}</option>
              <option value="false">{isAr ? 'غير نشط' : 'Inactive'}</option>
            </select>
          </div>

          {/* notes */}
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-sm font-medium text-brand-text">
              {isAr ? 'ملاحظات' : 'Notes'}
            </label>
            <textarea
              name="notes"
              rows={2}
              className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50"
            >
              {isPending
                ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                : (isAr ? 'حفظ' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
