// Delivery page design tokens — source of truth for all hex values.
// Components import from here; no hex literals in component files.

export const DV = {
  bgPage:    '#0E0700',
  bgSurface: '#1C0F03',
  bgCard:    '#231508',
  amber:     '#C4933A',
  amberLight:'#E8B86D',
  text:      '#F5E6C8',
  muted:     '#8A7055',
  border:    'rgba(196,147,58,0.2)',
  borderHover: 'rgba(196,147,58,0.5)',
} as const

export const STATUS_BORDER: Record<string, string> = {
  accepted:         '#8B2020',
  new:              '#8B2020',
  preparing:        '#9B5E1A',
  ready:            '#2D7A4F',
  out_for_delivery: '#1D4E8B',
  delivered:        '#3A2E1A',
  completed:        '#3A2E1A',
}

export const STATUS_LABEL: Record<string, string> = {
  accepted:         'جديد',
  new:              'جديد',
  preparing:        'قيد التحضير',
  ready:            'جاهز',
  out_for_delivery: 'يُوصَّل',
  delivered:        'مكتمل',
  completed:        'مكتمل',
}

export const DRIVER_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  available: { bg: 'rgba(45,122,79,0.15)',  text: '#5CB88A', label: 'متاح'      },
  delivering:{ bg: 'rgba(29,78,139,0.2)',   text: '#6AAFF0', label: 'يُوصِّل'    },
  busy:      { bg: 'rgba(155,94,26,0.15)',  text: '#E8A855', label: 'مشغول'     },
  returning: { bg: 'rgba(109,42,135,0.2)',  text: '#BD7DE8', label: 'عائد'      },
  offline:   { bg: 'rgba(60,40,15,0.3)',    text: '#8A7055', label: 'غير متصل'  },
}

export const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry',                                    stylers: [{ color: '#1C0F03' }] },
  { elementType: 'labels.text.fill',                            stylers: [{ color: '#8A7055' }] },
  { elementType: 'labels.text.stroke',                          stylers: [{ color: '#0E0700' }] },
  { featureType: 'road',          elementType: 'geometry',      stylers: [{ color: '#2D1A08' }] },
  { featureType: 'road',          elementType: 'geometry.stroke',stylers:[{ color: '#1C0F03' }] },
  { featureType: 'road.highway',  elementType: 'geometry',      stylers: [{ color: '#3D2510' }] },
  { featureType: 'road.highway',  elementType: 'labels.text.fill', stylers:[{ color: '#C4933A' }] },
  { featureType: 'water',         elementType: 'geometry',      stylers: [{ color: '#0A0600' }] },
  { featureType: 'poi',           elementType: 'labels',        stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',       elementType: 'geometry',      stylers: [{ color: '#231508' }] },
  { featureType: 'administrative',elementType: 'geometry',      stylers: [{ color: '#3D2510' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers:[{ color: '#E8B86D' }] },
]

export const DV_STATUS = {
  errorBg:     '#8B2020',
  successBg:   '#2D7A4F',
  blueBg:      '#1D4E8B',
  successText: '#5CB88A',
  errorText:   '#E87070',
  blueText:    '#6AAFF0',
} as const

export const CSS_VARS = {
  '--dv-bg':      DV.bgPage,
  '--dv-surface': DV.bgSurface,
  '--dv-card':    DV.bgCard,
  '--dv-amber':   DV.amber,
  '--dv-amber-l': DV.amberLight,
  '--dv-text':    DV.text,
  '--dv-muted':   DV.muted,
  '--dv-border':  DV.border,
} as const
