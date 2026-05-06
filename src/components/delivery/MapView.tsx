'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { DV, DV_STATUS, DRIVER_STATUS, STATUS_BORDER } from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver } from '@/lib/delivery/types'

// Fix Leaflet marker icon issue in Next.js
const createMarkerIcon = (color: string, isHovered = false) => {
  const size = isHovered ? 24 : 18
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const DRIVER_ICON = (color: string) => L.divIcon({
  className: 'driver-div-icon',
  html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #0A0A0A; box-shadow: 0 0 10px ${color}80;"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

interface Props {
  orders:         DeliveryOrder[]
  drivers:        Driver[]
  hoveredOrderId: string | null
  onOrderClick:   (id: string) => void
  isAr:           boolean
}

const MAP_CENTER: [number, number] = [26.0667, 50.5577]

const DRIVER_STATUS_COLOR: Record<string, string> = {
  available:  DV_STATUS.successText,
  delivering: DV_STATUS.blueText,
  busy:       DV.amberLight,
  returning:  DRIVER_STATUS.returning.text,
  offline:    DV.muted,
}

// Helper to pan the map
function MapController({ hoveredOrderId, orders }: { hoveredOrderId: string | null, orders: DeliveryOrder[] }) {
  const map = useMap()
  
  useEffect(() => {
    if (!hoveredOrderId) return
    const order = orders.find(o => o.id === hoveredOrderId)
    if (order?.customer_location) {
      map.panTo([order.customer_location.lat, order.customer_location.lng])
    }
  }, [hoveredOrderId, orders, map])

  return null
}

export default function MapView({ orders, drivers, hoveredOrderId, onOrderClick, isAr }: Props) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div style={{ width: '100%', height: '100%', background: DV.bgCard }} />
    )
  }

  return (
    <div className="h-full w-full relative">
      <MapContainer 
        center={MAP_CENTER} 
        zoom={13} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />
        
        <MapController hoveredOrderId={hoveredOrderId} orders={orders} />

        {/* Driver markers */}
        {drivers.map(driver => {
          if (!driver.location) return null
          const color = DRIVER_STATUS_COLOR[driver.status] ?? DV.muted
          return (
            <Marker
              key={`driver-${driver.id}`}
              position={[driver.location.lat, driver.location.lng]}
              icon={DRIVER_ICON(color)}
            >
              <Popup>
                <div className={`text-xs ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  <strong>{driver.name}</strong><br />
                  {isAr ? 'الحالة: ' : 'Status: '}{driver.status}
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Order markers */}
        {orders.map(order => {
          if (!order.customer_location) return null
          const isHovered = order.id === hoveredOrderId
          const color     = STATUS_BORDER[order.status] ?? DV.amber
          return (
            <Marker
              key={`order-${order.id}`}
              position={[order.customer_location.lat, order.customer_location.lng]}
              icon={createMarkerIcon(color, isHovered)}
              eventHandlers={{
                click: () => onOrderClick(order.id),
              }}
            >
              <Popup>
                <div className={`text-xs ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  <strong>#{order.order_number}</strong><br />
                  {order.customer_name}<br />
                  <span style={{ color }}>{isAr ? 'الحالة: ' : 'Status: '}{order.status}</span>
                </div>
              </Popup>
            </Marker>
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
              positions={[
                [driver.location.lat, driver.location.lng],
                [order.customer_location.lat, order.customer_location.lng]
              ]}
              pathOptions={{
                color: DV.amberLight,
                weight: 2,
                dashArray: '5, 10',
                opacity: 0.6
              }}
            />
          )
        })}
      </MapContainer>

      {/* Map Legend/Controls */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
        <div className="bg-brand-surface border border-brand-border rounded-lg p-2 shadow-lg text-[10px] flex flex-col gap-1.5">
          {Object.entries(DRIVER_STATUS_COLOR).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="capitalize text-brand-muted">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
