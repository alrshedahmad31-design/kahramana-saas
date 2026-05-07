import type { Metadata } from 'next'
import AccountLoginClient from '../login/AccountLoginClient'

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  }
}

export default function CustomerRegisterPage() {
  return <AccountLoginClient initialMode="register" />
}
