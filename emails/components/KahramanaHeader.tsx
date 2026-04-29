import * as React from 'react'
import { Img, Hr } from '@react-email/components'

interface Props {
  logoUrl?: string
}

export function KahramanaHeader({ logoUrl }: Props) {
  return (
    <>
      <div style={headerStyle}>
        {logoUrl ? (
          <Img src={logoUrl} alt="كهرمانة" width={120} height={48} style={imgStyle} />
        ) : (
          <div style={wordmarkStyle}>كهرمانة</div>
        )}
      </div>
      <Hr style={dividerStyle} />
    </>
  )
}

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '24px',
}

const imgStyle: React.CSSProperties = {
  display: 'inline-block',
}

const wordmarkStyle: React.CSSProperties = {
  color: '#c9a961',
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '0.02em',
}

const dividerStyle: React.CSSProperties = {
  borderColor: '#2a2a2a',
  margin: '0 0 28px 0',
}
