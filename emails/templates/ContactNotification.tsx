import * as React from 'react'
import { Text, Section, Row, Column, Hr } from '@react-email/components'
import { KahramanaLayout } from '../components/KahramanaLayout'
import { KahramanaHeader } from '../components/KahramanaHeader'
import { KahramanaFooter } from '../components/KahramanaFooter'

interface Props {
  name: string
  email: string
  phone?: string
  branchName?: string
  message: string
  receivedAt: string
}

export default function ContactNotification({
  name,
  email,
  phone,
  branchName,
  message,
  receivedAt,
}: Props) {
  return (
    <KahramanaLayout preview={`رسالة جديدة من ${name} عبر نموذج التواصل`}>
      <KahramanaHeader />

      <Text style={heading}>رسالة جديدة من نموذج التواصل</Text>
      <Text style={subheading}>وصلت رسالة جديدة من موقع كهرمانة — يُرجى الرد في أقرب وقت.</Text>

      <Section style={metaBox}>
        <Row style={metaRow}>
          <Column style={metaLabelCol}><Text style={metaLabel}>الاسم</Text></Column>
          <Column><Text style={metaValue}>{name}</Text></Column>
        </Row>
        <Row style={metaRow}>
          <Column style={metaLabelCol}><Text style={metaLabel}>البريد الإلكتروني</Text></Column>
          <Column><Text style={metaValue}>{email}</Text></Column>
        </Row>
        {phone && (
          <Row style={metaRow}>
            <Column style={metaLabelCol}><Text style={metaLabel}>الهاتف</Text></Column>
            <Column><Text style={metaValue}>{phone}</Text></Column>
          </Row>
        )}
        {branchName && (
          <Row style={metaRow}>
            <Column style={metaLabelCol}><Text style={metaLabel}>الفرع</Text></Column>
            <Column><Text style={metaValue}>{branchName}</Text></Column>
          </Row>
        )}
        <Row style={metaRow}>
          <Column style={metaLabelCol}><Text style={metaLabel}>الوقت</Text></Column>
          <Column><Text style={metaValue}>{receivedAt}</Text></Column>
        </Row>
      </Section>

      <Hr style={divider} />

      <Text style={sectionTitle}>نص الرسالة</Text>
      <Section style={messageBox}>
        <Text style={messageText}>{message}</Text>
      </Section>

      <KahramanaFooter />
    </KahramanaLayout>
  )
}

ContactNotification.PreviewProps = {
  name: 'أحمد محمد',
  email: 'ahmed@example.com',
  phone: '+97336001122',
  branchName: 'فرع الرفاع',
  message: 'أريد الاستفسار عن خدمة التوصيل للمنامة وهل تتوفر عروض خاصة للمجموعات؟',
  receivedAt: '14 مايو 2026 — 10:30 ص',
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

const metaRow: React.CSSProperties = {
  marginBottom: '8px',
}

const metaLabelCol: React.CSSProperties = {
  width: '140px',
}

const metaLabel: React.CSSProperties = {
  color: '#888888',
  fontSize: '12px',
  margin: 0,
}

const metaValue: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  margin: 0,
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

const messageBox: React.CSSProperties = {
  backgroundColor: '#111111',
  borderRadius: '8px',
  borderLeft: '3px solid #c9a961',
  padding: '16px',
}

const messageText: React.CSSProperties = {
  color: '#dddddd',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: 0,
  whiteSpace: 'pre-wrap',
}
