import * as React from 'react'
import { Hr, Link, Text } from '@react-email/components'

export function KahramanaFooter() {
  return (
    <>
      <Hr style={dividerStyle} />
      <Text style={footerText}>
        كهرمانة — البحرين
      </Text>
      <Text style={footerLinks}>
        <Link href="https://kahramanat.com" style={linkStyle}>الموقع الرسمي</Link>
        {' · '}
        <Link href="mailto:info@kahramanat.com" style={linkStyle}>info@kahramanat.com</Link>
      </Text>
      <Text style={disclaimerStyle}>
        هذه الرسالة أُرسلت تلقائياً، يُرجى عدم الرد عليها مباشرةً.
      </Text>
    </>
  )
}

const dividerStyle: React.CSSProperties = {
  borderColor: '#2a2a2a',
  margin: '28px 0 16px 0',
}

const footerText: React.CSSProperties = {
  color: '#6b6b6b',
  fontSize: '13px',
  textAlign: 'center',
  margin: '0 0 6px 0',
}

const footerLinks: React.CSSProperties = {
  color: '#6b6b6b',
  fontSize: '13px',
  textAlign: 'center',
  margin: '0 0 12px 0',
}

const linkStyle: React.CSSProperties = {
  color: '#c9a961',
  textDecoration: 'none',
}

const disclaimerStyle: React.CSSProperties = {
  color: '#444444',
  fontSize: '11px',
  textAlign: 'center',
  margin: 0,
}
