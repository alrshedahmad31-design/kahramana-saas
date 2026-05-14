'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'

// Consent-gated analytics loader.
//
// Reads `cookie-consent` from localStorage and only renders the GA4 +
// Clarity <Script> tags after the user accepts. The CookieBanner
// dispatches a `cookie-consent-updated` window event on accept, which
// flips this component's state and triggers script injection without
// requiring a page reload.
//
// SSR-safe: useState initial is false → renders null on the server →
// no hydration mismatch when the client checks localStorage.
//
// `nonce` is the per-request CSP nonce from middleware.ts, threaded
// through layout.tsx → here so the inline init scripts pass the
// nonce-strict CSP in production.

interface Props {
  nonce?: string
}

export function Analytics({ nonce }: Props) {
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    const check = () =>
      setConsented(localStorage.getItem('cookie-consent') === 'accepted')
    check()
    window.addEventListener('cookie-consent-updated', check)
    return () => window.removeEventListener('cookie-consent-updated', check)
  }, [])

  if (!consented) return null

  const gaId      = process.env.NEXT_PUBLIC_GA_ID
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" nonce={nonce} strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
          </Script>
        </>
      )}
      {clarityId && (
        <Script id="clarity-init" nonce={nonce} strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];if(y&&y.parentNode){y.parentNode.insertBefore(t,y);}else{(l.head||l.body||l.documentElement).appendChild(t);}})(window,document,"clarity","script","${clarityId}");`}
        </Script>
      )}
    </>
  )
}
