import * as React from 'react'
import { Text, Section, Row, Column, Hr } from '@react-email/components'
import { KahramanaLayout } from '../components/KahramanaLayout'
import { KahramanaHeader } from '../components/KahramanaHeader'
import { KahramanaFooter } from '../components/KahramanaFooter'

export interface OrderItem {
  name: string
  quantity: number
  price: number
}

interface Props {
  customerName: string
  orderId: string
  orderItems: OrderItem[]
  totalBhd: number
  branchName: string
  deliveryType: 'delivery' | 'pickup' | 'dine_in'
  estimatedMinutes?: number
}

export default function OrderConfirmation({
  customerName,
  orderId,
  orderItems,
  totalBhd,
  branchName,
  deliveryType,
  estimatedMinutes,
}: Props) {
  const deliveryLabel =
    deliveryType === 'delivery' ? 'توصيل للمنزل' :
    deliveryType === 'pickup'   ? 'استلام من الفرع' :
                                  'تناول في المكان'

  return (
    <KahramanaLayout preview={`تأكيد طلبك #${orderId.slice(-6).toUpperCase()} — كهرمانة`}>
      <KahramanaHeader />

      <Text style={heading}>تم استلام طلبك!</Text>
      <Text style={subheading}>شكراً {customerName}، طلبك قيد التحضير.</Text>

      <Section style={metaBox}>
        <Row>
          <Column style={metaCell}>
            <Text style={metaLabel}>رقم الطلب</Text>
            <Text style={metaValue}>#{orderId.slice(-6).toUpperCase()}</Text>
          </Column>
          <Column style={metaCell}>
            <Text style={metaLabel}>الفرع</Text>
            <Text style={metaValue}>{branchName}</Text>
          </Column>
          <Column style={metaCell}>
            <Text style={metaLabel}>نوع الخدمة</Text>
            <Text style={metaValue}>{deliveryLabel}</Text>
          </Column>
        </Row>
        {estimatedMinutes && (
          <Row>
            <Column>
              <Text style={etaText}>الوقت المتوقع: ~{estimatedMinutes} دقيقة</Text>
            </Column>
          </Row>
        )}
      </Section>

      <Hr style={divider} />

      <Text style={sectionTitle}>تفاصيل الطلب</Text>
      {orderItems.map((item, i) => (
        <Row key={i} style={itemRow}>
          <Column>
            <Text style={itemName}>{item.name} × {item.quantity}</Text>
          </Column>
          <Column style={priceCol}>
            <Text style={itemPrice}>{(item.price * item.quantity).toFixed(3)} د.ب</Text>
          </Column>
        </Row>
      ))}

      <Hr style={divider} />

      <Row style={totalRow}>
        <Column>
          <Text style={totalLabel}>المجموع</Text>
        </Column>
        <Column style={priceCol}>
          <Text style={totalValue}>{totalBhd.toFixed(3)} د.ب</Text>
        </Column>
      </Row>

      <KahramanaFooter />
    </KahramanaLayout>
  )
}

OrderConfirmation.PreviewProps = {
  customerName: 'فاطمة علي',
  orderId: 'abc123456789',
  orderItems: [
    { name: 'برياني دجاج', quantity: 2, price: 2.500 },
    { name: 'عصير مانجو', quantity: 1, price: 0.750 },
  ],
  totalBhd: 5.750,
  branchName: 'فرع الرفاع',
  deliveryType: 'delivery',
  estimatedMinutes: 30,
} satisfies Props

const heading: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 8px 0',
}

const subheading: React.CSSProperties = {
  color: '#cccccc',
  fontSize: '15px',
  margin: '0 0 24px 0',
}

const metaBox: React.CSSProperties = {
  backgroundColor: '#1a1a1a',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '8px',
}

const metaCell: React.CSSProperties = {
  padding: '0 8px',
}

const metaLabel: React.CSSProperties = {
  color: '#888888',
  fontSize: '11px',
  margin: '0 0 2px 0',
  textTransform: 'uppercase',
}

const metaValue: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  margin: 0,
}

const etaText: React.CSSProperties = {
  color: '#c9a961',
  fontSize: '13px',
  textAlign: 'center',
  margin: '8px 0 0 0',
}

const divider: React.CSSProperties = {
  borderColor: '#2a2a2a',
  margin: '16px 0',
}

const sectionTitle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  margin: '0 0 12px 0',
}

const itemRow: React.CSSProperties = {
  marginBottom: '8px',
}

const itemName: React.CSSProperties = {
  color: '#cccccc',
  fontSize: '14px',
  margin: 0,
}

const priceCol: React.CSSProperties = {
  textAlign: 'left',
}

const itemPrice: React.CSSProperties = {
  color: '#999999',
  fontSize: '14px',
  margin: 0,
}

const totalRow: React.CSSProperties = {
  marginTop: '4px',
}

const totalLabel: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 700,
  margin: 0,
}

const totalValue: React.CSSProperties = {
  color: '#c9a961',
  fontSize: '18px',
  fontWeight: 700,
  margin: 0,
  textAlign: 'left',
}
