import type { Metadata } from 'next'
import AccountLoginClient from './AccountLoginClient'

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  }
}

export default function CustomerLoginPage() {
  return <AccountLoginClient />
}
