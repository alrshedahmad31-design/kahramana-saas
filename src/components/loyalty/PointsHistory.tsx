'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import type { PointsTransactionRow, PointsTransactionType } from '@/lib/supabase/custom-types'

interface Props {
  transactions: PointsTransactionRow[]
}

const PAGE_SIZE = 10


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
      <div className="rounded-3xl border border-brand-border bg-brand-surface p-8 text-center">
        <p className={`text-lg font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {t('historyEmptyTitle')}
        </p>
        <p className={`mx-auto mt-3 max-w-md text-sm leading-6 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('historyEmptyCopy')}
        </p>
        <a
          href={isAr ? '/menu' : '/en/menu'}
          aria-label={t('browseMenu')}
          className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-gold px-5 py-3 text-sm font-bold text-brand-black transition-colors hover:bg-brand-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        >
          {t('browseMenu')}
        </a>
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
            aria-label={opt.label}
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
      <div className="overflow-hidden rounded-3xl border border-brand-border bg-brand-surface">
        <table className="w-full text-sm" dir={isAr ? 'rtl' : 'ltr'}>
          <thead>
            <tr className="border-b border-brand-border">
              {[
                t('historyColumns.date'),
                t('historyColumns.type'),
                t('historyColumns.order'),
                t('historyColumns.points'),
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-bold text-brand-muted uppercase tracking-wide text-start font-satoshi">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((tx) => {
              const shortOrderId = tx.order_id ? `#${tx.order_id.slice(-8).toUpperCase()}` : t('notLinked')
              const isEarned = tx.transaction_type === 'earned' || tx.transaction_type === 'bonus'
              const pointsValue = isEarned ? tx.points_earned : tx.points_spent
              
              return (
                <tr key={tx.id} className="border-b border-brand-border last:border-0 hover:bg-brand-surface-2 transition-colors">
                  <td className="px-4 py-3 font-satoshi text-xs text-brand-muted tabular-nums">
                    {/* `-u-nu-latn` keeps the date readable in Arabic with Latin digits
                        (same recipe as whatsapp.ts / MembershipCard). Switching the EN
                        tag to `en-GB` matches the Bahrain DD MMM YYYY ordering without
                        importing a new locale. */}
                    {new Date(tx.created_at).toLocaleDateString(isAr ? 'ar-BH-u-nu-latn' : 'en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className={`px-4 py-3 text-xs font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t(`transactions.${tx.transaction_type}`)}
                  </td>
                  <td className="px-4 py-3 font-satoshi text-xs text-brand-text font-bold tabular-nums">
                    {shortOrderId}
                  </td>
                  <td className={`px-4 py-3 font-satoshi tabular-nums font-bold ${isEarned ? 'text-brand-success' : 'text-brand-gold'}`}>
                    {isEarned ? `+${pointsValue}` : `-${pointsValue}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('noFilteredTransactions')}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-brand-border flex items-center justify-between">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              aria-label={t('paginationPrevious')}
              className="min-h-11 rounded-full px-3 font-satoshi text-sm text-brand-gold transition-colors hover:text-brand-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:opacity-30"
            >
              {t('paginationPrevious')}
            </button>
            <span className="font-satoshi text-xs text-brand-muted tabular-nums">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              aria-label={t('paginationNext')}
              className="min-h-11 rounded-full px-3 font-satoshi text-sm text-brand-gold transition-colors hover:text-brand-gold-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:opacity-30"
            >
              {t('paginationNext')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
