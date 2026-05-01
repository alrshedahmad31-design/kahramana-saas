import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SupplierPageClient from './SupplierPageClient'
import { upsertSupplier } from '../actions'

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function SuppliersPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const session = await getSession()
  if (!session) redirect(`${prefix}/login`)

  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) redirect(`${prefix}/dashboard`)

  const canEdit = ['owner', 'general_manager'].includes(session.role ?? '')

  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select(
      'id, name_ar, name_en, phone, email, lead_time_days, reliability_pct, payment_terms, is_active, created_at',
    )
    .order('name_ar')

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cairo text-2xl font-black text-brand-text">
            {isAr ? 'الموردون' : 'Suppliers'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-1">
            {isAr ? 'إدارة قائمة الموردين' : 'Manage supplier list'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${prefix}/dashboard/inventory/purchases`}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
          >
            {isAr ? '← رجوع' : '← Back'}
          </Link>
        </div>
      </div>

      <SupplierPageClient
        suppliers={(suppliers ?? []) as Array<{
          id: string; name_ar: string; name_en: string | null
          phone: string | null; email: string | null
          lead_time_days: number | null; reliability_pct: number | null
          payment_terms: string | null; is_active: boolean; created_at: string
        }>}
        locale={locale}
        canEdit={canEdit}
        action={upsertSupplier}
      />
    </div>
  )
}
