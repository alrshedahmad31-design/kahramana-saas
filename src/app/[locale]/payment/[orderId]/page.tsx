import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import { getSession } from '@/lib/auth/session'
import { appendOrderAccessToken, verifyOrderAccessToken } from '@/lib/auth/order-access'
import PaymentHandler from './PaymentHandler'
import type { PaymentMethod } from '@/lib/supabase/custom-types'

interface Props {
  params: Promise<{ locale: string; orderId: string }>
  searchParams?: Promise<{ t?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'payment' })
  return {
    title:  t('title'),
    robots: { index: false, follow: false },
  }
}

export default async function PaymentPage({ params, searchParams }: Props) {
  const { locale, orderId } = await params
  const accessToken = (await searchParams)?.t ?? null
  
  try {
    const supabase = await createServiceClient()

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, total_bhd, status')
      .eq('id', orderId)
      .single()

    if (orderErr || !order || order.status === 'cancelled') {
      console.warn('[Payment Page] Order not found or error:', orderErr)
      notFound()
    }

    const staff = await getSession()
    const customer = await getCustomerSession()
    const isAuthorized =
      Boolean(staff?.role) ||
      verifyOrderAccessToken(orderId, accessToken) ||
      Boolean(customer?.phone && order.customer_phone && customer.phone === order.customer_phone)

    if (!isAuthorized) {
      notFound()
    }

    // Fetch existing payment (if any)
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status, method')
      .eq('order_id', orderId)
      .maybeSingle()

    // Already paid → skip to order confirmation
    if (payment?.status === 'completed') {
      redirect(appendOrderAccessToken(`/${locale}/order/${orderId}`, accessToken))
    }

    return (
      <div className="min-h-screen bg-brand-black">
        <PaymentHandler
          orderId={orderId}
          orderNumber={orderId.slice(-8).toUpperCase()}
          amountBHD={Number(order.total_bhd)}
          customerName={order.customer_name}
          customerPhone={order.customer_phone}
          locale={locale}
          accessToken={accessToken}
          existingPaymentId={payment?.id ?? null}
          existingMethod={(payment?.method as PaymentMethod | null) ?? null}
        />
      </div>
    )
  } catch (err) {
    console.error('[Payment Page] Fatal Error:', err)
    notFound() // Fallback to 404 if anything crashes
  }
}
