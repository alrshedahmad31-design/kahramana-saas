function escapeCsv(value: string | number): string {
  const s = String(value)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

export function buildCSVString(columns: string[], rows: (string | number)[][]): string {
  const lines = [
    columns.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ]
  return lines.join('\r\n')
}

export function buildCSVWithMeta(
  reportName: string,
  generatedAt: string,
  filterLabel: string,
  columns: string[],
  rows: (string | number)[][],
): string {
  const meta = [
    `# Report: ${reportName}`,
    `# Generated: ${generatedAt}`,
    `# Filters: ${filterLabel}`,
    `# Records: ${rows.length}`,
    '',
  ].join('\r\n')

  return meta + buildCSVString(columns, rows)
}
