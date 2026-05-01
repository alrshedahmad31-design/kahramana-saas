import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { ParLevelRow } from '@/lib/supabase/custom-types'
import ParLevelEditor from '@/components/inventory/ParLevelEditor'
import { upsertParLevel } from './actions'

interface PageProps {
  params: Promise<{ locale: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

export default async function ParLevelsPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const { data } = await supabase
    .from('par_levels')
    .select('*, ingredient:ingredients(id,name_ar,unit), branch:branches(id,name_ar)')
    .order('branch_id')

  const parLevels = (data ?? []) as (ParLevelRow & {
    ingredient: { id: string; name_ar: string; unit: string } | null
    branch: { id: string; name_ar: string } | null
  })[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'مستويات Par' : 'Par Levels'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {isAr
            ? 'تحديد الكميات المستهدفة لكل مكوّن حسب الفرع ونوع اليوم'
            : 'Set target quantities per ingredient per branch and day type'}
        </p>
      </div>

      <ParLevelEditor
        parLevels={parLevels}
        saveAction={upsertParLevel}
        locale={locale}
      />
    </div>
  )
}
