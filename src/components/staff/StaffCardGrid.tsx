'use client'

import { useState }           from 'react'
import Link                   from 'next/link'
import { useTranslations }    from 'next-intl'
import type { StaffExtendedRow, StaffRole } from '@/lib/supabase/types'
import { toggleStaffActive }  from '@/app/[locale]/dashboard/staff/actions'
import { ROLE_RANK }          from '@/lib/auth/rbac'
import { BRANCH_LIST }        from '@/constants/contact'

interface Props {
  rows:           StaffExtendedRow[]
  manageableIds:  string[]
  callerRole:     StaffRole | null
  callerBranchId: string | null
  locale:         string
  onAddNew:       () => void
}

const ROLE_BADGE: Record<StaffRole, { bg: string; text: string }> = {
  owner:           { bg: 'bg-brand-gold/20',    text: 'text-brand-gold'    },
  general_manager: { bg: 'bg-brand-gold/10',    text: 'text-brand-gold'    },
  branch_manager:  { bg: 'bg-brand-success/20', text: 'text-brand-success' },
  cashier:         { bg: 'bg-brand-surface-2',  text: 'text-brand-muted'   },
  kitchen:         { bg: 'bg-brand-surface-2',  text: 'text-brand-muted'   },
  driver:          { bg: 'bg-brand-surface-2',  text: 'text-brand-muted'   },
  inventory:       { bg: 'bg-brand-surface-2',  text: 'text-brand-muted'   },
  marketing:       { bg: 'bg-brand-surface-2',  text: 'text-brand-muted'   },
  support:         { bg: 'bg-brand-surface-2',  text: 'text-brand-muted'   },
}

