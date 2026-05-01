import { generateExcelTemplate } from '@/lib/inventory/excel-template'

export const dynamic = 'force-dynamic'

export async function GET() {
  const buffer = await generateExcelTemplate()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="kahramana-inventory-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
