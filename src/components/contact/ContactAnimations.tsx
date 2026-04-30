'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function ContactAnimations() {
  const isInitialized = useRef(false)
  
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true
    
    gsap.from('.contact-main-content', {
      x: -50,
      opacity: 0,
      duration: 1.2,
      ease: 'power4.out',
      delay: 0.5
    })
    
    gsap.from('.contact-sidebar > div', {
      x: 50,
      opacity: 0,
      duration: 1.2,
      stagger: 0.2,
      ease: 'power4.out',
      delay: 0.7
    })
  }, [])

  return null
}
