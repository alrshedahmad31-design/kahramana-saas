import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import CountSheet from '@/components/inventory/CountSheet'
import { submitCountSession } from '../actions'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function CountNewPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const supabase = await createClient()

  const [{ data: branches }, { data: stock }] = await Promise.all([
    supabase.from('branches').select('id, name_ar').order('name_ar'),
    supabase
      .from('inventory_stock')
      .select(
        `ingredient_id, on_hand,
         ingredient:ingredients(name_ar, unit, barcode)`,
      )
      .order('ingredient_id'),
  ])

  type StockRow = {
    ingredient_id: string
    on_hand: number
    ingredient: { name_ar: string; unit: string; barcode: string | null } | null
  }

  const stockItems = ((stock ?? []) as StockRow[])
    .filter((s) => s.ingredient !== null)
    .map((s) => ({
      ingredient_id: s.ingredient_id,
      name_ar:       s.ingredient!.name_ar,
      unit:          s.ingredient!.unit,
      on_hand:       s.on_hand,
      barcode:       s.ingredient!.barcode,
    }))

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'جرد مخزون جديد' : 'New Inventory Count'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {isAr ? 'أدخل الكميات الفعلية لكل عنصر في المخزون' : 'Enter actual quantities for each inventory item'}
        </p>
      </div>

      <CountSheet
        branches={branches ?? []}
        stockItems={stockItems}
        locale={locale}
        action={submitCountSession}
      />
    </div>
  )
}
