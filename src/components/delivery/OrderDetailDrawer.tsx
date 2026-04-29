'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence }        from 'framer-motion'
import { X, Phone, MapPin, Bike, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { createClient }                   from '@/lib/supabase/client'
import { DV, DV_STATUS, STATUS_BORDER, STATUS_LABEL } from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver, OrderItem } from '@/lib/delivery/types'

interface Props {
  order:      DeliveryOrder | null
  drivers:    Driver[]
  open:       boolean
  onClose:    () => void
  onDispatch: () => void
  isAr:       boolean
}

const TIMELINE_STEPS: { status: string; label: string; icon: React.ReactNode }[] = [
  { status: 'accepted',         label: 'استلام الطلب',   icon: <CheckCircle size={14} /> },
  { status: 'preparing',        label: 'قيد التحضير',    icon: <Clock size={14} />       },
  { status: 'ready',            label: 'جاهز للاستلام', icon: <CheckCircle size={14} /> },
  { status: 'out_for_delivery', label: 'خرج للتوصيل',    icon: <Bike size={14} />        },
  { status: 'delivered',        label: 'تم التوصيل',     icon: <CheckCircle size={14} /> },
]

const STATUS_ORDER = ['accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered']

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ar-BH', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-BH', { day: 'numeric', month: 'short' })
}

