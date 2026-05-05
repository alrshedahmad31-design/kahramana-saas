import type { Metadata } from 'next'
import SetPasswordClient from './SetPasswordClient'

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  }
}

export default function SetPasswordPage() {
  return <SetPasswordClient />
}
