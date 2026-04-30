'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { advanceOrderStatus } from '@/app/[locale]/dashboard/kds/actions'
import KDSColumn from './KDSColumn'
import type { KDSOrder } from '@/lib/supabase/custom-types'
import { BRANCH_LIST } from '@/constants/contact'

type ActiveStatus = 'accepted' | 'preparing' | 'ready'

type StationFilter = 'all' | 'grill' | 'fry' | 'salads' | 'desserts' | 'drinks'

interface Props {
  initialOrders: KDSOrder[]
  locale:        string
  branchId:      string | null
}

// ── Web Audio synthesis — no file dependency ──────────────────────────────────

function playBell(type: 'new' | 'ready' | 'urgent' = 'new') {
  try {
    const ctx  = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    const beep = (freq: number, start: number, dur: number, vol = 0.35) => {
      const osc = ctx.createOscillator()
      osc.connect(gain)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }

    if (type === 'urgent') {
      // Fast triple beep — escalating pitch
      beep(440, 0,    0.12, 0.5)
      beep(660, 0.15, 0.12, 0.5)
      beep(880, 0.30, 0.20, 0.5)
    } else if (type === 'ready') {
      // Rising two-tone chime
      beep(660, 0,    0.25)
      beep(880, 0.28, 0.35)
    } else {
      // Single warm bell for new order
      beep(880, 0, 0.55)
    }
  } catch { /* no user gesture yet — silent */ }
}

