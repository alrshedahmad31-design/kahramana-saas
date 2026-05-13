'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface Props {
  locale:   string
  children: React.ReactNode
}

export default function DriverPWAShell({ locale, children }: Props) {
  const t    = useTranslations('driver')
  const isAr = locale === 'ar'

  const [offline,        setOffline]        = useState(false)
  const [installPrompt,  setInstallPrompt]  = useState<Event | null>(null)
  const [showInstall,    setShowInstall]    = useState(false)
  const [pushDismissed,  setPushDismissed]  = useState(false)

  const { permissionState, requestPermission } = usePushNotifications()

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[driver-pwa] service worker registration failed:', err)
      })
    }
  }, [])

  // Screen Wake Lock API
  useEffect(() => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null

    async function acquire() {
      if (sentinel) return
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch (err) {
        console.error('[WakeLock] Request failed:', err)
      }
    }

    async function release() {
      if (sentinel) {
        try {
          await sentinel.release()
        } catch (err) {
          console.error('[WakeLock] Release failed:', err)
        }
        sentinel = null
      }
    }

    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ active?: boolean }>).detail
      if (detail?.active) acquire()
      else release()
    }

    window.addEventListener('driver:wake-lock', handleEvent)

    const handleVisibility = () => {
      if (sentinel !== null && document.visibilityState === 'visible') {
        // Re-acquire if app returns to foreground and we previously had a lock
        sentinel = null // reset local reference before re-requesting
        acquire()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('driver:wake-lock', handleEvent)
      document.removeEventListener('visibilitychange', handleVisibility)
      release()
    }
  }, [])

  // Online / offline detection
  useEffect(() => {
    setOffline(!navigator.onLine)
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // PWA install prompt (Android Chrome only)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt()
    setShowInstall(false)
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-[100dvh] bg-brand-black flex flex-col"
    >
      {/* Nav header */}
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
      </header>

      {/* Push permission prompt (shown once, until granted or denied) */}
      {permissionState === 'default' && !pushDismissed && (
        <div className="shrink-0 bg-brand-gold/10 border-b border-brand-gold/30 px-4 py-3
                        flex items-center justify-between gap-3">
          <div>
            <p className={`font-bold text-sm text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('pushPromptTitle')}
            </p>
            <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('pushPromptHint')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPushDismissed(true)}
              className="text-brand-muted hover:text-brand-text transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={t('pushPromptDismiss')}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={requestPermission}
              className={`bg-brand-gold text-brand-black font-black text-sm px-4 py-2 rounded-lg min-h-[44px] ${isAr ? 'font-cairo' : 'font-satoshi'}`}
            >
              {t('pushPromptEnable')}
            </button>
          </div>
        </div>
      )}

      {/* Offline banner */}
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

      {/* Install prompt */}
      {showInstall && (
        <div className="shrink-0 bg-brand-gold/10 border-b border-brand-gold/30 px-4 py-3
                        flex items-center justify-between gap-3">
          <div>
            <p className="font-satoshi font-bold text-sm text-brand-gold">{t('installPrompt')}</p>
            <p className="font-almarai text-xs text-brand-muted">{t('installPromptHint')}</p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 bg-brand-gold text-brand-black font-satoshi font-black
                       text-sm px-4 py-2 rounded-lg min-h-[44px]"
          >
            {t('installPrompt')}
          </button>
        </div>
      )}

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