export default function OrderDetailDrawer({ order, drivers, open, onClose, onDispatch, isAr }: Props) {
  const supabase   = useMemo(() => createClient(), [])
  const driver     = order?.driver_id ? drivers.find(d => d.id === order.driver_id) : null
  const currentIdx = order ? STATUS_ORDER.indexOf(order.status) : -1
  const elapsedMin = order ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000) : 0
  const isLate     = elapsedMin > 45

  const [items,      setItems]      = useState<OrderItem[]>([])
  const [ctaLoading, setCtaLoading] = useState<'cancel' | 'confirm' | null>(null)

  // Fetch order items when order changes
  useEffect(() => {
    if (!order) { setItems([]); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;supabase
      .from('order_items')
      .select('id, name_ar, name_en, quantity, unit_price_bhd, item_total_bhd, selected_size, selected_variant')
      .eq('order_id', order.id)
      .order('created_at')
      .then(({ data }: { data: OrderItem[] | null }) => setItems(data ?? []))
  }, [order?.id, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel() {
    if (!order) return
    setCtaLoading('cancel')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', order.id)
    setCtaLoading(null)
    onClose()
  }

  async function handleConfirm() {
    if (!order) return
    setCtaLoading('confirm')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from('orders')
      .update({ status: 'delivered', updated_at: new Date().toISOString() })
      .eq('id', order.id)
    setCtaLoading(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && order && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(14,7,0,0.6)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Drawer — always from the RIGHT (physical right), RTL or not */}
          <motion.aside
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position:    'fixed',
              top:         0,
              bottom:      0,
              right:       0,
              width:       '420px',
              maxWidth:    '95vw',
              zIndex:      50,
              background:  DV.bgSurface,
              borderLeft:  `1px solid ${DV.border}`,
              display:     'flex',
              flexDirection: 'column',
              fontFamily:  'IBM Plex Sans Arabic, sans-serif',
              color:       DV.text,
            }}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* ── Header ── */}
            <div style={{
              padding:      '16px 20px',
              borderBottom: `1px solid ${DV.border}`,
              display:      'flex',
              alignItems:   'center',
              gap:          '10px',
              flexShrink:   0,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: DV.amber }}>
                    #{order.order_number}
                  </span>
                  <span style={{
                    fontSize:     '11px',
                    fontWeight:   600,
                    color:        STATUS_BORDER[order.status] ?? DV.amber,
                    background:   `${STATUS_BORDER[order.status] ?? DV.amber}18`,
                    padding:      '2px 8px',
                    borderRadius: '5px',
                    border:       `1px solid ${STATUS_BORDER[order.status] ?? DV.amber}40`,
                  }}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  {isLate && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: DV_STATUS.errorBg }}>
                      <AlertCircle size={11} /> متأخر {elapsedMin} د
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: DV.muted, marginTop: '2px' }}>
                  {formatDate(order.created_at)} · {formatTime(order.created_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', borderRadius: '8px',
                  background: DV.bgCard, border: `1px solid ${DV.border}`,
                  color: DV.muted, cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Content ── */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Customer */}
              <Section title="بيانات العميل">
                <InfoRow icon={<span style={{ fontSize: '14px' }}>👤</span>} label={order.customer_name ?? '—'} />
                {order.customer_phone && (
                  <InfoRow
                    icon={<Phone size={13} color={DV.muted} />}
                    label={
                      <a href={`tel:${order.customer_phone}`} style={{ color: DV.amberLight, textDecoration: 'none' }} dir="ltr">
                        {order.customer_phone}
                      </a>
                    }
                  />
                )}
                {order.customer_address && (
                  <InfoRow icon={<MapPin size={13} color={DV.muted} />} label={order.customer_address} />
                )}
                {order.notes && (
                  <div style={{
                    marginTop:    '8px',
                    padding:      '8px 12px',
                    background:   DV.bgCard,
                    border:       `1px solid ${DV.border}`,
                    borderRadius: '7px',
                    fontSize:     '12px',
                    color:        DV.text,
                  }}>
                    <span style={{ color: DV.amber, fontSize: '11px', fontWeight: 600 }}>ملاحظة: </span>
                    {order.notes}
                  </div>
                )}
              </Section>

              {/* Order items */}
              <Section title="الأصناف المطلوبة">
                {items.length === 0 ? (
                  <div style={{ fontSize: '12px', color: DV.muted, fontStyle: 'italic' }}>
                    {order.items_count} صنف — جاري التحميل…
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {items.map(item => (
                      <div key={item.id} style={{
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'space-between',
                        padding:      '8px 10px',
                        background:   DV.bgCard,
                        borderRadius: '7px',
                        border:       `1px solid ${DV.border}`,
                        gap:          '8px',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: DV.text }}>
                            {isAr ? item.name_ar : item.name_en}
                            {item.selected_size && (
                              <span style={{ fontSize: '11px', color: DV.muted, marginInlineStart: '5px' }}>
                                ({item.selected_size})
                              </span>
                            )}
                          </div>
                          {item.selected_variant && (
                            <div style={{ fontSize: '11px', color: DV.muted }}>{item.selected_variant}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'end', flexShrink: 0 }}>
                          <div style={{ fontSize: '12px', color: DV.muted }}>× {item.quantity}</div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: DV.amberLight }}>
                            {Number(item.item_total_bhd).toFixed(3)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{
                      display:        'flex',
                      justifyContent: 'space-between',
                      padding:        '8px 10px',
                      borderTop:      `1px solid ${DV.border}`,
                      marginTop:      '4px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: DV.muted }}>المجموع</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: DV.amberLight }}>
                        {Number(order.total_bhd).toFixed(3)} د.ب
                      </span>
                    </div>
                  </div>
                )}
              </Section>

              {/* Driver */}
              <Section title="السائق المعيّن">
                {driver ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: `${DV.amber}20`, border: `1px solid ${DV.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700, color: DV.amber,
                    }}>
                      {driver.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: DV.text }}>{driver.name}</div>
                      {driver.phone && (
                        <a href={`tel:${driver.phone}`} style={{ fontSize: '12px', color: DV.muted, textDecoration: 'none' }} dir="ltr">
                          {driver.phone}
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={onDispatch}
                      style={{
                        marginInlineStart: 'auto',
                        padding:      '5px 10px',
                        background:   `${DV.amber}18`,
                        border:       `1px solid ${DV.amber}40`,
                        borderRadius: '7px',
                        color:        DV.amber,
                        fontSize:     '11px',
                        fontWeight:   600,
                        cursor:       'pointer',
                        fontFamily:   'IBM Plex Sans Arabic, sans-serif',
                        display:      'flex',
                        alignItems:   'center',
                        gap:          '4px',
                      }}
                    >
                      <RefreshCw size={11} />
                      تغيير
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onDispatch}
                    style={{
                      width:        '100%',
                      padding:      '10px',
                      background:   DV.amber,
                      color:        DV.bgPage,
                      border:       'none',
                      borderRadius: '8px',
                      fontSize:     '13px',
                      fontWeight:   700,
                      cursor:       'pointer',
                      fontFamily:   'IBM Plex Sans Arabic, sans-serif',
                    }}
                  >
                    + تعيين سائق
                  </button>
                )}
              </Section>

              {/* Timeline */}
              <Section title="مسار الحالات">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
                  {TIMELINE_STEPS.map((step, i) => {
                    const done    = i <= currentIdx
                    const current = i === currentIdx
                    const color   = done ? DV.amber : DV.muted

                    return (
                      <div key={step.status} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                        {i < TIMELINE_STEPS.length - 1 && (
                          <div style={{
                            position:         'absolute',
                            top:              '26px',
                            insetInlineStart: '11px',
                            width:            '2px',
                            height:           '28px',
                            background:       done ? `${DV.amber}50` : `${DV.muted}30`,
                          }} />
                        )}
                        <div style={{
                          width:          '24px',
                          height:         '24px',
                          borderRadius:   '50%',
                          background:     done ? `${DV.amber}20` : `${DV.muted}15`,
                          border:         `2px solid ${color}`,
                          display:        'flex',
                          alignItems:     'center',
                          justifyContent: 'center',
                          color,
                          flexShrink:     0,
                          marginTop:      '2px',
                          transition:     'all 0.3s',
                        }}>
                          {step.icon}
                        </div>
                        <div style={{ paddingBottom: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: current ? 600 : 400, color: done ? DV.text : DV.muted }}>
                            {step.label}
                          </div>
                          {current && (
                            <div style={{ fontSize: '11px', color: DV.muted, marginTop: '1px' }}>
                              {formatTime(order.updated_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>

            {/* ── Footer CTAs ── */}
            <div style={{
              padding:      '14px 20px',
              borderTop:    `1px solid ${DV.border}`,
              display:      'flex',
              gap:          '8px',
              flexShrink:   0,
            }}>
              <button
                type="button"
                onClick={onDispatch}
                style={{
                  flex:         1,
                  padding:      '10px',
                  background:   `${DV.amber}15`,
                  border:       `1px solid ${DV.amber}40`,
                  borderRadius: '8px',
                  color:        DV.amber,
                  fontSize:     '13px',
                  fontWeight:   600,
                  cursor:       'pointer',
                  fontFamily:   'IBM Plex Sans Arabic, sans-serif',
                }}
              >
                تغيير السائق
              </button>
              <button
                type="button"
                disabled={ctaLoading === 'cancel'}
                onClick={handleCancel}
                style={{
                  flex:         1,
                  padding:      '10px',
                  background:   'rgba(139,32,32,0.15)',
                  border:       '1px solid rgba(139,32,32,0.4)',
                  borderRadius: '8px',
                  color:        ctaLoading === 'cancel' ? DV.muted : DV_STATUS.errorText,
                  fontSize:     '13px',
                  fontWeight:   600,
                  cursor:       ctaLoading === 'cancel' ? 'default' : 'pointer',
                  fontFamily:   'IBM Plex Sans Arabic, sans-serif',
                  transition:   'opacity 0.2s',
                }}
              >
                {ctaLoading === 'cancel' ? '…' : 'إلغاء التوصيل'}
              </button>
              <button
                type="button"
                disabled={ctaLoading === 'confirm'}
                onClick={handleConfirm}
                style={{
                  flex:         1,
                  padding:      '10px',
                  background:   ctaLoading === 'confirm' ? `${DV_STATUS.successBg}18` : 'rgba(45,122,79,0.2)',
                  border:       '1px solid rgba(45,122,79,0.5)',
                  borderRadius: '8px',
                  color:        DV_STATUS.successText,
                  fontSize:     '13px',
                  fontWeight:   600,
                  cursor:       ctaLoading === 'confirm' ? 'default' : 'pointer',
                  fontFamily:   'IBM Plex Sans Arabic, sans-serif',
                  transition:   'all 0.2s',
                }}
              >
                {ctaLoading === 'confirm' ? '…' : 'تأكيد التسليم'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize:      '11px',
        fontWeight:    600,
        color:         DV.muted,
        marginBottom:  '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function InfoRow({ icon, label }: { icon: React.ReactNode; label: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', color: DV.text }}>
      <span style={{ color: DV.muted, flexShrink: 0 }}>{icon}</span>
      {label}
    </div>
  )
}
