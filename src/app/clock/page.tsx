import type { Metadata } from 'next'
import ClockClient from './ClockClient'

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
    other: { noIndex: 'true' },
  }
}

export default function ClockPage() {
  return <ClockClient />
}
