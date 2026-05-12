import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgotPassword')
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  }
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgotPassword')

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-cairo text-2xl font-black text-brand-gold mb-1">
            كهرمانة بغداد
          </p>
          <h1 className="font-almarai text-lg font-bold text-brand-text mb-1">
            {t('title')}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted">
            {t('description')}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 sm:p-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}
