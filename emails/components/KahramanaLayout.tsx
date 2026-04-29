import * as React from 'react'
import {
  Html, Head, Font, Preview, Body, Container,
} from '@react-email/components'

interface Props {
  preview: string
  children: React.ReactNode
}

export function KahramanaLayout({ preview, children }: Props) {
  return (
    <Html lang="ar" dir="rtl">
      <Head>
        <Font
          fontFamily="Cairo"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvalIhTp2mxdt0UX8.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Cairo"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvalIhTp2mxdt0UX8.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {children}
        </Container>
      </Body>
    </Html>
  )
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#0a0a0a',
  margin: 0,
  padding: '32px 16px',
  fontFamily: "'Cairo', Arial, sans-serif",
}

const containerStyle: React.CSSProperties = {
  backgroundColor: '#141414',
  border: '1px solid #c9a961',
  borderRadius: '12px',
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 32px',
}
