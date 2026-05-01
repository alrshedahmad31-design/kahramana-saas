import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import WasteForm from '@/components/inventory/WasteForm'
import { createWasteLog } from '../actions'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function WasteNewPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'kitchen', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const supabase = await createClient()

  const [{ data: branches }, { data: ingredients }] = await Promise.all([
    supabase.from('branches').select('id, name_ar').order('name_ar'),
    supabase
      .from('ingredients')
      .select('id, name_ar, name_en, unit, cost_per_unit')
      .eq('is_active', true)
      .order('name_ar'),
  ])

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'تسجيل هدر جديد' : 'Log New Waste'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {isAr ? 'أدخل تفاصيل المواد التالفة أو المهدرة' : 'Enter details for wasted or damaged items'}
        </p>
      </div>

      <WasteForm
        branches={branches ?? []}
        ingredients={(ingredients ?? []) as Array<{ id: string; name_ar: string; name_en: string; unit: string; cost_per_unit: number }>}
        locale={locale}
        action={createWasteLog}
        defaultBranchId={session.branch_id ?? undefined}
      />
    </div>
  )
}
