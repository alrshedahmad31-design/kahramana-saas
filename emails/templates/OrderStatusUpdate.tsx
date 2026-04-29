import * as React from 'react'
import { Text, Section } from '@react-email/components'
import { KahramanaLayout } from '../components/KahramanaLayout'
import { KahramanaHeader } from '../components/KahramanaHeader'
import { KahramanaFooter } from '../components/KahramanaFooter'

type OrderStatus = 'new' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'

interface Props {
  customerName: string
  orderId: string
  status: OrderStatus
  branchName: string
  driverName?: string
  estimatedMinutes?: number
}

export default function OrderStatusUpdate({
  customerName,
  orderId,
  status,
  branchName,
  driverName,
  estimatedMinutes,
}: Props) {
  const { label, message, emoji } = STATUS_CONTENT[status]
  const shortId = orderId.slice(-6).toUpperCase()

  return (
    <KahramanaLayout preview={`${emoji} طلبك #${shortId} — ${label}`}>
      <KahramanaHeader />

      <Section style={statusBadge(status)}>
        <Text style={statusText}>{emoji} {label}</Text>
      </Section>

      <Text style={greeting}>مرحباً {customerName}،</Text>
      <Text style={body}>{message}</Text>

      <Section style={infoBox}>
        <Text style={infoRow}>
          <span style={infoLabel}>رقم الطلب:</span>{' '}
          <span style={infoValue}>#{shortId}</span>
        </Text>
        <Text style={infoRow}>
          <span style={infoLabel}>الفرع:</span>{' '}
          <span style={infoValue}>{branchName}</span>
        </Text>
        {driverName && (
          <Text style={infoRow}>
            <span style={infoLabel}>السائق:</span>{' '}
            <span style={infoValue}>{driverName}</span>
          </Text>
        )}
        {estimatedMinutes && (
          <Text style={infoRow}>
            <span style={infoLabel}>الوقت المتوقع:</span>{' '}
            <span style={infoValue}>~{estimatedMinutes} دقيقة</span>
          </Text>
        )}
      </Section>

      <KahramanaFooter />
    </KahramanaLayout>
  )
}

OrderStatusUpdate.PreviewProps = {
  customerName: 'محمد حسن',
  orderId: 'xyz987654321',
  status: 'out_for_delivery',
  branchName: 'فرع قلالي',
  driverName: 'علي أحمد',
  estimatedMinutes: 20,
} satisfies Props

const STATUS_CONTENT: Record<OrderStatus, { label: string; message: string; emoji: string }> = {
  new: {
    emoji: '📋',
    label: 'تم استلام الطلب',
    message: 'تم استلام طلبك وسيبدأ التحضير قريباً.',
  },
  preparing: {
    emoji: '👨‍🍳',
    label: 'قيد التحضير',
    message: 'طاقمنا يُحضّر طلبك الآن. استعد للوجبة اللذيذة!',
  },
  ready: {
    emoji: '✅',
    label: 'جاهز للاستلام',
    message: 'طلبك جاهز! يمكنك الحضور لاستلامه من الفرع.',
  },
  out_for_delivery: {
    emoji: '🛵',
    label: 'في الطريق إليك',
    message: 'طلبك في الطريق! السائق سيصل إليك قريباً.',
  },
  delivered: {
    emoji: '🎉',
    label: 'تم التوصيل',
    message: 'وصل طلبك! نتمنى لك وجبة شهية. شكراً لاختيارك كهرمانة.',
  },
  cancelled: {
    emoji: '❌',
    label: 'تم إلغاء الطلب',
    message: 'نعتذر، تم إلغاء طلبك. للاستفسار تواصل معنا عبر واتساب.',
  },
}

function statusBadge(status: OrderStatus): React.CSSProperties {
  const colors: Record<OrderStatus, string> = {
    new:              '#1a2030',
    preparing:        '#2a1f00',
    ready:            '#0d2a14',
    out_for_delivery: '#1a1500',
    delivered:        '#0d2214',
    cancelled:        '#2a0d0d',
  }
  return {
    backgroundColor: colors[status],
    borderRadius: '8px',
    padding: '12px',
    textAlign: 'center',
    marginBottom: '24px',
  }
}

const statusText: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 700,
  margin: 0,
}

const greeting: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '16px',
  margin: '0 0 12px 0',
}

const body: React.CSSProperties = {
  color: '#cccccc',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 20px 0',
}

const infoBox: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  borderRadius: '8px',
  padding: '16px',
}

const infoRow: React.CSSProperties = {
  color: '#cccccc',
  fontSize: '14px',
  margin: '0 0 8px 0',
}

const infoLabel: React.CSSProperties = {
  color: '#888888',
}

const infoValue: React.CSSProperties = {
  color: '#ffffff',
  fontWeight: 600,
}
