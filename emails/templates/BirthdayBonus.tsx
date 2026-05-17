import * as React from 'react'
import { Text, Section, Hr } from '@react-email/components'
import { KahramanaLayout } from '../components/KahramanaLayout'
import { KahramanaHeader } from '../components/KahramanaHeader'
import { KahramanaButton } from '../components/KahramanaButton'
import { KahramanaFooter } from '../components/KahramanaFooter'

export interface BirthdayCopy {
  heading:       string
  subheading:    string
  pointsAwarded: string
  balance:       string
  tier:          string
  accountCta:    string
  whatsappCta:   string
  footnote:      string
}

interface Props {
  ar:           BirthdayCopy
  en:           BirthdayCopy
  accountUrl:   string
  whatsappUrl:  string
}

export default function BirthdayBonus({ ar, en, accountUrl, whatsappUrl }: Props) {
  return (
    <KahramanaLayout preview={ar.heading}>
      <KahramanaHeader />

      {/* AR block */}
      <Section dir="rtl">
        <Text style={emoji}>🎉</Text>
        <Text style={heading}>{ar.heading}</Text>
        <Text style={subheading}>{ar.subheading}</Text>
        <Text style={body}>{ar.pointsAwarded}</Text>
        <Text style={body}>{ar.balance}</Text>
        <Text style={body}>{ar.tier}</Text>
      </Section>

      <Hr style={divider} />

      {/* EN block */}
      <Section dir="ltr">
        <Text style={heading}>{en.heading}</Text>
        <Text style={subheading}>{en.subheading}</Text>
        <Text style={body}>{en.pointsAwarded}</Text>
        <Text style={body}>{en.balance}</Text>
        <Text style={body}>{en.tier}</Text>
      </Section>

      <Section style={buttonSection}>
        <KahramanaButton href={accountUrl}>
          {ar.accountCta} · {en.accountCta}
        </KahramanaButton>
      </Section>

      <Section style={buttonSection}>
        <KahramanaButton href={whatsappUrl}>
          {ar.whatsappCta} · {en.whatsappCta}
        </KahramanaButton>
      </Section>

      <Text style={hint}>{ar.footnote}</Text>
      <Text style={hintEn}>{en.footnote}</Text>

      <KahramanaFooter />
    </KahramanaLayout>
  )
}

BirthdayBonus.PreviewProps = {
  ar: {
    heading:       'عيد ميلاد سعيد!',
    subheading:    'نتمنى لك يوماً رائعاً يا أحمد',
    pointsAwarded: 'أهديناك 50 نقطة بمناسبة عيد ميلادك.',
    balance:       'رصيدك الحالي: 250 نقطة',
    tier:          'مستواك في برنامج الولاء: ذهبي',
    accountCta:    'زيارة حسابي',
    whatsappCta:   'تواصل عبر واتساب',
    footnote:      'إذا كنت لا ترغب في تلقي هذه الرسائل، يمكنك إزالة تاريخ ميلادك من إعدادات حسابك.',
  },
  en: {
    heading:       'Happy Birthday!',
    subheading:    'Wishing you a wonderful day, Ahmed',
    pointsAwarded: "We've added 50 bonus points as our gift to you.",
    balance:       'Your current balance: 250 points',
    tier:          'Loyalty tier: Gold',
    accountCta:    'Visit My Account',
    whatsappCta:   'Continue on WhatsApp',
    footnote:      'To stop receiving these messages, remove your birthday from your account settings.',
  },
  accountUrl:  'https://kahramanat.com/account',
  whatsappUrl: 'https://wa.me/97317131413?text=test',
} satisfies Props

const emoji: React.CSSProperties = {
  fontSize: '40px',
  textAlign: 'center',
  margin: '0 0 8px 0',
}

const heading: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 8px 0',
  textAlign: 'center',
}

const subheading: React.CSSProperties = {
  color: '#c9a961',
  fontSize: '16px',
  margin: '0 0 16px 0',
  textAlign: 'center',
}

const body: React.CSSProperties = {
  color: '#cccccc',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 8px 0',
  textAlign: 'center',
}

const divider: React.CSSProperties = {
  borderColor: '#2a2a2a',
  margin: '20px 0',
}

const buttonSection: React.CSSProperties = {
  textAlign: 'center',
  margin: '16px 0',
}

const hint: React.CSSProperties = {
  color: '#666666',
  fontSize: '12px',
  margin: '16px 0 4px 0',
  textAlign: 'center',
  direction: 'rtl',
}

const hintEn: React.CSSProperties = {
  color: '#666666',
  fontSize: '12px',
  margin: '0 0 16px 0',
  textAlign: 'center',
  direction: 'ltr',
}
