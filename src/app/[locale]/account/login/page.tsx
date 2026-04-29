'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import type { CustomerProfileInsert } from '@/lib/supabase/custom-types'
import CinematicButton from '@/components/ui/CinematicButton'

type Mode = 'login' | 'register'

export default function CustomerLoginPage() {
  const locale = useLocale()
  const isAr   = locale === 'ar'

  const [mode,     setMode]     = useState<Mode>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [phone,    setPhone]    = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const supabase = createClient()

    try {
      if (mode === 'login') {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) throw new Error(signInErr.message)
        window.location.href = isAr ? '/account' : '/en/account'

      } else {
        // Validate phone
        if (!phone.match(/^(\+?973)?[0-9]{8}$/)) {
          throw new Error(isAr ? 'رقم الهاتف غير صحيح' : 'Invalid Bahrain phone number')
        }

        const { data: authData, error: signUpErr } = await supabase.auth.signUp({ email, password })
        if (signUpErr) throw new Error(signUpErr.message)

        const userId = authData.user?.id
        if (!userId) throw new Error('Registration failed')

        const profileInsert: CustomerProfileInsert = {
          id:              userId,
          phone:           phone.replace(/\s/g, ''),
          name:            name.trim() || null,
          email:           email,
          loyalty_tier:    'bronze',
          points_balance:  0,
          total_spent_bhd: 0,
          total_orders:    0,
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: profileErr } = await supabase
          .from('customer_profiles')
          .insert(profileInsert)

        if (profileErr) throw new Error(profileErr.message)

        setSuccess(isAr
          ? 'تم إنشاء حسابك. تحقق من بريدك الإلكتروني لتأكيد الحساب.'
          : 'Account created. Check your email to confirm your account.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-brand-black flex items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-sm">
        <h1 className={`text-3xl font-black text-brand-text mb-2 text-center
          ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {mode === 'login'
            ? (isAr ? 'تسجيل الدخول' : 'Sign In')
            : (isAr ? 'إنشاء حساب' : 'Create Account')}
        </h1>
        <p className={`text-sm text-brand-muted text-center mb-8
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'برنامج ولاء كهرمانة بغداد' : 'Kahramana Baghdad Loyalty Program'}
        </p>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-brand-surface-2 border border-brand-border p-1 mb-6">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors duration-150
                ${isAr ? 'font-almarai' : 'font-satoshi'}
                ${mode === m
                  ? 'bg-brand-gold text-brand-black'
                  : 'text-brand-muted hover:text-brand-text'
                }`}
            >
              {m === 'login'
                ? (isAr ? 'دخول' : 'Sign In')
                : (isAr ? 'تسجيل' : 'Register')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <input
              type="text"
              aria-label={isAr ? 'الاسم (اختياري)' : 'Name (optional)'}
              placeholder={isAr ? 'الاسم (اختياري)' : 'Name (optional)'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                         ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                         focus:border-brand-gold focus:outline-none"
            />
          )}

          <input
            type="email"
            aria-label={isAr ? 'البريد الإلكتروني' : 'Email address'}
            placeholder={isAr ? 'البريد الإلكتروني' : 'Email address'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            dir="ltr"
            className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                       ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                       focus:border-brand-gold focus:outline-none"
          />

          {mode === 'register' && (
            <input
              type="tel"
              aria-label={isAr ? 'رقم الهاتف' : 'Phone number'}
              placeholder={isAr ? 'رقم الهاتف (+973XXXXXXXX)' : 'Phone (+973XXXXXXXX)'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                         ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                         focus:border-brand-gold focus:outline-none"
            />
          )}

          <input
            type="password"
            aria-label={isAr ? 'كلمة المرور' : 'Password'}
            placeholder={isAr ? 'كلمة المرور' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            dir="ltr"
            className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                       ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                       focus:border-brand-gold focus:outline-none"
          />

          {error && (
            <p className={`text-sm text-brand-error ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {error}
            </p>
          )}
          {success && (
            <p className={`text-sm text-brand-success ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {success}
            </p>
          )}

          <CinematicButton type="submit" disabled={loading} isRTL={isAr} className="w-full py-3">
            {loading
              ? (isAr ? 'جاري...' : 'Please wait...')
              : mode === 'login'
                ? (isAr ? 'دخول' : 'Sign In')
                : (isAr ? 'إنشاء الحساب' : 'Create Account')}
          </CinematicButton>
        </form>

        <p className={`mt-6 text-xs text-brand-muted text-center ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr
            ? 'هذا الحساب منفصل عن حساب الموظفين'
            : 'This account is separate from the staff login'}
        </p>
      </div>
    </div>
  )
}
