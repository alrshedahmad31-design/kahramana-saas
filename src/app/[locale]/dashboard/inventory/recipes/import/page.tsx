import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import RecipeImportClient from '@/components/inventory/RecipeImportClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'inventory_manager'] as const

export default async function RecipeImportPage({ params }: Props) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  const [recipesRes, menuItemsRes] = await Promise.all([
    supabase.from('recipes').select('menu_item_slug', { count: 'exact', head: true }),
    supabase.from('menu_items_sync').select('slug', { count: 'exact', head: true }),
  ])

  const mappedCount = recipesRes.count ?? 0
  const menuItemCount = menuItemsRes.count ?? 0

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'استيراد وصفات الشيف' : 'Import Chef Recipes'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {isAr
            ? 'استيراد ربط الوصفات بالمكونات من ملف Excel لتفعيل خصم المخزون عند الطلبات.'
            : 'Import dish↔ingredient mappings from an Excel sheet so live orders deduct inventory correctly.'}
        </p>
        <p className="font-satoshi text-xs text-brand-muted mt-2">
          {isAr
            ? `الحالة الآن: ${mappedCount}/${menuItemCount} طبق مرتبط بوصفة`
            : `Current state: ${mappedCount}/${menuItemCount} dishes mapped to a recipe`}
        </p>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface p-5">
        <h2 className="font-cairo text-sm font-bold text-brand-text mb-3">
          {isAr ? 'صيغة الملف المتوقعة' : 'Expected file shape'}
        </h2>
        <p className="font-satoshi text-xs text-brand-muted mb-3">
          {isAr
            ? 'ورقة واحدة، الصف الأول عناوين، الأعمدة بالترتيب:'
            : 'Single sheet, row 1 is the header, columns in this order:'}
        </p>
        <ol className="list-decimal ps-5 space-y-1 font-satoshi text-sm text-brand-text">
          <li><code className="font-mono text-brand-gold">menu_item_slug</code> — {isAr ? 'الرمز كما هو في قائمة الطعام' : 'as listed in the menu'}</li>
          <li><code className="font-mono text-brand-gold">ingredient_id</code> — {isAr ? 'معرّف UUID للمكوّن' : 'UUID of the ingredient'}</li>
          <li><code className="font-mono text-brand-gold">quantity_used</code> — {isAr ? 'كمية المكوّن المستخدمة في الطبق الواحد' : 'amount used per dish'}</li>
          <li><code className="font-mono text-brand-gold">unit</code> — {isAr ? 'وحدة القياس (للتوثيق فقط — تُؤخذ فعلياً من جدول المكونات)' : 'unit (informational only — actual unit comes from the ingredients table)'}</li>
        </ol>
        <div className="mt-4">
          <Link
            href={`${prefix}/dashboard/inventory/ingredients`}
            className="inline-block font-satoshi text-xs text-brand-gold hover:underline"
          >
            {isAr ? 'فتح قائمة المكونات لمعرفة المعرّفات →' : 'Open ingredients list to look up IDs →'}
          </Link>
        </div>
      </div>

      <RecipeImportClient locale={locale} />
    </div>
  )
}