const EMPLOYMENT_LABELS: Record<string, { ar: string; en: string }> = {
  full_time: { ar: 'دوام كامل', en: 'Full-time' },
  part_time: { ar: 'دوام جزئي', en: 'Part-time' },
  contract:  { ar: 'عقد',       en: 'Contract'  },
  temporary: { ar: 'مؤقت',      en: 'Temporary' },
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function branchLabel(id: string | null, isAr: boolean) {
  if (!id) return isAr ? 'جميع الفروع' : 'All Branches'
  const b = BRANCH_LIST.find(b => b.id === id)
  return b ? (isAr ? b.nameAr : b.nameEn) : id
}

export default function StaffCardGrid({
  rows, manageableIds, callerRole, callerBranchId: _callerBranchId, locale, onAddNew,
}: Props) {
  const t  = useTranslations('dashboard.staff')
  const tR = useTranslations('dashboard.roles')
  const isAr = locale === 'ar'

  const [pending, setPending] = useState<string | null>(null)
  const [toast,   setToast]   = useState<string | null>(null)

  const manageable = new Set(manageableIds)
  const canCreate  = callerRole !== null && (ROLE_RANK[callerRole] ?? 0) >= ROLE_RANK['branch_manager']

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleToggle(member: StaffExtendedRow) {
    setPending(member.id)
    const result = await toggleStaffActive(member.id, !member.is_active, locale)
    setPending(null)
    if (result.success) showToast(member.is_active ? t('deactivateSuccess') : t('activateSuccess'))
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 end-6 z-50 bg-brand-surface border border-brand-gold
                        rounded-lg px-4 py-3 font-satoshi text-sm text-brand-text shadow-lg">
          {toast}
        </div>
      )}

      {/* Add button */}
      {canCreate && (
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={onAddNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-gold
                       text-brand-black font-cairo font-black text-sm
                       transition-colors hover:bg-brand-gold-light active:scale-[0.98]"
          >
            <PlusIcon />
            {isAr ? 'إضافة موظف' : 'Add Staff'}
          </button>
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map(member => {
          const badge     = ROLE_BADGE[member.role] ?? ROLE_BADGE.support
          const canManage = manageable.has(member.id)
          const empLabel  = member.employment_type
            ? (EMPLOYMENT_LABELS[member.employment_type]?.[isAr ? 'ar' : 'en'] ?? member.employment_type)
            : null

          return (
            <article
              key={member.id}
              className={`bg-brand-surface border-2 rounded-2xl p-5 flex flex-col gap-4
                transition-colors
                ${member.is_active ? 'border-brand-border' : 'border-brand-border/40 opacity-70'}`}
            >
              {/* Header: avatar + status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
                    shrink-0 font-cairo font-black text-xl overflow-hidden ${badge.bg} ${badge.text}`}>
                    {member.profile_photo_url ? (
                      <img src={member.profile_photo_url} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      initials(member.name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-cairo font-black text-brand-text text-lg leading-tight truncate">
                      {member.name}
                    </div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg
                      text-xs font-almarai font-bold ${badge.bg} ${badge.text}`}>
                      {tR(member.role)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0
                    ${member.is_active ? 'bg-brand-success' : 'bg-brand-muted'}`} />
                  <span className={`font-almarai text-xs
                    ${member.is_active ? 'text-brand-success' : 'text-brand-muted'}`}>
                    {isAr
                      ? (member.is_active ? 'نشط' : 'معطّل')
                      : (member.is_active ? 'Active' : 'Inactive')}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-center gap-2 text-brand-muted font-almarai">
                  <BranchIcon />
                  <span className="truncate">{branchLabel(member.branch_id, isAr)}</span>
                </div>

                {member.phone && (
                  <div className="flex items-center gap-2 text-brand-muted font-almarai">
                    <PhoneIcon />
                    <span dir="ltr" className="font-satoshi text-xs">{member.phone}</span>
                  </div>
                )}

                {empLabel && (
                  <div className="flex items-center gap-2 text-brand-muted font-almarai">
                    <WorkIcon />
                    <span>{empLabel}</span>
                    {member.hire_date && (
                      <span className="ms-auto font-satoshi text-xs tabular-nums text-brand-muted/70">
                        {new Date(member.hire_date).toLocaleDateString(
                          isAr ? 'ar-BH' : 'en-BH',
                          { year: 'numeric', month: 'short' },
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className={`grid gap-2 mt-auto pt-3 border-t border-brand-border
                ${canManage ? 'grid-cols-3' : 'grid-cols-1'}`}>
                <Link
                  href={`/${locale}/dashboard/staff/${member.id}`}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                             bg-brand-surface-2 text-brand-muted font-almarai text-xs font-bold
                             hover:text-brand-text transition-colors"
                >
                  <EyeIcon />
                  {isAr ? 'الملف' : 'View'}
                </Link>

                {canManage && (
                  <>
                    <Link
                      href={`/${locale}/dashboard/staff/${member.id}`}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                                 bg-brand-surface-2 text-brand-muted font-almarai text-xs font-bold
                                 hover:text-brand-gold transition-colors"
                    >
                      <EditIcon />
                      {isAr ? 'تعديل' : 'Edit'}
                    </Link>

                    <button
                      type="button"
                      disabled={pending === member.id}
                      onClick={() => handleToggle(member)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                        font-almarai text-xs font-bold transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${member.is_active
                          ? 'bg-brand-error/10 text-brand-error hover:bg-brand-error/20'
                          : 'bg-brand-success/10 text-brand-success hover:bg-brand-success/20'}`}
                    >
                      {pending === member.id
                        ? <SpinnerIcon />
                        : member.is_active
                          ? (isAr ? 'تعطيل' : 'Disable')
                          : (isAr ? 'تفعيل' : 'Enable')}
                    </button>
                  </>
                )}
              </div>
            </article>
          )
        })}

        {rows.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 gap-4
                          rounded-2xl bg-brand-surface border border-brand-border">
            <div className="w-16 h-16 rounded-2xl bg-brand-surface-2 flex items-center justify-center">
              <TeamIcon />
            </div>
            <p className={`font-black text-brand-muted text-lg
              ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
              {isAr ? 'لا يوجد موظفون' : 'No staff found'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
}
function BranchIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
}
function PhoneIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
}
function WorkIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" /></svg>
}
function EyeIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function EditIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
}
function SpinnerIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="animate-spin" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
}
function TeamIcon() {
  return <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-brand-muted" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
}
