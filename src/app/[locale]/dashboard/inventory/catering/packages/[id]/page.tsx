import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/server'
import CateringPackageForm from '@/components/inventory/catering/CateringPackageForm'
import type { CateringPackageRow } from '@/lib/supabase/custom-types'

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function EditCateringPackagePage({ params }: PageProps) {
  const { locale, id } = await params
  const isAr  = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('catering_packages')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  const pkg = data as unknown as CateringPackageRow

  if (pkg.branch_id && !['owner', 'general_manager'].includes(user.role)) {
    if (pkg.branch_id !== user.branch_id) {
      redirect(`${prefix}/dashboard/inventory/catering`)
    }
  }

  const { data: menuData } = await supabase
    .from('menu_items_sync')
    .select('slug, name_ar, name_en')
    .order('name_ar')

  const menuItems = (menuData ?? []) as { slug: string; name_ar: string; name_en: string }[]

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
          <Link
            href={`${prefix}/dashboard/inventory/catering/packages`}
            className="hover:text-brand-gold transition-colors"
          >
            {isAr ? 'الباقات' : 'Packages'}
          </Link>
          <span className="text-brand-border">›</span>
          <span className="text-brand-text">{isAr ? pkg.name_ar : pkg.name_en}</span>
        </nav>
        <h1 className="font-cairo text-2xl font-black text-brand-text mt-2">
          {isAr ? pkg.name_ar : pkg.name_en}
        </h1>
      </div>

      <CateringPackageForm
        mode="edit"
        package={pkg}
        branchId={pkg.branch_id}
        menuItems={menuItems}
        prefix={prefix}
        isAr={isAr}
      />
    </div>
  )
}
