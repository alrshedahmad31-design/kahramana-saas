'use client'

import { useState, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function SecuritySettings() {
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const font     = isAr ? 'font-almarai' : 'font-satoshi'

  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [saveState,  setSaveState]  = useState<SaveState>('idle')
  const [errMsg,     setErrMsg]     = useState('')

  const handleChangePassword = async () => {
    setErrMsg('')
    if (newPw !== confirmPw) {
      setErrMsg(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
      return
    }
    if (newPw.length < 8) {
      setErrMsg(isAr ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters')
      return
    }
    setSaveState('saving')
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setErrMsg(error.message)
      setSaveState('error')
    } else {
      setSaveState('saved')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setTimeout(() => setSaveState('idle'), 2500)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'الأمان' : 'Security'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr ? 'تغيير كلمة المرور وإعدادات الأمان' : 'Change your password and security settings'}
        </p>
      </div>

      {/* ── Change password ── */}
      <div className="flex flex-col gap-4">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'تغيير كلمة المرور' : 'Change Password'}
        </label>

        <PasswordField
          label={isAr ? 'كلمة المرور الحالية' : 'Current Password'}
          value={currentPw}
          onChange={setCurrentPw}
          font={font}
        />
        <PasswordField
          label={isAr ? 'كلمة المرور الجديدة' : 'New Password'}
          value={newPw}
          onChange={setNewPw}
          font={font}
        />
        <PasswordField
          label={isAr ? 'تأكيد كلمة المرور' : 'Confirm New Password'}
          value={confirmPw}
          onChange={setConfirmPw}
          font={font}
        />

        {errMsg && (
          <p className={`text-brand-error text-sm ${font}`}>{errMsg}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={saveState === 'saving' || !newPw || !confirmPw}
            className={`px-6 py-2.5 rounded-xl bg-brand-gold text-brand-black font-black text-sm
              hover:bg-brand-gold-light transition-colors disabled:opacity-50 ${font}`}
          >
            {saveState === 'saving'
              ? (isAr ? 'جاري التحديث…' : 'Updating…')
              : (isAr ? 'تحديث كلمة المرور' : 'Update Password')}
          </button>
          {saveState === 'saved' && (
            <span className={`text-brand-success text-sm font-bold ${font}`}>
              {isAr ? '✓ تم التحديث' : '✓ Updated'}
            </span>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-brand-border" />

      {/* ── Session info ── */}
      <div className="flex flex-col gap-3">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'الجلسات النشطة' : 'Active Sessions'}
        </label>
        <div className="flex items-center justify-between gap-4 px-4 py-4 rounded-xl bg-brand-surface-2 border border-brand-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💻</span>
            <div className="flex flex-col gap-0.5">
              <span className={`text-sm font-bold text-brand-text ${font}`}>
                {isAr ? 'الجلسة الحالية' : 'Current session'}
              </span>
              <span className={`text-xs text-brand-success ${font}`}>
                {isAr ? 'نشطة الآن' : 'Active now'}
              </span>
            </div>
          </div>
          <span className={`text-[11px] text-brand-muted ${font}`}>
            {isAr ? 'هذا الجهاز' : 'This device'}
          </span>
        </div>
      </div>
    </div>
  )
}

function PasswordField({
  label, value, onChange, font,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  font:     string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className={`text-[11px] text-brand-muted font-bold ${font}`}>{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          dir="ltr"
          className={`w-full px-4 py-2.5 pe-11 rounded-xl bg-brand-surface-2 border border-brand-border
            text-brand-text text-sm outline-none focus:border-brand-gold/50 focus:ring-1
            focus:ring-brand-gold/20 transition-colors font-satoshi`}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text transition-colors"
          tabIndex={-1}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            {show
              ? <><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></>
              : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
            }
          </svg>
        </button>
      </div>
    </div>
  )
}
