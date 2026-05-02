'use server'

export async function exportToExcel(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
  sheetName: string,
): Promise<{ base64?: string; error?: string }> {
  try {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(sheetName)
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 22 }))
    rows.forEach((r) => ws.addRow(r))
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D180B' },
    }
    const buffer = await wb.xlsx.writeBuffer()
    return { base64: Buffer.from(buffer as ArrayBuffer).toString('base64') }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Export failed' }
  }
}

export async function callUpdateAbcClassification(): Promise<{ error?: string }> {
  const { getDashboardGuardErrorMessage, requireDashboardRole } = await import('@/lib/auth/dashboard-guards')
  const { createServiceClient } = await import('@/lib/supabase/server')
  try {
    await requireDashboardRole(['owner', 'general_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }
  const supabase = createServiceClient()
  const { error } = await supabase.rpc('rpc_update_abc_classification')
  if (error) return { error: error.message }
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/dashboard/inventory/reports/abc-analysis')
  return {}
}
