import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Time Clock — Kahramana',
}

export default function ClockLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
