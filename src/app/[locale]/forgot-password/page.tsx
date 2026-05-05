import type { Metadata } from 'next'
import ForgotPasswordClient from './ForgotPasswordClient'

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  }
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />
}
