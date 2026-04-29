'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

interface Branch {
  id:        string
  name_ar:   string
  name_en:   string
  phone:     string
  whatsapp:  string
  wa_link:   string
  maps_url:  string | null
  is_active: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function BranchesSettings() {
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const font     = isAr ? 'font-almarai' : 'font-satoshi'

  const [branches,   setBranches]   = useState<Branch[]>([])
  const [loading,    setLoading]    = useState(true)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [editForm,   setEditForm]   = useState<Partial<Branch>>({})
  const [saveState,  setSaveState]  = useState<SaveState>('idle')

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('branches')
        .select('*')
        .order('created_at', { ascending: true })
      if (data) setBranches(data as Branch[])
      setLoading(false)
    }
    load()
  }, [supabase])

  function startEdit(branch: Branch) {
    setEditId(branch.id)
    setEditForm({ ...branch })
  }

  function cancelEdit() {
    setEditId(null)
    setEditForm({})
    setSaveState('idle')
  }

  async function saveEdit() {
    if (!editId || !editForm) return
    setSaveState('saving')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('branches')
      .update({
        name_ar:  editForm.name_ar,
        name_en:  editForm.name_en,
        phone:    editForm.phone,
        whatsapp: editForm.whatsapp,
        wa_link:  editForm.wa_link,
        maps_url: editForm.maps_url,
      })
      .eq('id', editId)
    if (error) {
      setSaveState('error')
    } else {
      setBranches(prev => prev.map(b => b.id === editId ? { ...b, ...editForm } as Branch : b))
      setSaveState('saved')
      setTimeout(() => { setEditId(null); setEditForm({}); setSaveState('idle') }, 1200)
    }
  }

  async function toggleActive(branch: Branch) {
    const next = !branch.is_active
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('branches')
      .update({ is_active: next })
      .eq('id', branch.id)
    setBranches(prev => prev.map(b => b.id === branch.id ? { ...b, is_active: next } : b))
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
          {isAr ? 'الفروع' : 'Branch Locations'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr ? 'إدارة فروع المطعم ومعلومات التواصل' : 'Manage restaurant branches and contact details'}
        </p>
      </div>

      {/* Branch cards */}
      <div className="flex flex-col gap-4">
        {branches.map(branch => {
          const isEditing = editId === branch.id
          return (
            <div
              key={branch.id}
              className={`rounded-2xl border transition-all duration-200
                ${isEditing ? 'border-brand-gold/40 bg-brand-surface' : 'border-brand-border bg-brand-surface-2'}`}
            >
              {/* Card header */}
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${branch.is_active ? 'bg-brand-success' : 'bg-brand-muted'}`} />
                  <div className="min-w-0">
                    <span className={`text-sm font-black text-brand-text block ${font}`}>
                      {isAr ? branch.name_ar : branch.name_en}
                    </span>
                    <span className={`text-xs text-brand-muted ${font}`}>
                      {branch.phone}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border
                    ${branch.is_active
                      ? 'text-brand-success border-brand-success/30 bg-brand-success/5'
                      : 'text-brand-muted border-brand-border bg-brand-surface'} ${font}`}>
                    {branch.is_active
                      ? (isAr ? 'نشط' : 'Active')
                      : (isAr ? 'غير نشط' : 'Inactive')}
                  </span>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(branch)}
                      className={`text-xs px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border
                        text-brand-muted hover:text-brand-gold hover:border-brand-gold/40
                        transition-colors font-bold ${font}`}
                    >
                      {isAr ? 'تعديل' : 'Edit'}
                    </button>
                  )}
                </div>
              </div>

              {/* Inline edit form */}
              {isEditing && (
                <div className="border-t border-brand-border px-5 py-5 flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <EditField
                      label={isAr ? 'الاسم بالعربية' : 'Arabic Name'}
                      value={editForm.name_ar ?? ''}
                      onChange={v => setEditForm(p => ({ ...p, name_ar: v }))}
                      dir="rtl" font={font}
                    />
                    <EditField
                      label={isAr ? 'الاسم بالإنجليزية' : 'English Name'}
                      value={editForm.name_en ?? ''}
                      onChange={v => setEditForm(p => ({ ...p, name_en: v }))}
                      dir="ltr" font="font-satoshi"
                    />
                    <EditField
                      label={isAr ? 'رقم الهاتف' : 'Phone'}
                      value={editForm.phone ?? ''}
                      onChange={v => setEditForm(p => ({ ...p, phone: v }))}
                      type="tel" dir="ltr" font={font}
                    />
                    <EditField
                      label={isAr ? 'رقم واتساب' : 'WhatsApp'}
                      value={editForm.whatsapp ?? ''}
                      onChange={v => setEditForm(p => ({ ...p, whatsapp: v }))}
                      type="tel" dir="ltr" font={font}
                    />
                    <EditField
                      label={isAr ? 'رابط واتساب' : 'WhatsApp Link'}
                      value={editForm.wa_link ?? ''}
                      onChange={v => setEditForm(p => ({ ...p, wa_link: v }))}
                      dir="ltr" font={font}
                    />
                    <EditField
                      label={isAr ? 'رابط الخريطة' : 'Google Maps URL'}
                      value={editForm.maps_url ?? ''}
                      onChange={v => setEditForm(p => ({ ...p, maps_url: v || null }))}
                      dir="ltr" font={font}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {/* Toggle active */}
                    <button
                      type="button"
                      onClick={() => toggleActive(branch)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-colors ${font}
                        ${branch.is_active
                          ? 'text-brand-error border-brand-error/30 hover:bg-brand-error/5'
                          : 'text-brand-success border-brand-success/30 hover:bg-brand-success/5'}`}
                    >
                      {branch.is_active
                        ? (isAr ? 'تعطيل الفرع' : 'Deactivate')
                        : (isAr ? 'تفعيل الفرع' : 'Activate')}
                    </button>

                    <div className="flex items-center gap-2">
                      {saveState === 'saved' && (
                        <span className={`text-brand-success text-xs font-bold ${font}`}>
                          {isAr ? '✓ تم الحفظ' : '✓ Saved'}
                        </span>
                      )}
                      {saveState === 'error' && (
                        <span className={`text-brand-error text-xs font-bold ${font}`}>
                          {isAr ? 'فشل الحفظ' : 'Save failed'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className={`text-xs px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border
                          text-brand-muted hover:text-brand-text transition-colors font-bold ${font}`}
                      >
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={saveState === 'saving'}
                        className={`text-xs px-4 py-1.5 rounded-lg bg-brand-gold text-brand-black
                          font-black hover:bg-brand-gold-light transition-colors disabled:opacity-50 ${font}`}
                      >
                        {saveState === 'saving'
                          ? (isAr ? 'جاري الحفظ…' : 'Saving…')
                          : (isAr ? 'حفظ' : 'Save')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Coming Soon — Add Branch */}
      <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-2xl border border-brand-border border-dashed">
        <span className="text-3xl">+</span>
        <p className={`text-brand-muted text-sm font-bold ${font}`}>
          {isAr ? 'إضافة فرع جديد — قريباً' : 'Add New Branch — Coming Soon'}
        </p>
        <p className={`text-brand-muted/50 text-xs ${font}`}>
          {isAr ? 'تواصل مع الدعم لإضافة فروع إضافية' : 'Contact support to add additional branches'}
        </p>
      </div>
    </div>
  )
}

function EditField({
  label, value, onChange, type = 'text', dir, font,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  type?:    string
  dir:      'ltr' | 'rtl'
  font:     string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={`text-[11px] text-brand-muted font-bold ${font}`}>{label}</label>
      <input
        type={type}
        value={value}
        dir={dir}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2 rounded-xl bg-brand-surface-2 border border-brand-border
          text-brand-text text-sm placeholder:text-brand-muted/40 outline-none
          focus:border-brand-gold/50 focus:ring-1 focus:ring-brand-gold/20 transition-colors ${font}`}
      />
    </div>
  )
}
