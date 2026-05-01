import { redirect }        from 'next/navigation'
import { getSession }      from '@/lib/auth/session'
import { createClient }    from '@/lib/supabase/server'
import ImportDropzone      from '@/components/inventory/ImportDropzone'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ locale: string }> }

export default async function InventoryImportPage({ params }: Props) {
  const { locale } = await params
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)

  if (!['owner', 'general_manager'].includes(user.role ?? '')) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const [{ data: branches }, { data: slugRows }] = await Promise.all([
    supabase.from('branches').select('id, name_ar, name_en').eq('is_active', true),
    supabase.from('menu_items_sync').select('slug, name_ar').order('name_ar'),
  ])

  const isAr = locale === 'ar'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'استيراد بيانات المخزون' : 'Inventory Data Import'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {isAr
            ? 'حمّل نموذج Excel، أدخل البيانات، ثم ارفع الملف لاستيراد المكونات والوصفات والأرصدة.'
            : 'Download the Excel template, fill in your data, then upload to import ingredients, recipes and stock.'}
        </p>
      </div>

      <ImportDropzone
        branches={branches ?? []}
        menuSlugs={(slugRows ?? []).map((r) => r.slug)}
        locale={locale}
      />
    </div>
  )
}
