'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'

type IntStatus = 'connected' | 'not_connected' | 'coming_soon'

interface Integration {
  id:        string
  icon:      string
  labelAr:   string
  labelEn:   string
  descAr:    string
  descEn:    string
  status:    IntStatus
  actionAr?: string
  actionEn?: string
}

const INTEGRATIONS: Integration[] = [
  {
    id:       'google_analytics',
    icon:     '📊',
    labelAr:  'Google Analytics',
    labelEn:  'Google Analytics',
    descAr:   'تتبع أداء الموقع وسلوك الزوار',
    descEn:   'Track website performance and visitor behavior',
    status:   'not_connected',
    actionAr: 'ربط',
    actionEn: 'Connect',
  },
  {
    id:       'whatsapp',
    icon:     '💬',
    labelAr:  'WhatsApp Business API',
    labelEn:  'WhatsApp Business API',
    descAr:   'إرسال إشعارات الطلبات للعملاء تلقائياً',
    descEn:   'Send automated order notifications to customers',
    status:   'not_connected',
    actionAr: 'ربط',
    actionEn: 'Connect',
  },
  {
    id:       'sendgrid',
    icon:     '📧',
    labelAr:  'البريد الإلكتروني (SendGrid)',
    labelEn:  'Email Service (SendGrid)',
    descAr:   'إرسال رسائل بريد إلكتروني للمعاملات',
    descEn:   'Send transactional emails to customers',
    status:   'not_connected',
    actionAr: 'ربط',
    actionEn: 'Connect',
  },
  {
    id:       'deliverect',
    icon:     '🚴',
    labelAr:  'Deliverect (منصات التوصيل)',
    labelEn:  'Deliverect (Delivery Platforms)',
    descAr:   'تكامل مع Talabat وCareem وغيرها',
    descEn:   'Integrate with Talabat, Careem and more',
    status:   'coming_soon',
  },
  {
    id:       'pos',
    icon:     '🖥️',
    labelAr:  'نظام نقطة البيع (POS)',
    labelEn:  'POS System',
    descAr:   'مزامنة الطلبات مع نظام الكاشير',
    descEn:   'Sync orders with your cashier system',
    status:   'coming_soon',
  },
]

export default function IntegrationsSettings() {
  const isAr = useLocale() === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  const [connecting, setConnecting] = useState<string | null>(null)

  function handleConnect(id: string) {
    setConnecting(id)
    setTimeout(() => setConnecting(null), 1500)
  }

  const connected    = INTEGRATIONS.filter(i => i.status === 'connected')
  const available    = INTEGRATIONS.filter(i => i.status === 'not_connected')
  const comingSoon   = INTEGRATIONS.filter(i => i.status === 'coming_soon')

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'التكاملات' : 'Integrations'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr ? 'ربط المطعم بالخدمات الخارجية' : 'Connect your restaurant to third-party services'}
        </p>
      </div>

      {/* Connected */}
      {connected.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
            {isAr ? 'متصل' : 'Connected'}
          </label>
          {connected.map(int => (
            <IntCard key={int.id} int={int} isAr={isAr} font={font} onConnect={() => handleConnect(int.id)} connecting={connecting === int.id} />
          ))}
        </div>
      )}

      {/* Available */}
      {available.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
            {isAr ? 'متاح للتفعيل' : 'Available'}
          </label>
          {available.map(int => (
            <IntCard key={int.id} int={int} isAr={isAr} font={font} onConnect={() => handleConnect(int.id)} connecting={connecting === int.id} />
          ))}
        </div>
      )}

      {/* Coming Soon */}
      {comingSoon.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
            {isAr ? 'قريباً' : 'Coming Soon'}
          </label>
          {comingSoon.map(int => (
            <IntCard key={int.id} int={int} isAr={isAr} font={font} onConnect={() => {}} connecting={false} />
          ))}
        </div>
      )}
    </div>
  )
}

function IntCard({
  int, isAr, font, onConnect, connecting,
}: {
  int:        Integration
  isAr:       boolean
  font:       string
  onConnect:  () => void
  connecting: boolean
}) {
  const isComingSoon = int.status === 'coming_soon'
  const isConnected  = int.status === 'connected'

  return (
    <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all
      ${isConnected ? 'border-brand-gold/30 bg-brand-surface' : 'border-brand-border bg-brand-surface-2'}
      ${isComingSoon ? 'opacity-60' : ''}`}
    >
      <span className="text-2xl shrink-0">{int.icon}</span>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-black text-brand-text block ${font}`}>
          {isAr ? int.labelAr : int.labelEn}
        </span>
        <span className={`text-xs text-brand-muted ${font}`}>
          {isAr ? int.descAr : int.descEn}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isConnected && (
          <span className={`text-[10px] text-brand-success border border-brand-success/30 bg-brand-success/5 px-2.5 py-1 rounded-full font-bold ${font}`}>
            {isAr ? 'متصل ✓' : 'Connected ✓'}
          </span>
        )}
        {isComingSoon && (
          <span className={`text-[10px] text-brand-muted border border-brand-border bg-brand-surface px-2.5 py-1 rounded-full font-bold ${font}`}>
            {isAr ? 'قريباً' : 'Soon'}
          </span>
        )}
        {!isConnected && !isComingSoon && (
          <button
            type="button"
            onClick={onConnect}
            disabled={connecting}
            className={`text-xs px-4 py-1.5 rounded-xl bg-brand-surface border border-brand-border
              text-brand-muted hover:text-brand-gold hover:border-brand-gold/40
              transition-colors font-bold disabled:opacity-50 ${font}`}
          >
            {connecting
              ? (isAr ? '…' : '…')
              : (isAr ? (int.actionAr ?? 'ربط') : (int.actionEn ?? 'Connect'))}
          </button>
        )}
        {isConnected && (
          <button
            type="button"
            className={`text-xs px-3 py-1.5 rounded-xl bg-brand-surface border border-brand-border
              text-brand-muted hover:text-brand-error hover:border-brand-error/30
              transition-colors font-bold ${font}`}
          >
            {isAr ? 'قطع' : 'Disconnect'}
          </button>
        )}
      </div>
    </div>
  )
}
