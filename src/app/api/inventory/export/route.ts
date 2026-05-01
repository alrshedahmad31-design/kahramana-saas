import { exportInventoryExcel } from '@/lib/inventory/export'
import { getSession }           from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSession()
  if (!user || !['owner', 'general_manager'].includes(user.role ?? '')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const buffer = await exportInventoryExcel()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="kahramana-inventory-export.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
