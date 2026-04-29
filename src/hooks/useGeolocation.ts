import { useState, useEffect } from 'react'

export function useGeolocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        setError(error.message)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
    
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])
  
  return { location, error }
}
