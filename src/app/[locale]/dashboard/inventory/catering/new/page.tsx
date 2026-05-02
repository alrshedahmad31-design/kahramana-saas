import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import CateringOrderForm from '@/components/inventory/catering/CateringOrderForm'
import type { CateringPackageRow } from '@/lib/supabase/custom-types'

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function NewCateringOrderPage({ params }: PageProps) {
  const { locale } = await params
  const isAr  = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = createServiceClient()
  const isGlobal = user.role === 'owner' || user.role === 'general_manager'

  let branchId = user.branch_id ?? null
  if (isGlobal && !branchId) {
    const { data: firstBranch } = await supabase
      .from('branches')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()
    branchId = firstBranch?.id ?? null
  }

  if (!branchId) redirect(`${prefix}/dashboard/inventory/catering`)

  const { data: pkgData } = await supabase
    .from('catering_packages')
    .select('id, name_ar, name_en, min_guests, max_guests, price_per_person_bhd')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name_ar')

  const packages = (pkgData ?? []) as Pick<
    CateringPackageRow,
    'id' | 'name_ar' | 'name_en' | 'min_guests' | 'max_guests' | 'price_per_person_bhd'
  >[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div>
        <nav className="flex items-center gap-2 font-satoshi text-xs text-brand-muted">
          <Link
            href={`${prefix}/dashboard/inventory/catering`}
            className="hover:text-brand-gold transition-colors"
          >
            {isAr ? 'الكيترينج' : 'Catering'}
          </Link>
          <span className="text-brand-border">›</span>
          <span className="text-brand-text">{isAr ? 'جديد' : 'New'}</span>
        </nav>
        <h1 className="font-cairo text-2xl font-black text-brand-text mt-2">
          {isAr ? 'طلب كيترينج جديد' : 'New Catering Order'}
        </h1>
      </div>

      <CateringOrderForm
        mode="create"
        branchId={branchId}
        packages={packages}
        prefix={prefix}
        isAr={isAr}
      />
    </div>
  )
}
