'use client'

import { useState, useMemo } from 'react'
import { useLocale } from 'next-intl'
import ProfileSettings       from '@/components/settings/ProfileSettings'
import SecuritySettings      from '@/components/settings/SecuritySettings'
import BranchesSettings      from '@/components/settings/BranchesSettings'
import HoursSettings         from '@/components/settings/HoursSettings'
import MenuSettings          from '@/components/settings/MenuSettings'
import PaymentSettings       from '@/components/settings/PaymentSettings'
import NotificationsSettings from '@/components/settings/NotificationsSettings'
import IntegrationsSettings  from '@/components/settings/IntegrationsSettings'
import StaffSettings         from '@/components/settings/StaffSettings'
import AppearanceSettings    from '@/components/settings/AppearanceSettings'
import type { StaffRole } from '@/lib/supabase/custom-types'

type TabId =
  | 'profile' | 'security'
  | 'branches' | 'hours' | 'menu'
  | 'payment'
  | 'notifications' | 'integrations'
  | 'staff'
  | 'appearance'

interface TabDef {
  id:      TabId
  labelAr: string
  labelEn: string
  icon:    React.FC<{ className?: string }>
}

interface Group {
  id:      string
  labelAr: string
  labelEn: string
  tabs:    TabDef[]
}

const GROUPS: Group[] = [
  {
    id: 'account', labelAr: 'الحساب', labelEn: 'Account',
    tabs: [
      { id: 'profile',  labelAr: 'الملف الشخصي', labelEn: 'Profile',  icon: ProfileIcon },
      { id: 'security', labelAr: 'الأمان',        labelEn: 'Security', icon: ShieldIcon  },
    ],
  },
  {
    id: 'restaurant', labelAr: 'المطعم', labelEn: 'Restaurant',
    tabs: [
      { id: 'branches', labelAr: 'الفروع',          labelEn: 'Branches',       icon: BranchIcon },
      { id: 'hours',    labelAr: 'أوقات العمل',     labelEn: 'Business Hours', icon: ClockIcon  },
      { id: 'menu',     labelAr: 'إعدادات القائمة', labelEn: 'Menu Settings',  icon: MenuIcon   },
    ],
  },
  {
    id: 'billing', labelAr: 'المدفوعات', labelEn: 'Payments & Billing',
    tabs: [
      { id: 'payment', labelAr: 'طرق الدفع', labelEn: 'Payment Methods', icon: CardIcon },
    ],
  },
  {
    id: 'system', labelAr: 'النظام', labelEn: 'System',
    tabs: [
      { id: 'notifications', labelAr: 'الإشعارات', labelEn: 'Notifications', icon: BellIcon },
      { id: 'integrations',  labelAr: 'التكاملات',  labelEn: 'Integrations',  icon: PlugIcon },
    ],
  },
  {
    id: 'team', labelAr: 'الفريق', labelEn: 'Team',
    tabs: [
      { id: 'staff', labelAr: 'الموظفون', labelEn: 'Staff Management', icon: UsersIcon },
    ],
  },
  {
    id: 'preferences', labelAr: 'التفضيلات', labelEn: 'Preferences',
    tabs: [
      { id: 'appearance', labelAr: 'المظهر', labelEn: 'Appearance', icon: PaletteIcon },
    ],
  },
]

interface Props {
  userRole: StaffRole | null
}

export default function SettingsClient({ userRole: _userRole }: Props) {
  const isAr = useLocale() === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  const [activeTab,  setActiveTab]  = useState<TabId>('profile')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search,     setSearch]     = useState('')

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return GROUPS
    return GROUPS.map(g => ({
      ...g,
      tabs: g.tabs.filter(t =>
        t.labelAr.includes(q) || t.labelEn.toLowerCase().includes(q)
      ),
    })).filter(g => g.tabs.length > 0)
  }, [search])

  const activeTab_def = GROUPS.flatMap(g => g.tabs).find(t => t.id === activeTab)

  function select(id: TabId) {
    setActiveTab(id)
    setMobileOpen(false)
    setSearch('')
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0 min-h-[calc(100vh-4rem)]" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── Mobile header ── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-brand-surface border-b border-brand-border">
        <span className={`font-black text-brand-text text-sm ${font}`}>
          {isAr ? activeTab_def?.labelAr : activeTab_def?.labelEn}
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(v => !v)}
          className="text-brand-muted hover:text-brand-text transition-colors"
          aria-label="Toggle settings menu"
        >
          <BurgerIcon />
        </button>
      </div>

      {/* ── Sidebar ── */}
      <aside className={`
        ${mobileOpen ? 'block' : 'hidden'} lg:block
        w-full lg:w-64 shrink-0
        bg-brand-surface border-e border-brand-border
        lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto
      `}>
        <div className="px-4 pt-5 pb-3">
          <div className="relative">
            <SearchIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isAr ? 'البحث في الإعدادات…' : 'Search settings…'}
              className={`w-full ps-9 pe-3 py-2 rounded-lg bg-brand-surface-2 border border-brand-border
                text-brand-text text-xs placeholder:text-brand-muted/50 outline-none
                focus:border-brand-gold/40 transition-colors ${font}`}
            />
          </div>
        </div>

        <nav className="px-3 pb-6 flex flex-col gap-5">
          {filteredGroups.map(group => (
            <div key={group.id} className="flex flex-col gap-0.5">
              <p className={`text-[10px] font-black uppercase tracking-widest text-brand-muted/60 px-2 mb-1 ${font}`}>
                {isAr ? group.labelAr : group.labelEn}
              </p>
              {group.tabs.map(tab => {
                const Icon     = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => select(tab.id)}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-bold
                      transition-all duration-150 text-start
                      ${isActive
                        ? 'bg-brand-gold text-brand-black'
                        : 'text-brand-muted hover:text-brand-text hover:bg-brand-surface-2'}
                      ${font}
                    `}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isAr ? tab.labelAr : tab.labelEn}</span>
                  </button>
                )
              })}
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <p className={`text-brand-muted text-xs text-center py-4 ${font}`}>
              {isAr ? 'لا توجد نتائج' : 'No results found'}
            </p>
          )}
        </nav>
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        {activeTab === 'profile'       && <ProfileSettings />}
        {activeTab === 'security'      && <SecuritySettings />}
        {activeTab === 'branches'      && <BranchesSettings />}
        {activeTab === 'hours'         && <HoursSettings />}
        {activeTab === 'menu'          && <MenuSettings />}
        {activeTab === 'payment'       && <PaymentSettings />}
        {activeTab === 'notifications' && <NotificationsSettings />}
        {activeTab === 'integrations'  && <IntegrationsSettings />}
        {activeTab === 'staff'         && <StaffSettings />}
        {activeTab === 'appearance'    && <AppearanceSettings />}
      </main>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────────────

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  )
}
function BranchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M4.5 20.999V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  )
}
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}
function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}
function PlugIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  )
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}
function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  )
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}
function BurgerIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}
