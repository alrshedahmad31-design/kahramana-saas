import * as React from 'react'
import { Button } from '@react-email/components'

interface Props {
  href: string
  children: React.ReactNode
}

export function KahramanaButton({ href, children }: Props) {
  return (
    <Button href={href} style={buttonStyle}>
      {children}
    </Button>
  )
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#c9a961',
  borderRadius: '8px',
  color: '#0a0a0a',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 700,
  fontFamily: "'Cairo', Arial, sans-serif",
  padding: '12px 32px',
  textDecoration: 'none',
  textAlign: 'center',
  cursor: 'pointer',
}
