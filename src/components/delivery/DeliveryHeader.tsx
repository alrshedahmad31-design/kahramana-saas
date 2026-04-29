'use client'

import { useState }                       from 'react'
import { Map, List, LayoutGrid, UserPlus, ChevronDown } from 'lucide-react'
import { DV }                             from '@/lib/delivery/tokens'
import type { ViewMode }                  from '@/lib/delivery/types'

interface Props {
  view:         ViewMode
  onViewChange: (v: ViewMode) => void
  onAssign:     () => void
  isAr:         boolean
}

const VIEW_BTNS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: 'map',    icon: <Map size={15} />,        label: 'خريطة'  },
  { id: 'list',   icon: <List size={15} />,       label: 'قائمة'  },
  { id: 'kanban', icon: <LayoutGrid size={15} />, label: 'كانبان' },
]

const FILTER_OPTIONS = {
  period:  ['اليوم', 'الأمس', 'آخر ٧ أيام'],
  branch:  ['كل الفروع', 'الرفاع', 'قلالي'],
  driver:  ['كل السائقين'],
  status:  ['كل الحالات', 'جديد', 'قيد التحضير', 'جاهز', 'يُوصَّل', 'مكتمل'],
}

function FilterDropdown({ label, options }: { label: string; options: string[] }) {
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

export default function DeliveryHeader({ view, onViewChange, onAssign, isAr: _isAr }: Props) {
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
        fontSize:   '20px',
        fontWeight: 700,
        color:      DV.text,
        marginInlineEnd: 'auto',
        whiteSpace: 'nowrap',
      }}>
        التوصيل
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
            {btn.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <FilterDropdown label="اليوم"         options={FILTER_OPTIONS.period} />
      <FilterDropdown label="كل الفروع"     options={FILTER_OPTIONS.branch} />
      <FilterDropdown label="كل السائقين"   options={FILTER_OPTIONS.driver} />
      <FilterDropdown label="كل الحالات"    options={FILTER_OPTIONS.status} />

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
        تعيين سائق
      </button>
    </header>
  )
}
