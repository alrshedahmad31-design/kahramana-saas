'use client'

import { useState }          from 'react'
import { motion }            from 'framer-motion'
import { X, Check, MapPin }  from 'lucide-react'
import { createClient }      from '@/lib/supabase/client'
import { DV, DV_STATUS, DRIVER_STATUS } from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver } from '@/lib/delivery/types'

interface Props {
  order:   DeliveryOrder | null
  drivers: Driver[]
  orders:  DeliveryOrder[]
  onClose: () => void
  isAr:    boolean
}

export default function DispatchModal({ order, drivers, orders: _orders, onClose, isAr }: Props) {
  const supabase       = createClient()
  const [selected, setSelected] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  const available = drivers.filter(d => d.status === 'available' || d.status === 'returning')

  async function handleAssign() {
    if (!selected || !order) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('orders')
      .update({ assigned_driver_id: selected, status: 'out_for_delivery' })
      .eq('id', order.id)
    setLoading(false)
    setDone(true)
    setTimeout(onClose, 1000)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(14,7,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.2 }}
        dir={isAr ? 'rtl' : 'ltr'}
        style={{
          width:          '480px',
          maxWidth:       '100%',
          maxHeight:      '80vh',
          background:     DV.bgSurface,
          border:         `1px solid ${DV.border}`,
          borderRadius:   '12px',
          display:        'flex',
          flexDirection:  'column',
          fontFamily:     'IBM Plex Sans Arabic, sans-serif',
          color:          DV.text,
          overflow:       'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding:      '16px 20px',
          borderBottom: `1px solid ${DV.border}`,
          display:      'flex',
          alignItems:   'center',
          justifyContent:'space-between',
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: DV.text }}>
              تعيين سائق
            </div>
            {order && (
              <div style={{ fontSize: '12px', color: DV.muted, marginTop: '2px' }}>
                طلب #{order.order_number} · {order.customer_name ?? '—'}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px', height: '32px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', background: DV.bgCard,
              border: `1px solid ${DV.border}`, color: DV.muted, cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Driver list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          {available.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: DV.muted, fontSize: '14px' }}>
              لا يوجد سائقون متاحون
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {available.map((driver, i) => {
                const cfg      = DRIVER_STATUS[driver.status] ?? DRIVER_STATUS.offline
                const isSelect = selected === driver.id
                return (
                  <motion.button
                    key={driver.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelected(driver.id)}
                    style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          '12px',
                      padding:      '12px 14px',
                      background:   isSelect ? `${DV.amber}15` : DV.bgCard,
                      border:       `1px solid ${isSelect ? DV.amber : DV.border}`,
                      borderRadius: '9px',
                      cursor:       'pointer',
                      textAlign:    'start',
                      transition:   'all 0.15s',
                      fontFamily:   'IBM Plex Sans Arabic, sans-serif',
                      width:        '100%',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width:          '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                      background:     `${DV.amber}15`, border: `1px solid ${DV.border}`,
                      display:        'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize:       '14px', fontWeight: 700, color: DV.amber,
                    }}>
                      {driver.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: DV.text }}>
                        {driver.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '11px', color: cfg.text, background: cfg.bg,
                          padding: '1px 6px', borderRadius: '4px',
                        }}>
                          {cfg.label}
                        </span>
                        {driver.location && (
                          <span style={{ fontSize: '11px', color: DV.muted, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <MapPin size={10} /> موقع متاح
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: DV.muted, marginInlineStart: 'auto' }}>
                          {driver.completed_today} توصيلة
                        </span>
                      </div>
                    </div>

                    {isSelect && (
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: DV.amber, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Check size={14} color={DV.bgPage} />
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding:      '14px 20px',
          borderTop:    `1px solid ${DV.border}`,
          display:      'flex',
          gap:          '8px',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex:         1,
              padding:      '10px',
              background:   DV.bgCard,
              border:       `1px solid ${DV.border}`,
              borderRadius: '8px',
              color:        DV.muted,
              fontSize:     '13px',
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   'IBM Plex Sans Arabic, sans-serif',
            }}
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!selected || loading || done}
            onClick={handleAssign}
            style={{
              flex:         2,
              padding:      '10px',
              background:   done ? 'rgba(45,122,79,0.3)' : selected ? DV.amber : `${DV.amber}40`,
              border:       'none',
              borderRadius: '8px',
              color:        done ? DV_STATUS.successText : selected ? DV.bgPage : DV.muted,
              fontSize:     '13px',
              fontWeight:   700,
              cursor:       selected && !loading ? 'pointer' : 'default',
              fontFamily:   'IBM Plex Sans Arabic, sans-serif',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          '6px',
              transition:   'all 0.15s',
            }}
          >
            {done ? (
              <><Check size={15} /> تم التعيين</>
            ) : loading ? (
              'جاري...'
            ) : (
              'تأكيد التعيين'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
