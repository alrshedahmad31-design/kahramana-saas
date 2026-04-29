'use client'

import { useEffect, useRef, useCallback } from 'react'
import { LoadScript, GoogleMap, Marker, Polyline } from '@react-google-maps/api'
import { DV, DV_STATUS, MAP_STYLES, DRIVER_STATUS, STATUS_BORDER } from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver } from '@/lib/delivery/types'

interface Props {
  orders:         DeliveryOrder[]
  drivers:        Driver[]
  hoveredOrderId: string | null
  onOrderClick:   (id: string) => void
  isAr:           boolean
}

const MAP_CENTER  = { lat: 26.0667, lng: 50.5577 }
const MAP_STYLE   = { width: '100%', height: '100%' }
const MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl:      true,
  styles:           MAP_STYLES,
}

const DRIVER_STATUS_COLOR: Record<string, string> = {
  available:  DV_STATUS.successText,
  delivering: DV_STATUS.blueText,
  busy:       DV.amberLight,
  returning:  DRIVER_STATUS.returning.text,
  offline:    DV.muted,
}

export default function MapView({ orders, drivers, hoveredOrderId, onOrderClick, isAr: _isAr }: Props) {
  const mapRef = useRef<google.maps.Map | null>(null)

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
  }, [])

  // Pan to hovered order's location
  useEffect(() => {
    if (!hoveredOrderId || !mapRef.current) return
    const order = orders.find(o => o.id === hoveredOrderId)
    if (order?.customer_location) {
      mapRef.current.panTo(order.customer_location)
    }
  }, [hoveredOrderId, orders])

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

  if (!apiKey) {
    return (
      <div style={{
        width: '100%', height: '100%', background: DV.bgCard,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '12px', border: `1px solid ${DV.border}`,
      }}>
        <div style={{ fontSize: '32px' }}>🗺️</div>
        <div style={{ fontSize: '14px', color: DV.muted, textAlign: 'center', lineHeight: 1.6 }}>
          الخريطة غير متوفرة<br />
          <span style={{ fontSize: '12px' }}>أضف NEXT_PUBLIC_GOOGLE_MAPS_KEY</span>
        </div>
        {/* Show orders as text list in fallback */}
        <div style={{ marginTop: '16px', width: '80%', maxHeight: '200px', overflow: 'auto' }}>
          {orders.filter(o => o.customer_location).map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => onOrderClick(o.id)}
              style={{
                display:     'block', width: '100%', marginBottom: '4px',
                padding:     '6px 10px',
                background:  DV.bgSurface, border: `1px solid ${DV.border}`,
                borderRight: `3px solid ${STATUS_BORDER[o.status] ?? DV.amber}`,
                borderRadius:'6px', color: DV.text, fontSize: '12px', cursor: 'pointer',
                textAlign:   'start', fontFamily: 'IBM Plex Sans Arabic, sans-serif',
              }}
            >
              #{o.order_number} — {o.customer_name ?? '—'}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <LoadScript googleMapsApiKey={apiKey}>
      <GoogleMap
        mapContainerStyle={MAP_STYLE}
        center={MAP_CENTER}
        zoom={13}
        options={MAP_OPTIONS}
        onLoad={onLoad}
      >
        {/* Driver markers */}
        {drivers.map(driver => {
          if (!driver.location || typeof window === 'undefined' || !window.google) return null
          const color = DRIVER_STATUS_COLOR[driver.status] ?? DV.muted
          return (
            <Marker
              key={`driver-${driver.id}`}
              position={driver.location}
              icon={{
                path:          window.google.maps.SymbolPath.CIRCLE,
                scale:         10,
                fillColor:     color,
                fillOpacity:   1,
                strokeColor:   DV.bgPage,
                strokeWeight:  2.5,
              }}
              title={driver.name}
            />
          )
        })}

        {/* Order markers */}
        {orders.map(order => {
          if (!order.customer_location || typeof window === 'undefined' || !window.google) return null
          const isHovered = order.id === hoveredOrderId
          const color     = STATUS_BORDER[order.status] ?? DV.amber
          return (
            <Marker
              key={`order-${order.id}`}
              position={order.customer_location}
              onClick={() => onOrderClick(order.id)}
              icon={{
                path:          window.google.maps.SymbolPath.CIRCLE,
                scale:         isHovered ? 14 : 10,
                fillColor:     color,
                fillOpacity:   isHovered ? 1 : 0.85,
                strokeColor:   DV.text,
                strokeWeight:  isHovered ? 3 : 1.5,
              }}
              title={`#${order.order_number}`}
            />
          )
        })}

        {/* Route lines from driver to order */}
        {drivers.map(driver => {
          if (!driver.location || !driver.current_order_id) return null
          const order = orders.find(o => o.id === driver.current_order_id)
          if (!order?.customer_location) return null
          return (
            <Polyline
              key={`route-${driver.id}`}
              path={[driver.location, order.customer_location]}
              options={{
                strokeColor:   DV.amberLight,
                strokeOpacity: 0.6,
                strokeWeight:  2,
                icons: [{
                  icon:   { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                  offset: '0',
                  repeat: '16px',
                }],
              }}
            />
          )
        })}
      </GoogleMap>
    </LoadScript>
  )
}
