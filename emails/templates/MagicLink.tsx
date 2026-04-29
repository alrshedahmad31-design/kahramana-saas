import * as React from 'react'
import { Text, Section } from '@react-email/components'
import { KahramanaLayout } from '../components/KahramanaLayout'
import { KahramanaHeader } from '../components/KahramanaHeader'
import { KahramanaButton } from '../components/KahramanaButton'
import { KahramanaFooter } from '../components/KahramanaFooter'

interface Props {
  magicLinkUrl: string
}

export default function MagicLink({ magicLinkUrl }: Props) {
  return (
    <KahramanaLayout preview="رابط تسجيل الدخول إلى كهرمانة">
      <KahramanaHeader />

      <Section>
        <Text style={heading}>تسجيل الدخول</Text>
        <Text style={body}>
          طلبت رابط تسجيل الدخول إلى لوحة تحكم{' '}
          <strong style={gold}>كهرمانة</strong>.
          انقر على الزر أدناه للدخول مباشرةً.
        </Text>
        <Text style={body}>
          الرابط صالح لمدة <strong>ساعة واحدة</strong> فقط.
        </Text>
      </Section>

      <Section style={buttonSection}>
        <KahramanaButton href={magicLinkUrl}>تسجيل الدخول</KahramanaButton>
      </Section>

      <Text style={hint}>
        إذا لم تطلب هذا الرابط، يمكنك تجاهل هذا البريد بأمان.
        لن يتمكن أحد من الدخول بدون النقر على الرابط.
      </Text>

      <KahramanaFooter />
    </KahramanaLayout>
  )
}

MagicLink.PreviewProps = {
  magicLinkUrl: 'https://saas.kahramanat.com/auth/callback?code=example',
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
