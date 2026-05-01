'use client'

import { useState } from 'react'

interface StockRow {
  branch_id: string
  ingredient_name_ar: string
  ingredient_name_en: string
  unit: string
  on_hand: number
  reserved: number
  catering_reserved: number
  reorder_point: number | null
  last_movement_at: string | null
}

interface Props {
  stocks: StockRow[]
  locale?: string
}

type SortKey = 'name' | 'on_hand' | 'reserved' | 'available' | 'last_movement_at'
type SortDir = 'asc' | 'desc'

function getAvailable(row: StockRow) {
  return row.on_hand - row.reserved - row.catering_reserved
}

function rowColorClass(row: StockRow): string {
  const available = getAvailable(row)
  if (available <= 0) return 'bg-red-500/5'
  if (row.reorder_point !== null && available <= row.reorder_point) return 'bg-brand-gold/5'
  return ''
}

function availableTextClass(row: StockRow): string {
  const available = getAvailable(row)
  if (available <= 0) return 'text-red-400 font-medium'
  if (row.reorder_point !== null && available <= row.reorder_point) return 'text-brand-gold font-medium'
  return 'text-brand-text'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function StockTable({ stocks, locale = 'ar' }: Props) {
  const isAr = locale === 'ar'
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...stocks].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'name':
        cmp = (isAr ? a.ingredient_name_ar : a.ingredient_name_en).localeCompare(
          isAr ? b.ingredient_name_ar : b.ingredient_name_en
        )
        break
      case 'on_hand':
        cmp = a.on_hand - b.on_hand
        break
      case 'reserved':
        cmp = a.reserved - b.reserved
        break
      case 'available':
        cmp = getAvailable(a) - getAvailable(b)
        break
      case 'last_movement_at':
        cmp = (a.last_movement_at ?? '').localeCompare(b.last_movement_at ?? '')
        break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="opacity-30 ms-1">↕</span>
    return <span className="ms-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function ThBtn({ col, children }: { col: SortKey; children: React.ReactNode }) {
    return (
      <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
        <button type="button" onClick={() => handleSort(col)} className="flex items-center gap-1 hover:text-brand-text transition-colors">
          {children}
          <SortIndicator col={col} />
        </button>
      </th>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="border border-brand-border rounded-xl p-8 text-center">
        <p className="font-satoshi text-sm text-brand-muted">
          {isAr ? 'لا توجد بيانات مخزون' : 'No stock data available'}
        </p>
      </div>
    )
  }

  return (
    <div className="border border-brand-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-brand-surface-2">
          <tr>
            <ThBtn col="name">{isAr ? 'المكوّن' : 'Ingredient'}</ThBtn>
            <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
              {isAr ? 'الوحدة' : 'Unit'}
            </th>
            <ThBtn col="on_hand">{isAr ? 'في المخزن' : 'On Hand'}</ThBtn>
            <ThBtn col="reserved">{isAr ? 'محجوز' : 'Reserved'}</ThBtn>
            <ThBtn col="available">{isAr ? 'المتاح' : 'Available'}</ThBtn>
            <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
              {isAr ? 'نقطة الإعادة' : 'Reorder Pt.'}
            </th>
            <ThBtn col="last_movement_at">{isAr ? 'آخر حركة' : 'Last Move'}</ThBtn>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-brand-border transition-colors ${rowColorClass(row)}`}
            >
              <td className="px-4 py-3 font-satoshi text-sm text-brand-text">
                {isAr ? row.ingredient_name_ar : row.ingredient_name_en}
              </td>
              <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">{row.unit}</td>
              <td className="px-4 py-3 font-satoshi text-sm text-brand-text">{row.on_hand}</td>
              <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">{row.reserved}</td>
              <td className={`px-4 py-3 font-satoshi text-sm ${availableTextClass(row)}`}>
                {getAvailable(row)}
              </td>
              <td className="px-4 py-3 font-satoshi text-sm text-brand-muted">
                {row.reorder_point ?? '—'}
              </td>
              <td className="px-4 py-3 font-satoshi text-xs text-brand-muted">
                {formatDate(row.last_movement_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
