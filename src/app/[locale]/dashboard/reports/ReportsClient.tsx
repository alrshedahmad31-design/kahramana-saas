'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Clock, ChevronRight } from 'lucide-react'
import {
  generateReport,
  getBranches,
  getReportHistory,
  type ReportResult,
  type ReportHistoryRow,
} from './actions'
import {
  REPORT_TEMPLATES,
  CATEGORY_META,
  type ReportCategory,
  type ReportType,
} from '@/lib/reports/templates'
import ReportCard       from '@/components/reports/ReportCard'
import ValidationAlerts from '@/components/reports/ValidationAlerts'
import ExportButtons    from '@/components/reports/ExportButtons'
import type { ReportFiltersInput } from '@/lib/reports/validator'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bahrain' })
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bahrain' })
}

function segmentBadgeClass(segment: string): string {
  const map: Record<string, string> = {
    vip:        'bg-brand-gold/20 text-brand-gold border-brand-gold/40',
    regular:    'bg-emerald-900/40 text-emerald-400 border-emerald-700/40',
    occasional: 'bg-blue-900/40 text-blue-400 border-blue-700/40',
    one_time:   'bg-brand-surface2 text-brand-muted border-brand-border',
  }
  return map[segment] ?? map['one_time']
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  locale:       string
  initialRange: string
  initialFrom?: string
  initialTo?:   string
}

