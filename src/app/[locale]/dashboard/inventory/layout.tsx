import { redirect }       from 'next/navigation'
import { getSession }      from '@/lib/auth/session'
import { createClient }    from '@/lib/supabase/server'
import { BranchProvider }  from '@/components/inventory/BranchContext'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

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

  const supabase = await createClient()
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name_ar, name_en')
    .eq('is_active', true)
    .order('name_ar')

  const branchList = branches ?? []
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
