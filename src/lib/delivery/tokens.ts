import { tokens } from '@/lib/design-tokens'

const deliveryTokens = tokens.delivery

export const STATUS_BORDER: Record<string, string> = {
  ...deliveryTokens.statusBorder,
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
  available: { ...deliveryTokens.driverStatus.available, label: 'متاح' },
  delivering: { ...deliveryTokens.driverStatus.delivering, label: 'يُوصِّل' },
  busy: { ...deliveryTokens.driverStatus.busy, label: 'مشغول' },
  returning: { ...deliveryTokens.driverStatus.returning, label: 'عائد' },
  offline: { ...deliveryTokens.driverStatus.offline, label: 'غير متصل' },
}

export const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: deliveryTokens.map.geometry }] },
  { elementType: 'labels.text.fill', stylers: [{ color: deliveryTokens.map.labelFill }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: deliveryTokens.map.labelStroke }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: deliveryTokens.map.roadGeometry }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: deliveryTokens.map.geometry }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: deliveryTokens.map.roadHighway }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: deliveryTokens.base.amber }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: deliveryTokens.map.water }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: deliveryTokens.map.transit }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: deliveryTokens.map.adminGeometry }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: deliveryTokens.map.adminLocalityFill }] },
]

export const DV = deliveryTokens.base
export const DV_STATUS = deliveryTokens.status

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
