'use client'

import { useLocale } from 'next-intl'

type IntStatus = 'connected' | 'coming_soon'

interface Integration {
  id:      string
  icon:    string
  labelAr: string
  labelEn: string
  descAr:  string
  descEn:  string
  status:  IntStatus
}

const INTEGRATIONS: Integration[] = [
  {
    id:      'google_analytics',
    icon:    '📊',
    labelAr: 'Google Analytics',
    labelEn: 'Google Analytics',
    descAr:  'تتبع أداء الموقع وسلوك الزوار',
    descEn:  'Track website performance and visitor behavior',
    status:  'coming_soon',
  },
  {
    id:      'whatsapp',
    icon:    '💬',
    labelAr: 'WhatsApp Business API',
    labelEn: 'WhatsApp Business API',
    descAr:  'إرسال إشعارات الطلبات للعملاء تلقائياً',
    descEn:  'Send automated order notifications to customers',
    status:  'coming_soon',
  },
  {
    id:      'sendgrid',
    icon:    '📧',
    labelAr: 'البريد الإلكتروني (SendGrid)',
    labelEn: 'Email Service (SendGrid)',
    descAr:  'إرسال رسائل بريد إلكتروني للمعاملات',
    descEn:  'Send transactional emails to customers',
    status:  'coming_soon',
  },
  {
    id:      'deliverect',
    icon:    '🚴',
    labelAr: 'Deliverect (منصات التوصيل)',
    labelEn: 'Deliverect (Delivery Platforms)',
    descAr:  'تكامل مع Talabat وCareem وغيرها',
    descEn:  'Integrate with Talabat, Careem and more',
    status:  'coming_soon',
  },
  {
    id:      'pos',
    icon:    '🖥️',
    labelAr: 'نظام نقطة البيع (POS)',
    labelEn: 'POS System',
    descAr:  'مزامنة الطلبات مع نظام الكاشير',
    descEn:  'Sync orders with your cashier system',
    status:  'coming_soon',
  },
]

export default function IntegrationsSettings() {
  const isAr = useLocale() === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  const connected  = INTEGRATIONS.filter(i => i.status === 'connected')
  const comingSoon = INTEGRATIONS.filter(i => i.status === 'coming_soon')

  function handleDisconnect(label: string) {
    const msg = isAr
      ? `هل أنت متأكد من قطع الاتصال بـ ${label}؟`
      : `Are you sure you want to disconnect ${label}?`
    if (window.confirm(msg)) {
      // Disconnect logic goes here when integrations are implemented
    }
  }

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
            <IntCard key={int.id} int={int} isAr={isAr} font={font} onDisconnect={() => handleDisconnect(isAr ? int.labelAr : int.labelEn)} />
          ))}
        </div>
      )}

      {/* Coming Soon */}
      {comingSoon.length > 0 && (
        <div className="flex flex-col gap-3">
          <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
            {isAr ? 'قريباً' : 'Coming Soon'}
          </label>
          <p className={`text-xs text-brand-muted -mt-1 ${font}`}>
            {isAr
              ? 'هذه التكاملات قيد التطوير وستكون متاحة في تحديث قادم.'
              : 'These integrations are in development and will be available in a future update.'}
          </p>
          {comingSoon.map(int => (
            <IntCard key={int.id} int={int} isAr={isAr} font={font} />
          ))}
        </div>
      )}
    </div>
  )
}

function IntCard({
  int, isAr, font, onDisconnect,
}: {
  int:          Integration
  isAr:         boolean
  font:         string
  onDisconnect?: () => void
}) {
  const isConnected = int.status === 'connected'

  return (
    <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all
      ${isConnected ? 'border-brand-gold/30 bg-brand-surface' : 'border-brand-border bg-brand-surface-2 opacity-70'}`}
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
        {isConnected ? (
          <>
            <span className={`text-[10px] text-brand-success border border-brand-success/30 bg-brand-success/5 px-2.5 py-1 rounded-full font-bold ${font}`}>
              {isAr ? 'متصل ✓' : 'Connected ✓'}
            </span>
            <button
              type="button"
              onClick={onDisconnect}
              className={`text-xs px-3 py-1.5 rounded-xl bg-brand-surface border border-brand-border
                text-brand-muted hover:text-brand-error hover:border-brand-error/30
                transition-colors font-bold ${font}`}
            >
              {isAr ? 'قطع الاتصال' : 'Disconnect'}
            </button>
          </>
        ) : (
          <span
            className={`text-[10px] text-brand-muted border border-brand-border bg-brand-surface px-2.5 py-1 rounded-full font-bold ${font}`}
            title={isAr ? 'قيد التطوير — سيتوفر في تحديث قادم' : 'Integration in progress — available in a future update'}
          >
            {isAr ? 'قريباً' : 'Coming Soon'}
          </span>
        )}
      </div>
    </div>
  )
}
