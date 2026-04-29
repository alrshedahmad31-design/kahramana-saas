'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface DayRow {
  dayIndex:  number
  openTime:  string
  closeTime: string
  isClosed:  boolean
}

interface Branch { id: string; name_ar: string; name_en: string }

const DEFAULT_HOURS: DayRow[] = Array.from({ length: 7 }, (_, i) => ({
  dayIndex:  i,
  openTime:  '19:00',
  closeTime: '01:00',
  isClosed:  false,
}))

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function HoursSettings() {
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const font     = isAr ? 'font-almarai' : 'font-satoshi'
  const days     = isAr ? DAYS_AR : DAYS_EN

  const [branches,   setBranches]   = useState<Branch[]>([])
  const [branchId,   setBranchId]   = useState<string>('')
  const [hours,      setHours]      = useState<DayRow[]>(DEFAULT_HOURS)
  const [loading,    setLoading]    = useState(true)
  const [saveState,  setSaveState]  = useState<SaveState>('idle')

  // Load branches
  useEffect(() => {
    async function loadBranches() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await supabase
        .from('branches')
        .select('id, name_ar, name_en')
        .eq('is_active', true)
        .order('created_at')
      if (data && data.length > 0) {
        setBranches(data as Branch[])
        setBranchId((data as Branch[])[0].id)
      }
      setLoading(false)
    }
    loadBranches()
  }, [supabase])

  // Load hours when branch changes
  useEffect(() => {
    if (!branchId) return
    async function loadHours() {
      setLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await supabase
        .from('business_hours')
        .select('*')
        .eq('branch_id', branchId)
        .order('day_of_week')
      if (data && data.length === 7) {
        setHours(
          data.map(row => ({
            dayIndex:  row.day_of_week,
            openTime:  row.open_time,
            closeTime: row.close_time,
            isClosed:  row.is_closed,
          }))
        )
      } else {
        setHours(DEFAULT_HOURS)
      }
      setLoading(false)
    }
    loadHours()
  }, [branchId, supabase])

  function updateDay(dayIndex: number, patch: Partial<DayRow>) {
    setHours(prev => prev.map(d => d.dayIndex === dayIndex ? { ...d, ...patch } : d))
  }

  async function saveHours() {
    if (!branchId) return
    setSaveState('saving')
    const rows = hours.map(d => ({
      branch_id:   branchId,
      day_of_week: d.dayIndex,
      open_time:   d.openTime,
      close_time:  d.closeTime,
      is_closed:   d.isClosed,
      updated_at:  new Date().toISOString(),
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('business_hours')
      .upsert(rows, { onConflict: 'branch_id,day_of_week' })
    if (error) {
      setSaveState('error')
    } else {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="w-8 h-8 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'أوقات العمل' : 'Operating Hours'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr ? 'حدد ساعات الفتح والإغلاق لكل يوم لكل فرع' : 'Set opening and closing times for each branch'}
        </p>
      </div>

      {/* Branch selector */}
      {branches.length > 1 && (
        <div className="flex items-center gap-2">
          <label className={`text-xs font-bold text-brand-muted shrink-0 ${font}`}>
            {isAr ? 'الفرع:' : 'Branch:'}
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {branches.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBranchId(b.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${font}
                  ${branchId === b.id
                    ? 'bg-brand-gold text-brand-black'
                    : 'bg-brand-surface-2 border border-brand-border text-brand-muted hover:text-brand-text'}`}
              >
                {isAr ? b.name_ar : b.name_en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day grid */}
      <div className="flex flex-col gap-2">
        <div className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0 items-center
          text-[10px] font-black uppercase tracking-widest text-brand-muted/60 px-4 mb-1 ${font}`}>
          <span>{isAr ? 'اليوم' : 'Day'}</span>
          <span className="text-center w-20">{isAr ? 'فتح' : 'Opens'}</span>
          <span className="text-center w-20">{isAr ? 'إغلاق' : 'Closes'}</span>
          <span className="text-center w-16">{isAr ? 'مغلق' : 'Closed'}</span>
        </div>

        {hours.map(day => (
          <div
            key={day.dayIndex}
            className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-4 py-3 rounded-xl border transition-colors
              ${day.isClosed
                ? 'bg-brand-surface border-brand-border opacity-60'
                : 'bg-brand-surface-2 border-brand-border'}`}
          >
            <span className={`text-sm font-bold text-brand-text ${font}`}>
              {days[day.dayIndex]}
            </span>
            <input
              type="time"
              value={day.openTime}
              disabled={day.isClosed}
              onChange={e => updateDay(day.dayIndex, { openTime: e.target.value })}
              className={`w-20 px-2 py-1.5 rounded-lg bg-brand-surface border border-brand-border
                text-brand-text text-xs outline-none font-satoshi
                focus:border-brand-gold/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
            />
            <input
              type="time"
              value={day.closeTime}
              disabled={day.isClosed}
              onChange={e => updateDay(day.dayIndex, { closeTime: e.target.value })}
              className={`w-20 px-2 py-1.5 rounded-lg bg-brand-surface border border-brand-border
                text-brand-text text-xs outline-none font-satoshi
                focus:border-brand-gold/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
            />
            {/* Closed toggle */}
            <div className="flex items-center justify-center w-16">
              <button
                type="button"
                role="switch"
                aria-checked={day.isClosed}
                onClick={() => updateDay(day.dayIndex, { isClosed: !day.isClosed })}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200
                  ${day.isClosed ? 'bg-brand-error' : 'bg-brand-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-brand-text shadow transition-all duration-200
                  ${day.isClosed ? 'start-[22px]' : 'start-0.5'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="h-px bg-brand-border" />

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveHours}
          disabled={saveState === 'saving'}
          className={`px-6 py-2.5 rounded-xl bg-brand-gold text-brand-black font-black text-sm
            hover:bg-brand-gold-light transition-colors disabled:opacity-50 ${font}`}
        >
          {saveState === 'saving'
            ? (isAr ? 'جاري الحفظ…' : 'Saving…')
            : (isAr ? 'حفظ أوقات العمل' : 'Save Hours')}
        </button>
        {saveState === 'saved' && (
          <span className={`text-brand-success text-sm font-bold ${font}`}>
            {isAr ? '✓ تم الحفظ' : '✓ Saved'}
          </span>
        )}
        {saveState === 'error' && (
          <span className={`text-brand-error text-sm font-bold ${font}`}>
            {isAr ? 'فشل الحفظ' : 'Save failed'}
          </span>
        )}
      </div>
    </div>
  )
}
