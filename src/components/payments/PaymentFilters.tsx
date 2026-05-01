'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import type { PaymentMethod, PaymentStatus } from '@/lib/supabase/custom-types'

const METHODS: { value: PaymentMethod | ''; label: string; labelAr: string }[] = [
  { value: '',           label: 'All Methods',  labelAr: 'جميع الطرق' },
  { value: 'cash',       label: 'Cash',         labelAr: 'نقداً' },
  { value: 'benefit_qr', label: 'Benefit QR',   labelAr: 'بنفت QR' },
  { value: 'tap_card',   label: 'Tap Card',     labelAr: 'بطاقة تاب' },
  { value: 'tap_knet',   label: 'Tap KNET',     labelAr: 'تاب كي-نت' },
]

const STATUSES: { value: PaymentStatus | ''; label: string; labelAr: string }[] = [
  { value: '',           label: 'All Statuses', labelAr: 'جميع الحالات' },
  { value: 'pending',    label: 'Pending',      labelAr: 'قيد الانتظار' },
  { value: 'processing', label: 'Processing',   labelAr: 'جارٍ المعالجة' },
  { value: 'completed',  label: 'Completed',    labelAr: 'مكتمل' },
  { value: 'failed',     label: 'Failed',       labelAr: 'فاشل' },
  { value: 'refunded',   label: 'Refunded',     labelAr: 'مُسترد' },
]

const DAYS: { value: string; label: string; labelAr: string }[] = [
  { value: '7',  label: 'Last 7 days',  labelAr: 'آخر 7 أيام' },
  { value: '30', label: 'Last 30 days', labelAr: 'آخر 30 يوم' },
  { value: '90', label: 'Last 90 days', labelAr: 'آخر 90 يوم' },
]

interface Props {
  isAr: boolean
  isGlobalAdmin: boolean
}

export default function PaymentFilters({ isAr, isGlobalAdmin: _isGlobalAdmin }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page') // reset to page 1 on filter change
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const selectCls =
    'h-9 rounded-xl border border-brand-border bg-brand-surface px-3 font-satoshi text-sm text-brand-text appearance-none focus:outline-none focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold/50 transition-colors'

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Days range */}
      <select
        value={searchParams.get('days') ?? '30'}
        onChange={(e) => update('days', e.target.value)}
        className={selectCls}
        aria-label={isAr ? 'النطاق الزمني' : 'Date range'}
      >
        {DAYS.map((d) => (
          <option key={d.value} value={d.value}>
            {isAr ? d.labelAr : d.label}
          </option>
        ))}
      </select>

      {/* Method filter */}
      <select
        value={searchParams.get('method') ?? ''}
        onChange={(e) => update('method', e.target.value)}
        className={selectCls}
        aria-label={isAr ? 'طريقة الدفع' : 'Payment method'}
      >
        {METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {isAr ? m.labelAr : m.label}
          </option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={searchParams.get('status') ?? ''}
        onChange={(e) => update('status', e.target.value)}
        className={selectCls}
        aria-label={isAr ? 'حالة المعاملة' : 'Payment status'}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {isAr ? s.labelAr : s.label}
          </option>
        ))}
      </select>
    </div>
  )
}
