'use client'

import { useState } from 'react'
import { Printer, Loader2 } from 'lucide-react'
import {
  printReceipt,
  isWebUsbSupported,
  type ReceiptOrder,
} from '@/lib/hardware/receipt-printer'

interface Props {
  order: ReceiptOrder
  isAr:  boolean
}

export default function PrintReceiptButton({ order, isAr }: Props) {
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  async function onClick() {
    setBusy(true)
    setHint(null)
    try {
      const path = await printReceipt(order)
      if (path === 'unsupported') {
        setHint(isAr ? 'لا يمكن فتح نافذة الطباعة' : 'Could not open the print window')
      } else if (path === 'window' && !isWebUsbSupported()) {
        setHint(isAr
          ? 'تم استخدام طباعة المتصفح (WebUSB غير مدعوم في هذا المتصفح)'
          : 'Used browser print (WebUSB not supported in this browser)')
      } else if (path === 'window') {
        setHint(isAr ? 'لا يوجد طابعة متصلة — تم استخدام طباعة المتصفح' : 'No printer connected — used browser print')
      }
    } catch (err) {
      console.error('[PrintReceiptButton]', err)
      setHint(isAr ? 'فشل الإرسال إلى الطابعة' : 'Failed to send to printer')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-brand-gold/40 bg-brand-surface-2 px-4 text-sm font-medium text-brand-gold hover:bg-brand-gold/10 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        {isAr ? 'طباعة الإيصال' : 'Print receipt'}
      </button>
      {hint && (
        <p className="text-center text-[11px] text-brand-muted">{hint}</p>
      )}
    </div>
  )
}
