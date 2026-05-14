'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet's default icon paths broken by webpack/Next.js bundling
const fixLeafletIcons = () => {
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// Bahrain center (roughly geographic center of the island)
const BAHRAIN_CENTER: [number, number] = [26.0667, 50.5577]
const DEFAULT_ZOOM = 13

interface Props {
  isAr:        boolean
  initialLat?: number | null
  initialLng?: number | null
  onConfirm:   (lat: number, lng: number) => void
  onCancel:    () => void
}

// Inner component: listens to map clicks and syncs marker position
function MapClickHandler({
  onMove,
}: {
  onMove: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function DeliveryMapPicker({
  isAr,
  initialLat,
  initialLng,
  onConfirm,
  onCancel,
}: Props) {
  const [iconsFixed, setIconsFixed] = useState(false)
  const [position, setPosition] = useState<[number, number]>(
    initialLat != null && initialLng != null
      ? [initialLat, initialLng]
      : BAHRAIN_CENTER,
  )
  const [isPinSet, setIsPinSet] = useState(
    initialLat != null && initialLng != null,
  )
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    fixLeafletIcons()
    setIconsFixed(true)
  }, [])

  const handleMove = useCallback((lat: number, lng: number) => {
    setPosition([lat, lng])
    setIsPinSet(true)
  }, [])

  const handleMarkerDrag = useCallback(() => {
    const marker = markerRef.current
    if (!marker) return
    const { lat, lng } = marker.getLatLng()
    setPosition([lat, lng])
    setIsPinSet(true)
  }, [])

  const handleConfirm = () => {
    if (!isPinSet) return
    onConfirm(position[0], position[1])
  }

  const dir = isAr ? 'rtl' : 'ltr'

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="relative w-full max-w-2xl mx-4 rounded-xl border border-brand-border bg-brand-surface shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        dir={dir}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border shrink-0">
          <div>
            <h2 className={`text-base font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
              {isAr ? 'تحديد موقع التوصيل' : 'Pin Delivery Location'}
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              {isAr
                ? 'انقر على الخريطة أو اسحب الدبوس لتحديد الموقع بدقة'
                : 'Click the map or drag the pin to set the exact location'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-muted hover:text-brand-text hover:bg-brand-surface-2 transition-colors"
            aria-label="Close"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map */}
        <div className="relative flex-1" style={{ minHeight: 380 }}>
          {iconsFixed && (
            <MapContainer
              center={position}
              zoom={DEFAULT_ZOOM}
              style={{ width: '100%', height: '100%', minHeight: 380 }}
              zoomControl
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler onMove={handleMove} />
              {isPinSet && (
                <Marker
                  position={position}
                  draggable
                  ref={markerRef}
                  eventHandlers={{ dragend: handleMarkerDrag }}
                />
              )}
            </MapContainer>
          )}

          {/* Instruction overlay when no pin yet */}
          {!isPinSet && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
              <div className="bg-brand-black/80 backdrop-blur-sm rounded-xl px-5 py-3 text-center border border-brand-border">
                <p className={`text-sm text-brand-gold font-bold ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {isAr ? '👆 انقر على الخريطة' : '👆 Tap the map to drop a pin'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-brand-border bg-brand-surface shrink-0 flex flex-col gap-3">
          {/* Coordinates display */}
          {isPinSet && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-surface-2 border border-brand-border px-3 py-2">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-gold shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-satoshi text-xs text-brand-muted tabular-nums">
                {position[0].toFixed(6)}, {position[1].toFixed(6)}
              </span>
              <button
                type="button"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps?q=${position[0]},${position[1]}`,
                    '_blank',
                  )
                }}
                className="ms-auto text-xs text-brand-gold hover:underline font-satoshi"
              >
                {isAr ? 'معاينة' : 'Preview'}
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 min-h-[44px] rounded-lg border border-brand-border bg-brand-surface-2 text-brand-text font-satoshi text-sm font-medium hover:border-brand-gold/30 transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={!isPinSet}
              onClick={handleConfirm}
              className="flex-1 min-h-[44px] rounded-lg bg-brand-gold text-brand-black font-satoshi text-sm font-bold hover:bg-brand-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAr ? 'تأكيد الموقع' : 'Confirm Location'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
