'use client'

import { useState }                       from 'react'
import { useTranslations }                from 'next-intl'
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

export default function DeliveryHeader({ view, onViewChange, onAssign, isMuted, onToggleMute, isAr: _isAr }: Props) {
  const t = useTranslations('delivery')

  const VIEW_BTNS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'kanban', icon: <LayoutGrid size={15} />, label: t('header.viewKanban') },
    { id: 'map',    icon: <Map size={15} />,        label: t('header.viewMap')    },
    { id: 'list',   icon: <List size={15} />,       label: t('header.viewList')   },
  ]

  const FILTER_OPTIONS = {
    period:  [t('header.filterPeriodToday'), t('header.filterPeriodYesterday'), t('header.filterPeriod7d')],
    branch:  [t('header.filterAllBranches'), t('header.branchRiffa'), t('header.branchQallali')],
    driver:  [t('header.filterAllDrivers')],
    status:  [t('header.filterAllStatuses'), t('status.new'), t('status.preparing'), t('status.ready'), t('status.out_for_delivery'), t('status.completed')],
  }

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
        {t('boardTitle')}
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
      <FilterDropdown label={t('header.filterPeriodToday')} options={FILTER_OPTIONS.period} />
      <FilterDropdown label={t('header.filterAllBranches')} options={FILTER_OPTIONS.branch} />
      <FilterDropdown label={t('header.filterAllDrivers')}  options={FILTER_OPTIONS.driver} />
      <FilterDropdown label={t('header.filterAllStatuses')} options={FILTER_OPTIONS.status} />

      {/* Dispatch button */}
      <button
        type="button"
        onClick={onAssign}
        title={t('header.assignDriver')}
        style={{
          height:       '34px',
          display:      'flex',
          alignItems:   'center',
          gap:          '8px',
          padding:      '0 12px',
          background:   DV.bgCard,
          border:       `1px solid ${DV.border}`,
          borderRadius: '8px',
          color:        DV.amber,
          cursor:       'pointer',
          flexShrink:   0,
          fontSize:     '13px',
          fontWeight:   600,
          fontFamily:   'IBM Plex Sans Arabic, sans-serif',
          transition:   'all 0.15s',
        }}
      >
        <UserPlus size={16} />
        {t('header.assign')}
      </button>

      {/* Mute toggle */}
      <button
        type="button"
        onClick={onToggleMute}
        title={isMuted ? t('header.unmute') : t('header.mute')}
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
