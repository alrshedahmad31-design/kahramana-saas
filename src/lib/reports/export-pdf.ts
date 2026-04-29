// Browser-only — always imported via dynamic import() from client components

export interface PDFConfig {
  reportName:   string
  generatedAt:  string
  filterLabel:  string
  columns:      string[]
  rows:         (string | number)[][]
  summary:      { label: string; value: string }[]
}

export async function buildPDFBlob(config: PDFConfig): Promise<Blob> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const gold:    [number, number, number] = [200, 146, 42]
  const darkBg:  [number, number, number] = [10,  10,  10]
  const bodyText:[number, number, number] = [30,  30,  30]
  const muted:   [number, number, number] = [100, 100, 100]

  // Header bar
  doc.setFillColor(...darkBg)
  doc.rect(0, 0, 297, 22, 'F')

  doc.setFontSize(14)
  doc.setTextColor(...gold)
  doc.text('Kahramana Baghdad', 12, 13)

  doc.setFontSize(10)
  doc.setTextColor(245, 245, 245)
  doc.text(config.reportName, 80, 13)

  // Metadata row
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text(`Generated: ${config.generatedAt}   |   Filters: ${config.filterLabel}`, 12, 30)

  // Summary key metrics
  let summaryY = 38
  if (config.summary.length > 0) {
    const colW   = 50
    const perRow = 4
    for (let i = 0; i < config.summary.length; i += perRow) {
      const slice = config.summary.slice(i, i + perRow)
      slice.forEach((item, j) => {
        const x = 12 + j * colW
        doc.setFontSize(7)
        doc.setTextColor(...muted)
        doc.text(item.label, x, summaryY)
        doc.setFontSize(10)
        doc.setTextColor(...bodyText)
        doc.text(item.value, x, summaryY + 5)
      })
      summaryY += 14
    }
    summaryY += 2
  }

  // Data table
  autoTable(doc, {
    startY:  summaryY,
    head:    [config.columns],
    body:    config.rows.map((r) => r.map(String)),
    theme:   'striped',
    headStyles: {
      fillColor:  darkBg,
      textColor:  gold,
      fontStyle:  'bold',
      fontSize:   8,
    },
    bodyStyles: {
      fontSize:  7.5,
      textColor: bodyText,
    },
    alternateRowStyles: {
      fillColor: [248, 244, 236],
    },
    margin: { top: 10, left: 12, right: 12 },
    didDrawPage: (hookData: { pageNumber: number }) => {
      const pg      = hookData.pageNumber
      const pgCount = doc.internal.pages.length - 1
      doc.setFontSize(7)
      doc.setTextColor(...muted)
      doc.text(
        `Page ${pg} of ${pgCount}  —  Kahramana Baghdad Confidential`,
        148.5,
        206,
        { align: 'center' },
      )
    },
  })

  return doc.output('blob')
}
