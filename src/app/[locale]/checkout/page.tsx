import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import CheckoutForm from '@/components/checkout/CheckoutForm'
import { getCustomerSession } from '@/lib/auth/customerSession'

// Per-user checkout surface — never statically rendered or cached. Pinned so
// a future refactor that hoists the session call into a layout can't downgrade
// this page to ISR.
export const dynamic = 'force-dynamic'

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t      = await getTranslations({ locale, namespace: 'checkout' })
  return {
    title:  t('title'),
    robots: { index: false },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CheckoutPage() {
  const customer = await getCustomerSession()
  return (
    <div className="min-h-screen bg-brand-black pt-4">
      <CheckoutForm customerProfile={customer} />
    </div>
  )
}
