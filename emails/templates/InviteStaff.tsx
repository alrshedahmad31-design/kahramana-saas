import * as React from 'react'
import { Text, Section } from '@react-email/components'
import { KahramanaLayout } from '../components/KahramanaLayout'
import { KahramanaHeader } from '../components/KahramanaHeader'
import { KahramanaButton } from '../components/KahramanaButton'
import { KahramanaFooter } from '../components/KahramanaFooter'

interface Props {
  staffName: string
  inviteUrl: string
  role?: string
}

export default function InviteStaff({ staffName, inviteUrl, role }: Props) {
  const roleLabel = ROLE_LABELS[role ?? ''] ?? role ?? 'موظف'

  return (
    <KahramanaLayout preview={`دعوة للانضمام إلى فريق كهرمانة — ${staffName}`}>
      <KahramanaHeader />

      <Section>
        <Text style={greeting}>مرحباً {staffName}،</Text>
        <Text style={body}>
          تمت إضافتك إلى فريق <strong style={gold}>كهرمانة</strong> بصفة{' '}
          <strong style={gold}>{roleLabel}</strong>.
        </Text>
        <Text style={body}>
          انقر على الزر أدناه لتفعيل حسابك وإنشاء كلمة مرور خاصة بك.
          الرابط صالح لمدة <strong>٢٤ ساعة</strong>.
        </Text>
      </Section>

      <Section style={buttonSection}>
        <KahramanaButton href={inviteUrl}>تفعيل الحساب</KahramanaButton>
      </Section>

      <Text style={hint}>
        إذا لم تطلب هذه الدعوة، يمكنك تجاهل هذا البريد بأمان.
      </Text>

      <KahramanaFooter />
    </KahramanaLayout>
  )
}

InviteStaff.PreviewProps = {
  staffName: 'أحمد محمد',
  inviteUrl: 'https://saas.kahramanat.com/auth/callback?code=example',
  role: 'cashier',
} satisfies Props

const ROLE_LABELS: Record<string, string> = {
  owner:           'مالك',
  general_manager: 'مدير عام',
  branch_manager:  'مدير فرع',
  cashier:         'كاشير',
  driver:          'سائق',
}

const gold: React.CSSProperties = { color: '#c9a961' }

const greeting: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '18px',
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
