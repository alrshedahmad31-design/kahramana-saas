import { NextResponse }              from 'next/server'
import { generateExcelTemplate }     from '@/lib/inventory/excel-template'
import { requireDashboardRole }      from '@/lib/auth/dashboard-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireDashboardRole(['owner', 'general_manager', 'branch_manager', 'inventory_manager'])
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const buffer = await generateExcelTemplate()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="kahramana-inventory-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
