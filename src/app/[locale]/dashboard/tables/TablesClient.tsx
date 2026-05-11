'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { Download, Loader2 } from 'lucide-react'
import { tokens } from '@/lib/design-tokens'

export interface TableRow {
  id:           string
  branch_id:    string
  table_number: number
  label_ar:     string | null
  label_en:     string | null
  capacity:     number
  is_active:    boolean
}

interface BranchOption {
  id:     string
  nameAr: string
  nameEn: string
}

interface Props {
  tables:        TableRow[]
  branchId:      string
  branches:      BranchOption[]
  isGlobalAdmin: boolean
  siteUrl:       string
  locale:        'ar' | 'en'
}

export default function TablesClient({
  tables, branchId, branches, isGlobalAdmin, siteUrl, locale,
}: Props) {
  const t = useTranslations('tablesAdmin')
  const isAr = locale === 'ar'

  const [downloading, setDownloading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  const buildQrUrl = useCallback((tableNumber: number) => {
    // QR encodes the canonical AR URL (no locale prefix); the AR version is
    // the default per next-intl `as-needed` config.
    return `${siteUrl}/table/${branchId}/${tableNumber}`
  }, [siteUrl, branchId])

  async function generateQrPng(text: string): Promise<string> {
    return QRCode.toDataURL(text, {
      type:   'image/png',
      width:  720,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark:  tokens.color.qrInk,
        light: tokens.color.qrPaper,
      },
    })
  }

  async function downloadOne(table: TableRow) {
    setDownloading(table.id)
    try {
      const dataUrl = await generateQrPng(buildQrUrl(table.table_number))
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `qr-${table.branch_id}-table-${table.table_number}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      setDownloading(null)
    }
  }

  async function downloadAll() {
    setBulkLoading(true)
    try {
      // Sequential — keeps memory low and avoids the browser bundling many
      // download dialogs into one popup-blocked event.
      for (const table of tables) {
        if (!table.is_active) continue
        const dataUrl = await generateQrPng(buildQrUrl(table.table_number))
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `qr-${table.branch_id}-table-${table.table_number}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        await new Promise((r) => setTimeout(r, 250))
      }
    } finally {
      setBulkLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('title')}
          </h1>
          <p className={`text-sm text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isGlobalAdmin && (
            <form action="" method="get" className="flex items-center gap-2">
              <select
                name="branch"
                defaultValue={branchId}
                className="bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text font-satoshi focus:outline-none focus:border-brand-gold/40"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isAr ? b.nameAr : b.nameEn}
                  </option>
                ))}
              </select>
              <button type="submit" className="text-xs text-brand-gold underline">
                {isAr ? 'تطبيق' : 'Apply'}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={downloadAll}
            disabled={bulkLoading || tables.length === 0}
            className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-sm font-bold transition-colors ${
              bulkLoading || tables.length === 0
                ? 'bg-brand-surface text-brand-muted cursor-not-allowed'
                : 'bg-brand-gold text-brand-black hover:bg-brand-gold/90'
            } ${isAr ? 'font-cairo' : 'font-satoshi'}`}
          >
            {bulkLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {t('downloadAll')}
          </button>
        </div>
      </header>

      {tables.length === 0 ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
          <p className={`text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('empty')}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tables.map((table) => {
            const label = isAr
              ? (table.label_ar ?? `طاولة ${table.table_number}`)
              : (table.label_en ?? `Table ${table.table_number}`)
            const url = buildQrUrl(table.table_number)
            return (
              <li
                key={table.id}
                className={`rounded-xl border bg-brand-surface px-4 py-3 ${
                  table.is_active ? 'border-brand-border' : 'border-brand-border opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-black text-brand-gold text-base ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                      {label}
                    </p>
                    <p className={`text-xs text-brand-muted truncate ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {url}
                    </p>
                    {!table.is_active && (
                      <span className={`inline-block mt-1 text-[10px] uppercase tracking-wide rounded bg-brand-error/20 text-brand-error px-2 py-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                        {t('inactive')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadOne(table)}
                    disabled={downloading === table.id || !table.is_active}
                    className={`shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md text-xs font-bold transition-colors ${
                      downloading === table.id || !table.is_active
                        ? 'bg-brand-surface border border-brand-border text-brand-muted cursor-not-allowed'
                        : 'bg-brand-gold/10 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold hover:text-brand-black'
                    } ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                  >
                    {downloading === table.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    {t('downloadQr')}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
