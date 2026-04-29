'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import type { PointsTransactionRow, PointsTransactionType } from '@/lib/supabase/types'

interface Props {
  transactions: PointsTransactionRow[]
}

const PAGE_SIZE = 10

const TYPE_STYLES: Record<PointsTransactionType, string> = {
  earned:   'text-brand-success',
  redeemed: 'text-brand-gold',
  expired:  'text-brand-error',
  bonus:    'text-brand-gold',
}

export default function PointsHistory({ transactions }: Props) {
  const t      = useTranslations('account')
  const locale = useLocale()
  const isAr   = locale === 'ar'

  const [filter, setFilter] = useState<PointsTransactionType | 'all'>('all')
  const [page,   setPage]   = useState(1)

  const filtered = filter === 'all' ? transactions : transactions.filter(tx => tx.transaction_type === filter)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const FILTER_OPTIONS: Array<{ value: PointsTransactionType | 'all'; label: string }> = [
    { value: 'all',      label: isAr ? 'الكل' : 'All'      },
    { value: 'earned',   label: t('transactions.earned')   },
    { value: 'redeemed', label: t('transactions.redeemed') },
    { value: 'bonus',    label: t('transactions.bonus')    },
    { value: 'expired',  label: t('transactions.expired')  },
  ]

  if (transactions.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
        <p className={`text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('noTransactions')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2" dir={isAr ? 'rtl' : 'ltr'}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setFilter(opt.value); setPage(1) }}
            className={`font-satoshi text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors duration-150
              ${filter === opt.value
                ? 'bg-brand-gold text-brand-black border-brand-gold'
                : 'bg-brand-surface-2 text-brand-muted border-brand-border hover:border-brand-gold/40'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm" dir={isAr ? 'rtl' : 'ltr'}>
          <thead>
            <tr className="border-b border-brand-border">
              {[
                isAr ? 'التاريخ' : 'Date',
                isAr ? 'النوع'   : 'Type',
                isAr ? 'مكتسبة'  : 'Earned',
                isAr ? 'مستخدمة' : 'Spent',
                isAr ? 'الرصيد'  : 'Balance',
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-bold text-brand-muted uppercase tracking-wide text-start font-satoshi">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((tx) => (
              <tr key={tx.id} className="border-b border-brand-border last:border-0 hover:bg-brand-surface-2 transition-colors">
                <td className="px-4 py-3 font-satoshi text-xs text-brand-muted tabular-nums">
                  {new Date(tx.created_at).toLocaleDateString(isAr ? 'ar-BH' : 'en-BH', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-satoshi text-xs font-bold capitalize ${TYPE_STYLES[tx.transaction_type]}`}>
                    {t(`transactions.${tx.transaction_type}`)}
                  </span>
                  {tx.description && (
                    <p className="font-satoshi text-xs text-brand-muted mt-0.5 line-clamp-1">{tx.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 font-satoshi tabular-nums text-brand-success font-medium">
                  {tx.points_earned > 0 ? `+${tx.points_earned}` : '—'}
                </td>
                <td className="px-4 py-3 font-satoshi tabular-nums text-brand-gold font-medium">
                  {tx.points_spent > 0 ? `-${tx.points_spent}` : '—'}
                </td>
                <td className="px-4 py-3 font-satoshi tabular-nums text-brand-text font-bold">
                  {tx.balance_after.toLocaleString('en-US')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-brand-border flex items-center justify-between">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="font-satoshi text-sm text-brand-gold disabled:opacity-30 hover:text-brand-gold-light transition-colors"
            >
              {isAr ? 'التالي' : 'Prev'}
            </button>
            <span className="font-satoshi text-xs text-brand-muted tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="font-satoshi text-sm text-brand-gold disabled:opacity-30 hover:text-brand-gold-light transition-colors"
            >
              {isAr ? 'السابق' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
