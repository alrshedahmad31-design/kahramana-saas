import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth/session'
import PrepItemForm from '@/components/inventory/PrepItemForm'
import { upsertPrepItem } from '../[id]/actions'

interface PageProps {
  params: Promise<{ locale: string }>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

export default async function NewPrepItemPage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number])) {
    redirect(`${prefix}/dashboard`)
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`${prefix}/dashboard/inventory/prep-items`}
            className="font-satoshi text-sm text-brand-muted hover:text-brand-gold transition-colors"
          >
            Prep Items
          </Link>
          <span className="text-brand-muted">/</span>
          <span className="font-satoshi text-sm text-brand-text">
            {isAr ? 'جديد' : 'New'}
          </span>
        </div>
        <h1 className="font-cairo text-2xl font-black text-brand-text">
          {isAr ? 'إضافة Prep Item جديد' : 'Add New Prep Item'}
        </h1>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-6">
        <PrepItemForm
          locale={locale}
          action={upsertPrepItem}
        />
      </div>
    </div>
  )
}
