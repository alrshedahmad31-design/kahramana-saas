'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const locale = useLocale()
  const isAr = locale === 'ar'

  useEffect(() => {
    if (!localStorage.getItem('cookie-consent')) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem('cookie-consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  const privacyHref = isAr ? '/privacy' : '/en/privacy'

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-brand-surface border-t border-brand-border shadow-2xl">
      <div className={`max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4 ${isAr ? 'sm:flex-row-reverse' : ''}`}>
        <p className={`text-sm text-brand-text flex-1 text-center ${isAr ? 'sm:text-end font-almarai' : 'sm:text-start font-satoshi'}`}>
          {isAr ? (
            <>
              يستخدم موقعنا ملفات تعريف الارتباط الضرورية لعمله. باستخدامك الموقع، فأنت توافق على{' '}
              <Link href={privacyHref} className="underline text-brand-gold hover:opacity-80">
                سياسة الخصوصية
              </Link>
              .
            </>
          ) : (
            <>
              We use essential cookies to operate this site. By continuing, you agree to our{' '}
              <Link href={privacyHref} className="underline text-brand-gold hover:opacity-80">
                Privacy Policy
              </Link>
              .
            </>
          )}
        </p>
        <button
          onClick={accept}
          className="px-6 py-2 bg-brand-gold text-brand-black font-bold rounded-lg text-sm whitespace-nowrap hover:opacity-90 transition-opacity"
        >
          {isAr ? 'موافق' : 'Accept'}
        </button>
      </div>
    </div>
  )
}