const TABS: (ReportCategory | 'history')[] = ['financial', 'operational', 'customer', 'marketing', 'history']

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsClient({ locale, initialFrom, initialTo, initialRange }: Props) {
  const isAr = locale === 'ar'

  const [from,      setFrom]      = useState(initialFrom ?? daysAgo(29))
  const [to,        setTo]        = useState(initialTo   ?? todayStr())
  const [branchId,  setBranchId]  = useState('')
  const [branches,  setBranches]  = useState<{ id: string; name_en: string; name_ar: string }[]>([])

  const [activeTab,     setActiveTab]     = useState<ReportCategory | 'history'>('financial')
  const [activeReport,  setActiveReport]  = useState<ReportType | null>(null)
  const [generatingFor, setGeneratingFor] = useState<ReportType | null>(null)
  const [reportData,    setReportData]    = useState<ReportResult | null>(null)
  const [error,         setError]         = useState<string | null>(null)

  const [history,       setHistory]       = useState<ReportHistoryRow[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const [showAllRows, setShowAllRows] = useState(false)
  const [sortCol,     setSortCol]     = useState<number | null>(null)
  const [sortAsc,     setSortAsc]     = useState(true)

  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getBranches().then(setBranches).catch(() => {})
  }, [])

  useEffect(() => {
    if (!initialFrom && !initialTo) {
      if (initialRange === '7d')  { setFrom(daysAgo(6));  setTo(todayStr()) }
      if (initialRange === '90d') { setFrom(daysAgo(89)); setTo(todayStr()) }
      // 30d is default, already set above
    }
  }, [initialRange, initialFrom, initialTo])

  useEffect(() => {
    if (activeTab === 'history' && !historyLoaded) {
      getReportHistory(25)
        .then((rows) => { setHistory(rows); setHistoryLoaded(true) })
        .catch(() => {})
    }
  }, [activeTab, historyLoaded])

  async function handleGenerate(type: ReportType) {
    setActiveReport(type)
    setGeneratingFor(type)
    setReportData(null)
    setError(null)
    setShowAllRows(false)
    setSortCol(null)

    const filters: ReportFiltersInput = { from, to, branchId: branchId || undefined }
    const result = await generateReport(type, filters)
    setGeneratingFor(null)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setReportData(result.data)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  function handleCollapse() {
    setActiveReport(null)
    setReportData(null)
    setError(null)
  }

  function getSortedRows() {
    if (!reportData) return []
    const rows = [...reportData.rows]
    if (sortCol === null) return rows
    return rows.sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }

  function handleSort(col: number) {
    if (sortCol === col) { setSortAsc(!sortAsc) }
    else { setSortCol(col); setSortAsc(false) }
  }

  const currentTabTemplates = activeTab !== 'history'
    ? REPORT_TEMPLATES.filter((t) => t.category === activeTab)
    : []

  const visibleRows = showAllRows ? getSortedRows() : getSortedRows().slice(0, 50)
  const columns     = reportData ? (isAr ? reportData.columns_ar : reportData.columns_en) : []

  const lf = isAr ? 'font-almarai' : 'font-satoshi'
  const hf = isAr ? 'font-cairo'   : 'font-editorial'

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold text-brand-text ${hf}`}>
          {isAr ? 'التقارير' : 'Reports'}
        </h1>
        <p className={`text-sm text-brand-muted mt-0.5 ${lf}`}>
          {isAr
            ? 'منصة التقارير المؤسسية — بيانات مُتحقق منها وقابلة للتدقيق'
            : 'Enterprise reporting platform — validated, auditable, reproducible data'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">

          <div className="flex gap-1.5">
            {([['7d', 7], ['30d', 29], ['90d', 89]] as [string, number][]).map(([label, days]) => (
              <button
                key={label}
                onClick={() => { setFrom(daysAgo(days)); setTo(todayStr()) }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-brand-border text-brand-muted hover:border-brand-gold/40 hover:text-brand-gold transition-colors font-satoshi"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-brand-surface2 border border-brand-border text-brand-text text-sm font-satoshi focus:outline-none focus:border-brand-gold/50"
            />
            <span className="text-brand-muted font-satoshi text-xs">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-brand-surface2 border border-brand-border text-brand-text text-sm font-satoshi focus:outline-none focus:border-brand-gold/50"
            />
          </div>

          {branches.length > 0 && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-brand-surface2 border border-brand-border text-brand-text text-sm font-satoshi focus:outline-none focus:border-brand-gold/50"
            >
              <option value="">{isAr ? 'كل الفروع' : 'All branches'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{isAr ? b.name_ar : b.name_en}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-brand-border overflow-x-auto pb-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); if (tab !== activeTab) handleCollapse() }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              activeTab === tab
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            } ${lf}`}
          >
            {tab === 'history'
              ? (isAr ? 'السجل' : 'History')
              : (isAr ? CATEGORY_META[tab].label_ar : CATEGORY_META[tab].label_en)
            }
          </button>
        ))}
      </div>

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
            <span className={`text-xs font-bold text-brand-muted uppercase tracking-wide ${lf}`}>
              {isAr ? 'سجل التقارير' : 'Report Audit Log'}
            </span>
            <button
              onClick={() => { setHistoryLoaded(false) }}
              className="text-brand-muted hover:text-brand-gold transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          {history.length === 0 ? (
            <p className={`px-5 py-10 text-center text-brand-muted text-sm ${lf}`}>
              {isAr ? 'لا توجد تقارير مُنشأة بعد' : 'No reports generated yet'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border">
                    {[
                      isAr ? 'التقرير' : 'Report',
                      isAr ? 'الفترة' : 'Period',
                      isAr ? 'السجلات' : 'Records',
                      isAr ? 'الصيغة' : 'Format',
                      isAr ? 'التاريخ' : 'Generated',
                    ].map((h, i) => (
                      <th key={i} className={`px-5 py-3 text-start text-xs font-semibold text-brand-muted uppercase tracking-wide ${lf}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b border-brand-border/50 hover:bg-brand-surface2/50 transition-colors">
                      <td className={`px-5 py-3 text-brand-text ${lf}`}>{row.report_name}</td>
                      <td className="px-5 py-3 text-brand-muted text-xs font-satoshi">
                        {row.filters?.from && row.filters?.to ? `${row.filters.from} → ${row.filters.to}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-brand-muted font-satoshi">{row.row_count ?? '—'}</td>
                      <td className="px-5 py-3">
                        {row.export_format && row.export_format !== 'preview' ? (
                          <span className="text-xs px-1.5 py-0.5 rounded border border-brand-border text-brand-muted font-satoshi uppercase">
                            {row.export_format}
                          </span>
                        ) : (
                          <span className="text-xs text-brand-muted font-satoshi">preview</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-brand-muted text-xs font-satoshi">
                        <span className="flex items-center gap-1.5">
                          <Clock size={11} />
                          {new Date(row.generated_at).toLocaleString('en-GB', { timeZone: 'Asia/Bahrain' })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Report cards */}
      {activeTab !== 'history' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentTabTemplates.map((template) => (
            <ReportCard
              key={template.id}
              template={template}
              isActive={activeReport === template.id}
              isGenerating={generatingFor === template.id}
              isAr={isAr}
              onGenerate={() => handleGenerate(template.id)}
              onCollapse={handleCollapse}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl border border-red-800/50 bg-red-950/40 text-red-300 text-sm font-satoshi">
          ✕ {error}
        </div>
      )}

      {/* Result panel */}
      {reportData && (
        <div ref={resultRef} className="rounded-xl border border-brand-gold/30 bg-brand-surface overflow-hidden">

          {/* Panel header */}
          <div className="px-6 pt-6 pb-5 border-b border-brand-border bg-brand-surface2/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className={`text-xl font-bold text-brand-gold ${hf}`}>
                  {isAr ? reportData.title_ar : reportData.title_en}
                </h2>
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-brand-muted ${lf}`}>
                  <span>{isAr ? 'الفترة:' : 'Period:'} <span className="font-satoshi">{reportData.periodLabel}</span></span>
                  <span className="text-brand-border">·</span>
                  <span>{isAr ? 'المصدر:' : 'Source:'} <span className="font-satoshi">{reportData.validation.dataSource}</span></span>
                  <span className="text-brand-border">·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    <span className="font-satoshi">{reportData.generatedAt}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={handleCollapse}
                className="text-brand-muted hover:text-brand-gold transition-colors shrink-0 mt-1"
                aria-label="Close"
              >
                <ChevronRight size={18} className="rotate-90" />
              </button>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Validation alerts */}
            <ValidationAlerts validation={reportData.validation} isAr={isAr} />

            {/* Summary metrics */}
            {reportData.summary.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {reportData.summary.map((item, i) => (
                  <div key={i} className="bg-brand-surface2 border border-brand-border rounded-lg px-4 py-3">
                    <p className={`text-xs text-brand-muted mb-1 ${lf}`}>
                      {isAr ? item.label_ar : item.label_en}
                    </p>
                    <p className="text-base font-semibold text-brand-text font-satoshi tabular-nums">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Export buttons */}
            <div className="bg-brand-surface2 border border-brand-border rounded-lg px-4 py-3">
              <ExportButtons report={reportData} isAr={isAr} />
            </div>

            {/* Data table */}
            {reportData.rows.length > 0 ? (
              <div className="rounded-xl border border-brand-border overflow-hidden">
                <div className="px-4 py-3 border-b border-brand-border bg-brand-surface2 flex items-center justify-between gap-3">
                  <span className={`text-xs font-semibold text-brand-muted uppercase tracking-wide ${lf}`}>
                    {isAr ? 'البيانات التفصيلية' : 'Detailed Data'}
                    {' '}
                    <span className="font-satoshi normal-case">
                      ({reportData.rows.length} {isAr ? 'سجل' : 'rows'})
                    </span>
                  </span>
                  {sortCol !== null && (
                    <button
                      onClick={() => { setSortCol(null); setSortAsc(true) }}
                      className={`text-xs text-brand-muted hover:text-brand-gold transition-colors ${lf}`}
                    >
                      {isAr ? 'إلغاء الفرز' : 'Clear sort'}
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-border bg-brand-surface2">
                        {columns.map((col, i) => (
                          <th
                            key={i}
                            onClick={() => handleSort(i)}
                            className={`px-4 py-3 text-start text-xs font-semibold text-brand-muted uppercase tracking-wide cursor-pointer hover:text-brand-gold transition-colors select-none whitespace-nowrap ${lf}`}
                          >
                            {col}
                            {sortCol === i && (
                              <span className="ms-1 font-satoshi">{sortAsc ? '↑' : '↓'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row, ri) => (
                        <tr
                          key={ri}
                          className={`border-b border-brand-border/40 transition-colors hover:bg-brand-surface2/60 ${
                            ri % 2 !== 0 ? 'bg-brand-surface2/20' : ''
                          }`}
                        >
                          {row.map((cell, ci) => {
                            const isSegment = typeof cell === 'string' &&
                              ['vip', 'regular', 'occasional', 'one_time'].includes(cell)
                            return (
                              <td key={ci} className={`px-4 py-2.5 text-brand-text ${lf} whitespace-nowrap`}>
                                {isSegment ? (
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${segmentBadgeClass(String(cell))}`}>
                                    {String(cell).replace('_', ' ')}
                                  </span>
                                ) : (
                                  typeof cell === 'number' ? cell.toLocaleString() : String(cell)
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {reportData.rows.length > 50 && (
                  <div className="px-4 py-3 border-t border-brand-border bg-brand-surface2 text-center">
                    <button
                      onClick={() => setShowAllRows(!showAllRows)}
                      className={`text-sm text-brand-gold hover:opacity-80 transition-opacity ${lf}`}
                    >
                      {showAllRows
                        ? (isAr ? 'عرض أقل' : 'Show less')
                        : (isAr ? `عرض كل ${reportData.rows.length} سجل` : `Show all ${reportData.rows.length} rows`)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className={`text-center py-8 text-brand-muted text-sm ${lf}`}>
                {isAr ? 'لا توجد بيانات للفترة المحددة' : 'No data for the selected period'}
              </p>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
