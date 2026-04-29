import * as React from 'react'
import { Text, Section } from '@react-email/components'
import { KahramanaLayout } from '../components/KahramanaLayout'
import { KahramanaHeader } from '../components/KahramanaHeader'
import { KahramanaButton } from '../components/KahramanaButton'
import { KahramanaFooter } from '../components/KahramanaFooter'

interface Props {
  resetUrl: string
}

export default function ResetPassword({ resetUrl }: Props) {
  return (
    <KahramanaLayout preview="إعادة تعيين كلمة مرورك في كهرمانة">
      <KahramanaHeader />

      <Section>
        <Text style={heading}>إعادة تعيين كلمة المرور</Text>
        <Text style={body}>
          تلقينا طلباً لإعادة تعيين كلمة مرور حسابك في{' '}
          <strong style={gold}>كهرمانة</strong>.
          انقر على الزر أدناه لإنشاء كلمة مرور جديدة.
        </Text>
        <Text style={body}>
          الرابط صالح لمدة <strong>٢٤ ساعة</strong>.
        </Text>
      </Section>

      <Section style={buttonSection}>
        <KahramanaButton href={resetUrl}>إعادة تعيين كلمة المرور</KahramanaButton>
      </Section>

      <Text style={hint}>
        إذا لم تطلب إعادة تعيين كلمة مرورك، يمكنك تجاهل هذا البريد.
        كلمة مرورك الحالية ستبقى كما هي.
      </Text>

      <KahramanaFooter />
    </KahramanaLayout>
  )
}

ResetPassword.PreviewProps = {
  resetUrl: 'https://saas.kahramanat.com/auth/callback?code=example&type=recovery',
} satisfies Props

const gold: React.CSSProperties = { color: '#c9a961' }

const heading: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 16px 0',
}

const body: React.CSSProperties = {
  color: '#cccccc',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 14px 0',
}

const buttonSection: React.CSSProperties = {
  textAlign: 'center',
  margin: '28px 0',
}

const hint: React.CSSProperties = {
  color: '#666666',
  fontSize: '13px',
  margin: '16px 0 0 0',
  textAlign: 'center',
}
