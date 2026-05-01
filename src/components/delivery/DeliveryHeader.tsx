'use client'

import { useState }                       from 'react'
import { Map, List, LayoutGrid, UserPlus, ChevronDown } from 'lucide-react'
import { DV }                             from '@/lib/delivery/tokens'
import type { ViewMode }                  from '@/lib/delivery/types'

interface Props {
  view:          ViewMode
  onViewChange:  (v: ViewMode) => void
  onAssign:      () => void
  isMuted:       boolean
  onToggleMute:  () => void
  isAr:          boolean
}

const VIEW_BTNS: { id: ViewMode; icon: React.ReactNode; labelAr: string; labelEn: string }[] = [
  { id: 'kanban', icon: <LayoutGrid size={15} />, labelAr: 'كانبان', labelEn: 'Kanban' },
  { id: 'map',    icon: <Map size={15} />,        labelAr: 'خريطة',  labelEn: 'Map'    },
  { id: 'list',   icon: <List size={15} />,       labelAr: 'قائمة',  labelEn: 'List'   },
]

const FILTER_OPTIONS = {
  period:  ['اليوم', 'الأمس', 'آخر ٧ أيام'],
  branch:  ['كل الفروع', 'الرفاع', 'قلالي'],
  driver:  ['كل السائقين'],
  status:  ['كل الحالات', 'جديد', 'قيد التحضير', 'جاهز', 'يُوصَّل', 'مكتمل'],
}

function FilterDropdown({ label: _label, options }: { label: string; options: string[] }) {
  const [open, setOpen] = useState(false)
  const [sel,  setSel]  = useState(options[0])

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '6px',
          padding:      '6px 12px',
          background:   DV.bgCard,
          border:       `1px solid ${DV.border}`,
          borderRadius: '8px',
          color:        DV.text,
          fontSize:     '13px',
          fontWeight:   400,
          cursor:       'pointer',
          whiteSpace:   'nowrap',
          fontFamily:   'IBM Plex Sans Arabic, sans-serif',
        }}
      >
        {sel}
        <ChevronDown size={13} color={DV.muted} />
      </button>
      {open && (
        <div style={{
          position:   'absolute',
          top:        'calc(100% + 4px)',
          insetInlineStart: 0,
          zIndex:     50,
          background: DV.bgSurface,
          border:     `1px solid ${DV.border}`,
          borderRadius:'8px',
          minWidth:   '140px',
          overflow:   'hidden',
          boxShadow:  '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { setSel(o); setOpen(false) }}
              style={{
                display:    'block',
                width:      '100%',
                padding:    '9px 14px',
                background: o === sel ? `${DV.amber}18` : 'transparent',
                color:      o === sel ? DV.amber : DV.text,
                fontSize:   '13px',
                fontWeight: o === sel ? 600 : 400,
                textAlign:  'start',
                cursor:     'pointer',
                border:     'none',
                fontFamily: 'IBM Plex Sans Arabic, sans-serif',
                transition: 'background 0.15s',
              }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DeliveryHeader({ view, onViewChange, onAssign, isMuted, onToggleMute, isAr }: Props) {
  return (
    <header style={{
      padding:        '12px 20px',
      background:     DV.bgSurface,
      borderBottom:   `1px solid ${DV.border}`,
      display:        'flex',
      alignItems:     'center',
      gap:            '12px',
      flexWrap:       'wrap',
    }}>
      {/* Title */}
      <h1 style={{
        fontSize:        '18px',
        fontWeight:      700,
        color:           DV.text,
        marginInlineEnd: 'auto',
        whiteSpace:      'nowrap',
      }}>
        {isAr ? 'لوحة التوصيل' : 'Delivery Board'}
      </h1>

      {/* View toggle */}
      <div style={{
        display:      'flex',
        background:   DV.bgCard,
        border:       `1px solid ${DV.border}`,
        borderRadius: '10px',
        padding:      '3px',
        gap:          '2px',
      }}>
        {VIEW_BTNS.map(btn => (
          <button
            key={btn.id}
            type="button"
            onClick={() => onViewChange(btn.id)}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '5px',
              padding:      '5px 12px',
              borderRadius: '7px',
              fontSize:     '12px',
              fontWeight:   600,
              cursor:       'pointer',
              border:       'none',
              fontFamily:   'IBM Plex Sans Arabic, sans-serif',
              transition:   'all 0.15s',
              background:   view === btn.id ? DV.amber : 'transparent',
              color:        view === btn.id ? DV.bgPage : DV.muted,
            }}
          >
            {btn.icon}
            {isAr ? btn.labelAr : btn.labelEn}
          </button>
        ))}
      </div>

      {/* Filters (period/branch stay Arabic — these are local context labels) */}
      <FilterDropdown label="اليوم"       options={FILTER_OPTIONS.period} />
      <FilterDropdown label="كل الفروع"   options={FILTER_OPTIONS.branch} />
      <FilterDropdown label="كل السائقين" options={FILTER_OPTIONS.driver} />
      <FilterDropdown label="كل الحالات"  options={FILTER_OPTIONS.status} />

      {/* Mute toggle */}
      <button
        type="button"
        onClick={onToggleMute}
        title={isMuted ? (isAr ? 'تشغيل الصوت' : 'Unmute') : (isAr ? 'كتم الصوت' : 'Mute')}
        style={{
          width:        '34px',
          height:       '34px',
          display:      'flex',
          alignItems:   'center',
          justifyContent:'center',
          background:   isMuted ? DV.bgCard : `${DV.amber}15`,
          border:       `1px solid ${isMuted ? DV.border : `${DV.amber}40`}`,
          borderRadius: '8px',
          color:        isMuted ? DV.muted : DV.amber,
          cursor:       'pointer',
          flexShrink:   0,
          transition:   'all 0.15s',
        }}
      >
        {isMuted ? <MuteOnSvg /> : <MuteOffSvg />}
      </button>

      {/* Assign button */}
      <button
        type="button"
        onClick={onAssign}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          '6px',
          padding:      '7px 16px',
          background:   DV.amber,
          color:        DV.bgPage,
          border:       'none',
          borderRadius: '8px',
          fontSize:     '13px',
          fontWeight:   700,
          cursor:       'pointer',
          fontFamily:   'IBM Plex Sans Arabic, sans-serif',
          whiteSpace:   'nowrap',
          transition:   'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = DV.amberLight }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = DV.amber }}
      >
        <UserPlus size={15} />
        {isAr ? 'تعيين سائق' : 'Assign Driver'}
      </button>
    </header>
  )
}

function MuteOffSvg() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6l-4 4H5v4h3l4 4V6zM18.364 5.636a9 9 0 010 12.728" />
    </svg>
  )
}

function MuteOnSvg() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l-4-4m0 4l4-4" />
    </svg>
  )
}
