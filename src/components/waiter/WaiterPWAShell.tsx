'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

interface Props {
  locale:   string
  children: React.ReactNode
}

export default function WaiterPWAShell({ locale, children }: Props) {
  const t    = useTranslations('waiter')
  const isAr = locale === 'ar'

  const [offline, setOffline]             = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall, setShowInstall]     = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    setOffline(!navigator.onLine)
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online',  on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setShowInstall(false)
  }

  return (
    <div
      data-staff-shell
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-[100dvh] bg-brand-black flex flex-col"
    >
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-border bg-brand-black">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-brand-muted hover:text-brand-gold transition-colors duration-150 min-h-[44px]"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className={`text-sm font-bold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('backToDashboard')}
          </span>
        </Link>
        <span className={`text-sm font-black text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('title')}
        </span>
        <Link
          href="/waiter/orders"
          className="text-xs font-bold text-brand-gold hover:text-brand-gold/80 min-h-[44px] flex items-center"
        >
          {t('viewOrders')}
        </Link>
      </header>

      {offline && (
        <div className="shrink-0 bg-brand-error/90 px-4 py-2 flex items-center gap-2">
          <span className="font-satoshi text-sm font-bold text-white">
            {t('offline')}
          </span>
          <span className="font-almarai text-xs text-white/80">
            — {t('offlineHint')}
          </span>
        </div>
      )}

      {showInstall && (
        <div className="shrink-0 bg-brand-gold/10 border-b border-brand-gold/30 px-4 py-3 flex items-center justify-between gap-3">
          <p className={`font-bold text-sm text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'ثبّت التطبيق' : 'Install app'}
          </p>
          <button
            type="button"
            onClick={handleInstall}
            className="bg-brand-gold text-brand-black font-satoshi font-black text-sm px-4 py-2 rounded-lg min-h-[44px]"
          >
            {isAr ? 'تثبيت' : 'Install'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
