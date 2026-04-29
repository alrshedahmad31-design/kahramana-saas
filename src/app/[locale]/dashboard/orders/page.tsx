import { requireAuth } from '@/lib/auth/session'
import OrdersClient   from '@/components/orders/OrdersClient'

export default async function OrdersPage() {
  const user = await requireAuth()
  return <OrdersClient userRole={user.role} />
}
