import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import LoginForm from '@/components/auth/LoginForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: t('login'),
    robots: { index: false, follow: false },
  }
}

export default async function LoginPage() {
  const t = await getTranslations('auth')

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="mb-8 text-center">
          <p className="font-cairo text-2xl font-black text-brand-gold mb-1">
            كهرمانة بغداد
          </p>
          <p className="font-satoshi text-sm text-brand-muted">
            {t('staffOnly')}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 sm:p-8">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
