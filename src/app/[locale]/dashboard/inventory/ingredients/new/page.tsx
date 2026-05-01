import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import IngredientForm from '@/components/inventory/IngredientForm'
import { upsertIngredient } from '../[id]/actions'

interface PageProps {
  params: Promise<{ locale: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

export default async function NewIngredientPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name_ar, name_en')
    .eq('is_active', true)
    .order('name_ar')

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`${prefix}/dashboard/inventory/ingredients`}
            className="font-satoshi text-sm text-brand-muted hover:text-brand-gold transition-colors"
          >
            {isAr ? 'المكونات' : 'Ingredients'}
          </Link>
          <span className="text-brand-muted">/</span>
          <span className="font-satoshi text-sm text-brand-text">{isAr ? 'مكوّن جديد' : 'New Ingredient'}</span>
        </div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'إضافة مكوّن جديد' : 'Add New Ingredient'}
        </h1>
        <p className="font-satoshi text-sm text-brand-muted mt-1">
          {isAr ? 'أدخل بيانات المكوّن الجديد' : 'Enter the details for the new ingredient'}
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
        <IngredientForm
          suppliers={suppliers ?? []}
          locale={locale}
          action={upsertIngredient}
        />
      </div>
    </div>
  )
}
