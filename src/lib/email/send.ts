import * as React from 'react'
import { Resend } from 'resend'
import { render } from '@react-email/components'
import InviteStaff from '../../../emails/templates/InviteStaff'
import MagicLink from '../../../emails/templates/MagicLink'
import ResetPassword from '../../../emails/templates/ResetPassword'
import OrderConfirmation, { type OrderItem } from '../../../emails/templates/OrderConfirmation'
import OrderStatusUpdate from '../../../emails/templates/OrderStatusUpdate'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM ?? 'كهرمانة <noreply@kahramanat.com>'

type SendResult = { success: true; id: string } | { success: false; error: string }

async function send(
  to: string,
  subject: string,
  component: React.ReactElement,
): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping send')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const html = await render(component)
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) return { success: false, error: error.message }
    return { success: true, id: data!.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[email] send failed:', msg)
    return { success: false, error: msg }
  }
}

export async function sendStaffInvite(
  to: string,
  staffName: string,
  inviteUrl: string,
  role?: string,
): Promise<SendResult> {
  return send(
    to,
    'دعوة للانضمام إلى فريق كهرمانة',
    InviteStaff({ staffName, inviteUrl, role }) as React.ReactElement,
  )
}

export async function sendMagicLink(
  to: string,
  magicLinkUrl: string,
): Promise<SendResult> {
  return send(
    to,
    'رابط تسجيل الدخول إلى كهرمانة',
    MagicLink({ magicLinkUrl }) as React.ReactElement,
  )
}

export async function sendPasswordReset(
  to: string,
  resetUrl: string,
): Promise<SendResult> {
  return send(
    to,
    'إعادة تعيين كلمة مرورك في كهرمانة',
    ResetPassword({ resetUrl }) as React.ReactElement,
  )
}

export async function sendOrderConfirmation(
  to: string,
  props: {
    customerName: string
    orderId: string
    orderItems: OrderItem[]
    totalBhd: number
    branchName: string
    deliveryType: 'delivery' | 'pickup' | 'dine_in'
    estimatedMinutes?: number
  },
): Promise<SendResult> {
  return send(
    to,
    `تأكيد طلبك #${props.orderId.slice(-6).toUpperCase()} — كهرمانة`,
    OrderConfirmation(props) as React.ReactElement,
  )
}

export async function sendOrderStatusUpdate(
  to: string,
  props: {
    customerName: string
    orderId: string
    status: 'new' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'
    branchName: string
    driverName?: string
    estimatedMinutes?: number
  },
): Promise<SendResult> {
  const statusLabels: Record<string, string> = {
    new:              'تم استلام الطلب',
    preparing:        'قيد التحضير',
    ready:            'جاهز للاستلام',
    out_for_delivery: 'في الطريق إليك',
    delivered:        'تم التوصيل',
    cancelled:        'تم إلغاء الطلب',
  }
  return send(
    to,
    `طلبك #${props.orderId.slice(-6).toUpperCase()} — ${statusLabels[props.status] ?? props.status}`,
    OrderStatusUpdate(props) as React.ReactElement,
  )
}
