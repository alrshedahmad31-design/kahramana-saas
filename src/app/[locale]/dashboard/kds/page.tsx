import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canAccessKDS } from '@/lib/auth/rbac'
import { createServiceClient } from '@/lib/supabase/server'
import KDSBoard from '@/components/kds/KDSBoard'
import type { KDSOrder } from '@/lib/supabase/custom-types'

interface Props {
  params: Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export default async function KDSPage({ params }: Props) {
  const { locale } = await params

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessKDS(user)) redirect(`/${locale}/dashboard`)

  const supabase = await createServiceClient()

  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items(id, name_ar, name_en, quantity, selected_size, selected_variant)
    `)
    .in('status', ['accepted', 'preparing', 'ready'])
    .order('created_at', { ascending: true })

  if (user.branch_id) {
    query = query.eq('branch_id', user.branch_id)
  }

  const { data } = await query

  return (
    <div className="h-[calc(100dvh-4rem)] overflow-hidden">
      <KDSBoard
        initialOrders={(data ?? []) as unknown as KDSOrder[]}
        locale={locale}
        branchId={user.branch_id ?? null}
      />
    </div>
  )
}
