'use client'
import { SIZE_LABELS } from '@/lib/cart'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations }                from 'next-intl'
import { motion, AnimatePresence }        from 'framer-motion'
import { X, Phone, MapPin, Bike, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { createClient }                   from '@/lib/supabase/client'
import { cancelDeliveryOrder, confirmDelivery } from '@/app/[locale]/dashboard/delivery/actions'
import { DV, DV_STATUS, STATUS_BORDER } from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver, OrderItem } from '@/lib/delivery/types'
import { Icon } from '@/components/ui/Icon'

interface Props {
  order:      DeliveryOrder | null
  drivers:    Driver[]
  open:       boolean
  onClose:    () => void
  onDispatch: () => void
  isAr:       boolean
}

const TIMELINE_STEPS: { status: 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered'; icon: React.ReactNode }[] = [
  { status: 'accepted',         icon: <CheckCircle size={14} /> },
  { status: 'preparing',        icon: <Clock size={14} />       },
  { status: 'ready',            icon: <CheckCircle size={14} /> },
  { status: 'out_for_delivery', icon: <Bike size={14} />        },
  { status: 'delivered',        icon: <CheckCircle size={14} /> },
]

const STATUS_ORDER = ['accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered']

const KNOWN_ORDER_STATUSES = ['accepted','new','preparing','ready','out_for_delivery','delivered','completed'] as const
function isKnownOrderStatus(s: string): s is typeof KNOWN_ORDER_STATUSES[number] {
  return (KNOWN_ORDER_STATUSES as readonly string[]).includes(s)
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-BH' : 'en-BH', { hour: '2-digit', minute: '2-digit' })
}
function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-BH' : 'en-BH', { day: 'numeric', month: 'short' })
}

export default function OrderDetailDrawer({ order, drivers, open, onClose, onDispatch, isAr }: Props) {
  const t          = useTranslations('delivery')
  const locale     = isAr ? 'ar' : 'en'
  const supabase   = useMemo(() => createClient(), [])
  const driver     = order?.driver_id ? drivers.find(d => d.id === order.driver_id) : null
  const currentIdx = order ? STATUS_ORDER.indexOf(order.status) : -1
  const elapsedMin = order ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000) : 0
  const isLate     = elapsedMin > 45

  const [items,      setItems]      = useState<OrderItem[]>([])
  const [ctaLoading, setCtaLoading] = useState<'cancel' | 'confirm' | null>(null)
  const [ctaError,   setCtaError]   = useState<string | null>(null)

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
    setCtaError(null)
    const res = await cancelDeliveryOrder(order.id)
    setCtaLoading(null)
    if (!res.success) { setCtaError(res.error); return }
    onClose()
  }

  async function handleConfirm() {
    if (!order) return
    setCtaLoading('confirm')
    setCtaError(null)
    const res = await confirmDelivery(order.id)
    setCtaLoading(null)
    if (!res.success) { setCtaError(res.error); return }
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
                    {isKnownOrderStatus(order.status) ? t(`status.${order.status}`) : order.status}
                  </span>
                  {isLate && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: DV_STATUS.errorBg }}>
                      <AlertCircle size={11} /> {t('late')} {elapsedMin} {t('minutesShort')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: DV.muted, marginTop: '2px' }}>
                  {formatDate(order.created_at, locale)} · {formatTime(order.created_at, locale)}
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
              <Section title={t('drawer.customerSection')}>
                <InfoRow icon={<Icon name="user" size={14} style={{ color: DV.muted }} />} label={order.customer_name ?? '—'} />
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
                {order.customer_address && (() => {
                  const embeddedUrl = order.customer_address.match(/https?:\/\/[^\s]+/)?.[0] ?? null
                  const addrText    = embeddedUrl
                    ? order.customer_address.replace(embeddedUrl, '').trim()
                    : order.customer_address

                  // Build maps URL: coords first, then embedded URL, then text search, then hide
                  const mapsHref = order.customer_location
                    ? `https://www.google.com/maps?q=${order.customer_location.lat},${order.customer_location.lng}`
                    : embeddedUrl
                      ?? (addrText
                          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrText + ', Bahrain')}`
                          : null)

                  return (
                    <InfoRow
                      icon={
                        mapsHref ? (
                          <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ color: DV.muted, display: 'flex' }}>
                            <MapPin size={13} color={DV.amberLight} />
                          </a>
                        ) : (
                          <MapPin size={13} color={DV.muted} />
                        )
                      }
                      label={
                        mapsHref ? (
                          <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ color: DV.amberLight, textDecoration: 'none' }}>
                            {addrText || order.customer_address}
                          </a>
                        ) : (addrText || order.customer_address)
                      }
                    />
                  )
                })()}
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
                    <span style={{ color: DV.amber, fontSize: '11px', fontWeight: 600 }}>{t('drawer.noteLabel')} </span>
                    {order.notes}
                  </div>
                )}
              </Section>

              {/* Order items */}
              <Section title={t('drawer.itemsSection')}>
                {items.length === 0 ? (
                  <div style={{ fontSize: '12px', color: DV.muted, fontStyle: 'italic' }}>
                    {t('itemsCount', { count: order.items_count })} — {t('drawer.loadingItems')}
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
                                ({SIZE_LABELS[item.selected_size]?.ar ?? item.selected_size})
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
                      <span style={{ fontSize: '13px', fontWeight: 600, color: DV.muted }}>{t('drawer.total')}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: DV.amberLight }}>
                        {Number(order.total_bhd).toFixed(3)} {t('drawer.currency')}
                      </span>
                    </div>
                  </div>
                )}
              </Section>

              {/* Driver */}
              <Section title={t('drawer.driverSection')}>
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
                      {t('drawer.change')}
                    </button>
                  </div>
                ) : order.status === 'ready' ? (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(45,122,79,0.12)',
                    border: `1px dashed ${DV_STATUS.successBg}`,
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: DV_STATUS.successText, marginBottom: '4px' }}>
                      {t('drawer.inPickupPool')}
                    </p>
                    <p style={{ fontSize: '11px', color: DV.muted }}>
                      {t('drawer.driverWillClaim')}
                    </p>
                    <button
                      type="button"
                      onClick={onDispatch}
                      style={{
                        marginTop: '8px',
                        fontSize: '11px',
                        color: DV.amber,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {t('drawer.assignManually')}
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
                    {t('drawer.assignDriverBtn')}
                  </button>
                )}
              </Section>

              {/* Timeline */}
              <Section title={t('drawer.timelineSection')}>
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
                            {t(`timeline.${step.status}`)}
                          </div>
                          {current && (
                            <div style={{ fontSize: '11px', color: DV.muted, marginTop: '1px' }}>
                              {formatTime(order.updated_at, locale)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>

            {/* ── CTA Error ── */}
            {ctaError && (
              <div style={{
                margin:       '0 20px',
                padding:      '8px 12px',
                background:   'rgba(139,32,32,0.15)',
                border:       '1px solid rgba(139,32,32,0.4)',
                borderRadius: '7px',
                fontSize:     '12px',
                color:        DV_STATUS.errorText,
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'space-between',
                gap:          '8px',
              }}>
                <span>{ctaError}</span>
                <button type="button" onClick={() => setCtaError(null)}
                  style={{ background: 'none', border: 'none', color: DV_STATUS.errorText, cursor: 'pointer', padding: 0 }}>
                  ×
                </button>
              </div>
            )}

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
                {t('drawer.changeDriverBtn')}
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
                {ctaLoading === 'cancel' ? '…' : t('drawer.cancelDelivery')}
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
                {ctaLoading === 'confirm' ? '…' : t('drawer.confirmDelivery')}
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
