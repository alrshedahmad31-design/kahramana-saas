'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { createClient } from '@/lib/supabase/client'
import { tokens } from '@/lib/design-tokens'

// Fix Leaflet marker icon issue
const createMarkerIcon = (color: string) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const DRIVER_ICON = L.divIcon({
  className: 'driver-div-icon',
  html: `<div style="background-color: ${tokens.color.gold}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid ${tokens.color.black}; display: flex; items-center; justify-center; box-shadow: 0 0 15px rgba(200, 146, 42, 0.6);">
    <span style="font-size: 14px;">🛵</span>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function MapController({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, 15)
  }, [center, map])
  return null
}

interface Props {
  orderId: string
  customerLocation: { lat: number; lng: number } | null
  isAr: boolean
}

export default function OrderDriverMap({ orderId, customerLocation, isAr }: Props) {
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setIsMounted(true)

    // Initial fetch via ownership-verified RPC (C-6 IDOR fix)
    const fetchLoc = async () => {
      const { data } = await supabase.rpc('rpc_get_driver_location', { p_order_id: orderId })
      const row = Array.isArray(data) ? data[0] : data
      if (row?.lat && row?.lng) setDriverLoc({ lat: Number(row.lat), lng: Number(row.lng) })
    }
    fetchLoc()

    // Realtime subscription
    const channel = supabase
      .channel(`order-driver-loc-${orderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `order_id=eq.${orderId}` },
        (payload) => {
          const newData = payload.new as { lat: number; lng: number }
          if (newData.lat && newData.lng) {
            setDriverLoc({ lat: Number(newData.lat), lng: Number(newData.lng) })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId, supabase])

  if (!isMounted || (!driverLoc && !customerLocation)) return null

  const center: [number, number] = driverLoc 
    ? [driverLoc.lat, driverLoc.lng] 
    : customerLocation 
      ? [customerLocation.lat, customerLocation.lng] 
      : [26.0667, 50.5577]

  return (
    <div className="w-full h-64 rounded-xl overflow-hidden border border-brand-border relative mt-4">
      <MapContainer 
        center={center} 
        zoom={15} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles grayscale contrast-125 brightness-75"
        />
        <MapController center={center} />

        {customerLocation && (
          <Marker 
            position={[customerLocation.lat, customerLocation.lng]} 
            icon={createMarkerIcon(tokens.color.error)}
          />
        )}

        {driverLoc && (
          <Marker 
            position={[driverLoc.lat, driverLoc.lng]} 
            icon={DRIVER_ICON}
          />
        )}
      </MapContainer>
      
      <div className="absolute top-3 right-3 z-[1000] bg-brand-black/80 backdrop-blur-md border border-brand-border px-3 py-1.5 rounded-lg">
        <p className={`text-[10px] font-bold text-brand-gold uppercase tracking-widest ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'تتبع مباشر' : 'Live Tracking'}
        </p>
      </div>
    </div>
  )
}
