'use client'
import { useState } from 'react'
import SupplierForm from '@/components/inventory/SupplierForm'

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
  suppliers: SupplierRow[]
  locale: string
  canEdit: boolean
  action: (formData: FormData) => Promise<{ error?: string }>
}

function reliabilityBadge(pct: number | null) {
  if (pct === null) return 'bg-brand-surface-2 text-brand-muted'
  if (pct >= 90) return 'bg-green-500/10 text-green-400'
  if (pct >= 70) return 'bg-brand-gold/10 text-brand-gold'
  return 'bg-red-500/10 text-red-400'
}

export default function SupplierPageClient({ suppliers, locale, canEdit, action }: Props) {
  const isAr = locale !== 'en'
  const [showModal, setShowModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState<SupplierRow | undefined>(undefined)

  function openAdd() {
    setEditSupplier(undefined)
    setShowModal(true)
  }

  function openEdit(s: SupplierRow) {
    if (!canEdit) return
    setEditSupplier(s)
    setShowModal(true)
  }

  return (
    <>
      {/* Add button */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors"
          >
            {isAr ? '+ إضافة مورد' : '+ Add Supplier'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-brand-surface-2">
            <tr>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الاسم' : 'Name'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الهاتف' : 'Phone'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'وقت التوريد' : 'Lead Time'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الموثوقية' : 'Reliability'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'شروط الدفع' : 'Payment'}
              </th>
              <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'الحالة' : 'Status'}
              </th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-satoshi text-sm text-brand-muted">
                  {isAr ? 'لا يوجد موردون' : 'No suppliers'}
                </td>
              </tr>
            )}
            {suppliers.map((s) => (
              <tr
                key={s.id}
                onClick={() => openEdit(s)}
                className={`border-t border-brand-border hover:bg-brand-surface-2 transition-colors ${canEdit ? 'cursor-pointer' : ''}`}
              >
                <td className="px-4 py-3">
                  <p className="font-satoshi text-sm text-brand-text">{s.name_ar}</p>
                  {s.name_en && (
                    <p className="font-satoshi text-xs text-brand-muted">{s.name_en}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                  {s.phone ?? '—'}
                </td>
                <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                  {s.lead_time_days !== null
                    ? `${s.lead_time_days} ${isAr ? 'أيام' : 'days'}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${reliabilityBadge(s.reliability_pct)}`}>
                    {s.reliability_pct !== null ? `${s.reliability_pct.toFixed(0)}%` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                  {s.payment_terms ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-satoshi font-medium ${
                      s.is_active
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-brand-surface-2 text-brand-muted'
                    }`}
                  >
                    {s.is_active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <SupplierForm
          supplier={editSupplier}
          action={action}
          onClose={() => setShowModal(false)}
          locale={locale}
        />
      )}
    </>
  )
}