function formatClock(): string {
  const d    = new Date()
  const h    = String(d.getHours() % 12 || 12).padStart(2, '0')
  const m    = String(d.getMinutes()).padStart(2, '0')
  const s    = String(d.getSeconds()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  return `${h}:${m}:${s} ${ampm}`
}

const STATIONS: { id: StationFilter; labelEn: string; labelAr: string; icon: string }[] = [
  { id: 'all',      labelEn: 'All',      labelAr: 'الكل',     icon: '🍽️' },
  { id: 'grill',    labelEn: 'Grill',    labelAr: 'الشواية',  icon: '🔥' },
  { id: 'fry',      labelEn: 'Fry',      labelAr: 'القلي',    icon: '🍳' },
  { id: 'salads',   labelEn: 'Salads',   labelAr: 'السلطات',  icon: '🥗' },
  { id: 'desserts', labelEn: 'Desserts', labelAr: 'الحلويات', icon: '🍰' },
  { id: 'drinks',   labelEn: 'Drinks',   labelAr: 'المشروبات', icon: '🥤' },
]

export default function KDSBoard({ initialOrders, locale, branchId }: Props) {
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  const [orders,         setOrders]         = useState<KDSOrder[]>(initialOrders)
  const [muted,          setMuted]          = useState(false)
  const [fullscreen,     setFullscreen]     = useState(false)
  const [clock,          setClock]          = useState(formatClock)
  const [activeStation,  setActiveStation]  = useState<StationFilter>('all')
  const [viewBranch,     setViewBranch]     = useState<string | null>(null)

  // Track known IDs to detect new accepted & new ready transitions
  const knownIds      = useRef(new Set(initialOrders.map((o) => o.id)))
  const prevReadyIds  = useRef(new Set(initialOrders.filter(o => o.status === 'ready').map(o => o.id)))
  const mutedRef      = useRef(muted)
  useEffect(() => { mutedRef.current = muted }, [muted])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useMemo(() => createClient(), [])

  const fetchOrders = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = supabase
      .from('orders')
      .select(`
        id, customer_name, customer_phone, branch_id, status, notes,
        total_bhd, created_at, updated_at, source,
        whatsapp_sent_at, coupon_id, coupon_discount_bhd, assigned_driver_id,
        order_items(id, name_ar, name_en, quantity, selected_size, selected_variant)
      `)
      .in('status', ['accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    if (branchId) q = q.eq('branch_id', branchId)

    const { data } = await q
    if (!data) return

    const incoming = data as KDSOrder[]

    if (!mutedRef.current) {
      // Sound: new accepted orders
      const newAccepted = incoming.filter(
        (o) => o.status === 'accepted' && !knownIds.current.has(o.id),
      )
      if (newAccepted.length > 0) playBell('new')

      // Sound: orders that just became ready
      const newReady = incoming.filter(
        (o) => o.status === 'ready' && !prevReadyIds.current.has(o.id),
      )
      if (newReady.length > 0) playBell('ready')
    }

    knownIds.current     = new Set(incoming.map((o) => o.id))
    prevReadyIds.current = new Set(incoming.filter(o => o.status === 'ready').map(o => o.id))

    setOrders(incoming)
  }, [supabase, branchId])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useEffect(() => {
    const id = setInterval(fetchOrders, 5_000)
    return () => clearInterval(id)
  }, [fetchOrders])

  useEffect(() => {
    const channel = supabase
      .channel('kds-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase, fetchOrders])

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1_000)
    return () => clearInterval(id)
  }, [])

  async function handleAdvance(orderId: string, currentStatus: ActiveStatus) {
    setOrders((prev) => {
      if (currentStatus === 'ready') return prev.filter((o) => o.id !== orderId)
      const next = currentStatus === 'accepted' ? 'preparing' : 'ready'
      return prev.map((o) => o.id === orderId ? { ...o, status: next as ActiveStatus } : o)
    })
    const result = await advanceOrderStatus(orderId, currentStatus)
    if (!result.success) fetchOrders()

    // Play ready bell on advance to ready
    if (!muted && currentStatus === 'preparing') playBell('ready')
  }

  // Branch filter (client-side) — only active when GM/Owner has no assigned branch
  const filteredOrders = viewBranch
    ? orders.filter((o) => o.branch_id === viewBranch)
    : orders

  const accepted  = filteredOrders.filter((o) => o.status === 'accepted')
  const preparing = filteredOrders.filter((o) => o.status === 'preparing')
  const ready     = filteredOrders.filter((o) => o.status === 'ready')
  const total     = orders.length

  return (
    <div
      className={`flex flex-col h-full bg-brand-black ${fullscreen ? 'fixed inset-0 z-50' : ''}`}
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-brand-border bg-brand-surface">
        {/* Left: title + count */}
        <div className="flex items-center gap-3 shrink-0">
          <h1 className={`font-black text-xl text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'شاشة المطبخ' : 'Kitchen Display'}
          </h1>
          {total > 0 && (
            <span className="bg-brand-error text-white font-satoshi font-black text-sm rounded-full w-7 h-7 flex items-center justify-center tabular-nums animate-pulse">
              {total}
            </span>
          )}
        </div>

        {/* Center: branch filter (GM/Owner only) + station filter */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {!branchId && (
            <select
              value={viewBranch ?? ''}
              onChange={(e) => setViewBranch(e.target.value || null)}
              className={`h-9 rounded-lg border border-brand-border bg-brand-surface-2 text-brand-text text-sm font-bold ps-3 pe-8 shrink-0 focus:outline-none focus:border-brand-gold cursor-pointer ${font}`}
              aria-label={isAr ? 'تصفية حسب الفرع' : 'Filter by branch'}
            >
              <option value="">{isAr ? 'كل الفروع' : 'All Branches'}</option>
              {BRANCH_LIST.filter((b) => b.status === 'active').map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          )}
          {STATIONS.map((s) => {
            const active = activeStation === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveStation(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm whitespace-nowrap
                  transition-colors duration-150 shrink-0
                  ${active
                    ? 'bg-brand-gold text-brand-black'
                    : 'bg-brand-surface-2 text-brand-muted border border-brand-border hover:text-brand-text'}
                  ${font}`}
              >
                <span>{s.icon}</span>
                <span>{isAr ? s.labelAr : s.labelEn}</span>
              </button>
            )
          })}
        </div>

        {/* Right: clock + controls */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-satoshi text-sm text-brand-muted tabular-nums hidden md:block">
            {clock}
          </span>

          {/* Mute */}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            title={muted ? (isAr ? 'تشغيل' : 'Unmute') : (isAr ? 'كتم' : 'Mute')}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand-surface-2 border border-brand-border text-brand-muted hover:text-brand-gold hover:border-brand-gold transition-colors duration-150"
          >
            {muted ? <MuteOnIcon /> : <MuteOffIcon />}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? 'Exit' : 'Fullscreen'}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-brand-surface-2 border border-brand-border text-brand-muted hover:text-brand-gold hover:border-brand-gold transition-colors duration-150"
          >
            {fullscreen ? <ShrinkIcon /> : <ExpandIcon />}
          </button>
        </div>
      </header>

      {/* ── Three kanban columns ──────────────────────────────────────────── */}
      <div className={`flex-1 min-h-0 grid grid-cols-3 ${isAr ? 'divide-x-reverse' : ''} divide-x divide-brand-border`}>
        <KDSColumn status="accepted"  orders={accepted}  isRTL={isAr} onAdvance={handleAdvance} />
        <KDSColumn status="preparing" orders={preparing} isRTL={isAr} onAdvance={handleAdvance} />
        <KDSColumn status="ready"     orders={ready}     isRTL={isAr} onAdvance={handleAdvance} />
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {total === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
          <div className="w-20 h-20 rounded-2xl bg-brand-surface-2 border border-brand-border flex items-center justify-center">
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-brand-muted" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <p className={`font-black text-2xl text-brand-muted ${font}`}>
            {isAr ? 'المطبخ هادئ 🍽️' : 'All clear 🍽️'}
          </p>
          <p className={`text-lg text-brand-muted/50 text-center max-w-xs ${font}`}>
            {isAr ? 'الطلبات المقبولة ستظهر هنا فور وصولها' : 'Accepted orders will appear here automatically'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Inline icons ──────────────────────────────────────────────────────────────

function MuteOffIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H5v4h3l4 4V6zM18.364 5.636a9 9 0 010 12.728" />
    </svg>
  )
}

function MuteOnIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l-4-4m0 4l4-4" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" />
    </svg>
  )
}

function ShrinkIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l-5 5m0-5h5V4M15 9l5 5m0-5h-5V4M9 15l-5-5m0 5h5v5M15 15l5-5m0 5h-5v5" />
    </svg>
  )
}
