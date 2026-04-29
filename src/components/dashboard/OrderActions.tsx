'use client'

import { useTranslations } from 'next-intl'
import { buildCustomerContactLink } from '@/lib/whatsapp'

interface Props {
  orderId: string
  customerName: string | null
  customerPhone: string | null
  locale: string
}

export default function OrderActions({ orderId, customerName, customerPhone, locale }: Props) {
  const t  = useTranslations('dashboard')
  const isAr = locale === 'ar'

  const shortId = orderId.slice(0, 8).toUpperCase()

  const whatsappLink = customerPhone
    ? buildCustomerContactLink(
        customerPhone,
        isAr
          ? `مرحباً ${customerName ?? ''}، بخصوص طلبك رقم #${shortId}`
          : `Hello ${customerName ?? ''}, regarding your order #${shortId}`,
      )
    : null

  return (
    <div className="flex flex-wrap gap-2 items-center print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                   border border-brand-border font-satoshi text-sm text-brand-muted
                   hover:border-brand-gold hover:text-brand-gold
                   transition-colors duration-150 min-h-[36px]"
      >
        {t('printReceipt')}
      </button>

      {whatsappLink && (
        <a
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                     border border-brand-border font-satoshi text-sm text-brand-muted
                     hover:border-brand-success hover:text-brand-success
                     transition-colors duration-150 min-h-[36px]"
        >
          {t('contactCustomer')}
        </a>
      )}
    </div>
  )
}
