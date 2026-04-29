'use client'

import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'

export default function StaffSettings() {
  const isAr   = useLocale() === 'ar'
  const font   = isAr ? 'font-almarai' : 'font-satoshi'
  const locale = isAr ? 'ar' : 'en'
  const router = useRouter()

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'إدارة الفريق' : 'Team Management'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr
            ? 'إضافة وإدارة حسابات الموظفين وصلاحياتهم'
            : 'Add and manage staff accounts and their permissions'}
        </p>
      </div>

      {/* Staff Management Link Card */}
      <div
        onClick={() => router.push(`/${locale}/dashboard/staff`)}
        className="group flex items-center justify-between gap-4 px-6 py-6 rounded-2xl border border-brand-border
          bg-brand-surface-2 hover:border-brand-gold/40 hover:bg-brand-surface cursor-pointer transition-all duration-200"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0">
            <UsersIcon className="w-6 h-6 text-brand-gold" />
          </div>
          <div>
            <span className={`text-base font-black text-brand-text block group-hover:text-brand-gold transition-colors ${font}`}>
              {isAr ? 'إدارة الموظفين' : 'Staff Management'}
            </span>
            <span className={`text-xs text-brand-muted ${font}`}>
              {isAr
                ? 'إضافة موظفين، تعديل الأدوار، إدارة الصلاحيات'
                : 'Add staff, edit roles, manage permissions'}
            </span>
          </div>
        </div>
        <ArrowIcon className={`w-5 h-5 text-brand-muted group-hover:text-brand-gold transition-all duration-200
          group-hover:translate-x-1 ${isAr ? 'rotate-180 group-hover:-translate-x-1 group-hover:translate-x-0' : ''}`} />
      </div>

      {/* Quick stats placeholder */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { labelAr: 'إجمالي الموظفين', labelEn: 'Total Staff',       glyph: '👥' },
          { labelAr: 'نشطون الآن',      labelEn: 'Active Now',        glyph: '🟢' },
          { labelAr: 'الأدوار',         labelEn: 'Roles Configured',  glyph: '🔑' },
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border border-brand-border bg-brand-surface-2">
            <span className="text-2xl">{item.glyph}</span>
            <span className={`text-[11px] text-brand-muted text-center ${font}`}>
              {isAr ? item.labelAr : item.labelEn}
            </span>
          </div>
        ))}
      </div>

      {/* Roles coming soon */}
      <div className="flex flex-col gap-3">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
        </label>
        <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-2xl border border-brand-border border-dashed">
          <p className={`text-brand-muted text-sm font-bold ${font}`}>
            {isAr ? 'إدارة الأدوار المخصصة — قريباً' : 'Custom Role Management — Coming Soon'}
          </p>
          <p className={`text-brand-muted/50 text-xs ${font}`}>
            {isAr ? 'الأدوار الحالية: مالك، مدير، موظف، طاهٍ، سائق' : 'Current roles: Owner, Manager, Staff, Chef, Driver'}
          </p>
        </div>
      </div>
    </div>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
