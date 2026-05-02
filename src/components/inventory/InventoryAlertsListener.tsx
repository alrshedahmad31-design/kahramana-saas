'use client'

import { useEffect, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AlertSeverity } from '@/lib/supabase/custom-types'

interface AlertPayload {
  id:       string
  severity: AlertSeverity
  message:  string
}

interface ToastItem extends AlertPayload {
  key: number
}

function severityIcon(s: AlertSeverity) {
  if (s === 'critical') return '🔴'
  if (s === 'warning')  return '🟡'
  return '⚪'
}

function severityStyle(s: AlertSeverity) {
  if (s === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-400'
  if (s === 'warning')  return 'border-brand-gold/40 bg-brand-gold/10 text-brand-gold'
  return 'border-brand-border bg-brand-surface-2 text-brand-muted'
}

function dismissDelay(s: AlertSeverity) {
  if (s === 'critical') return 10_000
  if (s === 'warning')  return 7_000
  return 5_000
}

function AlertToast({ item, onDismiss }: { item: ToastItem; onDismiss: (key: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.key), dismissDelay(item.severity))
    return () => clearTimeout(t)
  }, [item.key, item.severity, onDismiss])

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg font-satoshi text-sm max-w-xs animate-in slide-in-from-end-5 fade-in duration-300 ${severityStyle(item.severity)}`}
    >
      <span className="shrink-0 mt-0.5">{severityIcon(item.severity)}</span>
      <p className="flex-1 leading-snug">{item.message}</p>
      <button
        onClick={() => onDismiss(item.key)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity ms-1"
        aria-label="إغلاق"
      >
        ✕
      </button>
    </div>
  )
}

export default function InventoryAlertsListener() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const supabase = createClient()

  const dismiss = useCallback((key: number) => {
    setToasts(prev => prev.filter(t => t.key !== key))
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('inventory_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inventory_alerts' },
        (payload) => {
          const row = payload.new as AlertPayload
          const key = Date.now()

          setToasts(prev => [...prev, { id: row.id, severity: row.severity, message: row.message, key }])

          // Mark as read after showing
          supabase
            .from('inventory_alerts')
            .update({ is_read: true })
            .eq('id', row.id)
            .then(() => {})
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 end-6 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map(t => (
        <AlertToast key={t.key} item={t} onDismiss={dismiss} />
      ))}
    </div>
  )
}
