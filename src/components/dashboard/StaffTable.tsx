'use client'

import { useState } from 'react'
import Link          from 'next/link'
import { useTranslations } from 'next-intl'
import type { StaffBasicRow, StaffRole } from '@/lib/supabase/custom-types'
import StaffForm from './StaffForm'
import { toggleStaffActive } from '@/app/[locale]/dashboard/staff/actions'
import { ROLE_RANK } from '@/lib/auth/rbac'
import { BRANCHES } from '@/constants/contact'

interface Props {
  rows:            StaffBasicRow[]
  manageableIds:   string[]
  callerRole:      StaffRole | null
  callerBranchId:  string | null
  locale:          string
}

export default function StaffTable({
  rows,
  manageableIds,
  callerRole,
  callerBranchId,
  locale,
}: Props) {
  const t  = useTranslations('dashboard.staff')
  const tR = useTranslations('dashboard.roles')
  const isAr = locale === 'ar'

  const [editTarget, setEditTarget]   = useState<StaffBasicRow | null>(null)
  const [showCreate, setShowCreate]   = useState(false)
  const [pending,    setPending]      = useState<string | null>(null)
  const [toast,      setToast]        = useState<string | null>(null)

  const manageable = new Set(manageableIds)

  const canCreate = callerRole !== null && (ROLE_RANK[callerRole] ?? 0) >= ROLE_RANK['branch_manager']

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleToggle(member: StaffBasicRow) {
    setPending(member.id)
    const result = await toggleStaffActive(member.id, !member.is_active, locale)
    setPending(null)
    if (result.success) {
      showToast(member.is_active ? t('deactivateSuccess') : t('activateSuccess'))
    }
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 end-6 z-50 bg-brand-surface border border-brand-gold rounded-lg
                        px-4 py-3 font-satoshi text-sm text-brand-text shadow-lg">
          {toast}
        </div>
      )}

      {/* Header action */}
      {canCreate && (
        <div className="flex justify-end" dir={isAr ? 'rtl' : 'ltr'}>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            aria-label={t('add')}
            className="flex items-center gap-2 bg-brand-gold text-brand-black
                       font-satoshi font-medium text-sm rounded-lg px-4 py-2.5
                       hover:bg-brand-gold-light active:scale-95
                       transition-all duration-150 min-h-[40px]"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('add')}
          </button>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-10 text-center">
          <p className="font-satoshi text-brand-muted">{t('noStaff')}</p>
        </div>
      ) : (
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  {[t('name'), t('role'), t('branch'), t('status'), 'actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-start font-satoshi font-medium text-brand-muted
                                 text-xs uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-brand-border last:border-0
                               hover:bg-brand-surface-2 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <Link
                        href={`${locale === 'en' ? '/en' : ''}/dashboard/staff/${member.id}`}
                        className="block hover:text-brand-gold transition-colors duration-150"
                      >
                        <p className="font-satoshi font-medium text-brand-text">{member.name}</p>
                        <p className="font-satoshi text-xs text-brand-muted tabular-nums">
                          #{member.id.slice(0, 8).toUpperCase()}
                        </p>
                      </Link>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3 font-satoshi text-brand-muted capitalize">
                      {tR(member.role as Parameters<typeof tR>[0])}
                    </td>

                    {/* Branch */}
                    <td className="px-4 py-3 font-satoshi text-brand-muted">
                      {member.branch_id
                        ? (BRANCHES[member.branch_id as keyof typeof BRANCHES]?.[isAr ? 'nameAr' : 'nameEn'] ?? member.branch_id)
                        : '—'}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5
                                    font-satoshi text-xs font-medium
                                    ${member.is_active
                                      ? 'bg-brand-success/15 text-brand-success'
                                      : 'bg-brand-error/15 text-brand-error'
                                    }`}
                      >
                        {member.is_active ? t('active') : t('inactive')}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-end">
                      {manageable.has(member.id) && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditTarget(member)}
                            aria-label={`${t('edit')} ${member.name}`}
                            className="font-satoshi text-xs text-brand-muted
                                       hover:text-brand-gold transition-colors duration-150
                                       min-h-[44px] px-3 border border-brand-border rounded-lg"
                          >
                            {t('edit')}
                          </button>
                          <button
                            type="button"
                            disabled={pending === member.id}
                            onClick={() => handleToggle(member)}
                            aria-label={`${member.is_active ? t('deactivate') : t('activate')} ${member.name}`}
                            className={`font-satoshi text-xs transition-colors duration-150
                                        min-h-[44px] px-3 border border-brand-border rounded-lg
                                        ${member.is_active
                                          ? 'text-brand-error hover:text-brand-error/10 border-brand-error/20'
                                          : 'text-brand-success hover:text-brand-success/10 border-brand-success/20'
                                        }
                                        disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            {pending === member.id
                              ? '...'
                              : member.is_active ? t('deactivate') : t('activate')
                            }
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col divide-y divide-brand-border">
            {rows.map((member) => (
              <div key={member.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Link
                      href={`${locale === 'en' ? '/en' : ''}/dashboard/staff/${member.id}`}
                      className="font-black text-brand-text hover:text-brand-gold transition-colors"
                    >
                      {member.name}
                    </Link>
                    <p className="text-xs text-brand-muted mt-0.5 tabular-nums uppercase">
                      #{member.id.slice(0, 8)} · {tR(member.role as Parameters<typeof tR>[0])}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                ${member.is_active
                                  ? 'bg-brand-success/15 text-brand-success'
                                  : 'bg-brand-error/15 text-brand-error'
                                }`}
                  >
                    {member.is_active ? t('active') : t('inactive')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-brand-muted">
                  <span>
                    {member.branch_id
                      ? (BRANCHES[member.branch_id as keyof typeof BRANCHES]?.[isAr ? 'nameAr' : 'nameEn'] ?? member.branch_id)
                      : '—'}
                  </span>
                </div>

                {manageable.has(member.id) && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditTarget(member)}
                      className="flex-1 min-h-[44px] bg-brand-surface-2 border border-brand-border rounded-xl text-xs font-bold text-brand-text"
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      disabled={pending === member.id}
                      onClick={() => handleToggle(member)}
                      className={`flex-1 min-h-[44px] border rounded-xl text-xs font-bold
                                  ${member.is_active
                                    ? 'bg-brand-error/5 border-brand-error/20 text-brand-error'
                                    : 'bg-brand-success/5 border-brand-success/20 text-brand-success'
                                  } disabled:opacity-40`}
                    >
                      {pending === member.id
                        ? '...'
                        : member.is_active ? t('deactivate') : t('activate')
                      }
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <StaffForm
          mode="create"
          callerRole={callerRole}
          callerBranchId={callerBranchId}
          locale={locale}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); showToast(t('createSuccess')) }}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <StaffForm
          mode="edit"
          target={editTarget}
          callerRole={callerRole}
          callerBranchId={callerBranchId}
          locale={locale}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); showToast(t('updateSuccess')) }}
        />
      )}
    </>
  )
}
