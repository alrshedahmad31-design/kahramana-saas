'use client'

import { useState }       from 'react'
import type { StaffExtendedRow, StaffRole } from '@/lib/supabase/types'
import StaffTable         from '@/components/dashboard/StaffTable'
import StaffCardGrid      from './StaffCardGrid'
import StaffFormWizard    from './StaffFormWizard'

interface Props {
  rows:           StaffExtendedRow[]
  manageableIds:  string[]
  callerRole:     StaffRole | null
  callerBranchId: string | null
  locale:         string
}

type View = 'table' | 'card'

export default function StaffViewManager({
  rows, manageableIds, callerRole, callerBranchId, locale,
}: Props) {
  const isAr = locale === 'ar'
  const [view,       setView]       = useState<View>('table')
  const [showWizard, setShowWizard] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      {/* View toggle */}
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-1 bg-brand-surface-2 border border-brand-border rounded-xl p-1">
          <button
            type="button"
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-almarai font-bold
              transition-colors ${view === 'table'
                ? 'bg-brand-gold text-brand-black'
                : 'text-brand-muted hover:text-brand-text'}`}
          >
            <TableIcon />
            {isAr ? 'جدول' : 'Table'}
          </button>
          <button
            type="button"
            onClick={() => setView('card')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-almarai font-bold
              transition-colors ${view === 'card'
                ? 'bg-brand-gold text-brand-black'
                : 'text-brand-muted hover:text-brand-text'}`}
          >
            <GridIcon />
            {isAr ? 'بطاقات' : 'Cards'}
          </button>
        </div>
      </div>

      {/* View content */}
      {view === 'table' ? (
        <StaffTable
          rows={rows}
          manageableIds={manageableIds}
          callerRole={callerRole}
          callerBranchId={callerBranchId}
          locale={locale}
        />
      ) : (
        <StaffCardGrid
          rows={rows}
          manageableIds={manageableIds}
          callerRole={callerRole}
          callerBranchId={callerBranchId}
          locale={locale}
          onAddNew={() => setShowWizard(true)}
        />
      )}

      {/* Wizard */}
      {showWizard && (
        <StaffFormWizard
          locale={locale}
          callerRole={callerRole}
          onClose={() => setShowWizard(false)}
          onSuccess={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function TableIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m-19.5 0h18" /></svg>
}
function GridIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
}
