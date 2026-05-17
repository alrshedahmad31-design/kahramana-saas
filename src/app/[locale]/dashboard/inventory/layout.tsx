import { redirect }       from 'next/navigation'
import { getSession }      from '@/lib/auth/session'
import { getActiveBranches }   from '@/lib/branches/queries'
import { BranchProvider }  from '@/components/inventory/BranchContext'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'

// P1-22: 'kitchen' is whitelisted on the recipes/ingredients/waste sections
// in SECTION_ROLES (rbac-ui.ts). Layout gate must allow them to reach those
// pages — individual pages still enforce per-section role checks.
const ALLOWED_ROLES = [
  'owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen',
] as const

interface Props {
  children: React.ReactNode
  params:   Promise<{ locale: string }>
}

export default async function InventoryLayout({ children, params }: Props) {
  const { locale } = await params
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)

  const roleAllowed = ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])
  if (!roleAllowed) redirect(`${prefix}/dashboard`)

  const isGlobal = user.role === 'owner' || user.role === 'general_manager'

  const branchList = await getActiveBranches()
  const defaultBranchId = isGlobal
    ? (branchList[0]?.id ?? null)
    : (user.branch_id ?? null)

  return (
    <BranchProvider branches={branchList} defaultBranchId={defaultBranchId} isGlobal={isGlobal}>
      <div className="flex flex-col gap-5">
        <InventoryBreadcrumb prefix={prefix} locale={locale} />
        {children}
      </div>
    </BranchProvider>
  )
}
