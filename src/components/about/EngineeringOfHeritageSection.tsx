'use client';

import { useState, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Info } from 'lucide-react';

interface EngineeringOfHeritageSectionProps {
  isRTL: boolean;
}

const HOTSPOTS = [
  { id: 'face', top: '35%', left: '50%' },
  { id: 'vessel', top: '65%', left: '50%' },
  { id: 'hands', top: '75%', left: '50%' },
  { id: 'ornament', top: '50%', left: '20%' },
  { id: 'frame', top: '10%', left: '50%' },
];

export function EngineeringOfHeritageSection({ isRTL }: EngineeringOfHeritageSectionProps) {
  const t = useTranslations('story.engineeringOfHeritage');
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const opacityFade = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const scaleUp = useTransform(scrollYProgress, [0, 0.2], [0.95, 1]);

  return (
    <section 
      ref={containerRef}
      className="relative w-full py-24 md:py-32 bg-[#0A0A0A] text-white overflow-hidden"
    >
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-[#1a1510] to-[#0A0A0A] opacity-50 pointer-events-none" />

      <motion.div 
        style={{ opacity: opacityFade, scale: scaleUp }}
        className="container mx-auto px-4 relative z-10"
      >
        {/* Intro */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <span className="block text-[#C8922A] tracking-widest uppercase text-sm mb-4 font-medium">
            {t('eyebrow')}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            {t('title')}
          </h2>
          <p className="text-xl text-gray-300 mb-6 leading-relaxed">
            {t('intro')}
          </p>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto">
            {t('paragraph')}
          </p>
        </div>

        {/* Blueprint Interactive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-32">
          {/* Left: Interactive Image */}
          <div className="relative w-full max-w-md mx-auto aspect-[3/4] group">
            {/* The Blueprint Image */}
            <Image
              src="/assets/brand/kahramana-baghdad-brand-heritage-emblem.webp"
              alt={t('altTexts.blueprint')}
              fill
              className="object-contain drop-shadow-[0_0_30px_rgba(200,146,42,0.15)]"
              priority
            />
            
            {/* Hotspots */}
            {HOTSPOTS.map((spot) => (
              <button
                key={spot.id}
                onClick={() => setActiveHotspot(spot.id)}
                className="absolute flex items-center justify-center w-10 h-10 -translate-x-1/2 -translate-y-1/2 group-hover:opacity-100 transition-opacity"
                style={{ top: spot.top, left: spot.left }}
                aria-label={t(`hotspots.${spot.id}.label`)}
              >
                <div className={`relative flex items-center justify-center w-6 h-6 rounded-full border-2 border-[#C8922A] bg-[#0A0A0A]/80 backdrop-blur-sm transition-all duration-300 ${activeHotspot === spot.id ? 'scale-125 bg-[#C8922A] text-[#0A0A0A]' : 'hover:scale-110 hover:bg-[#C8922A] hover:text-[#0A0A0A] text-[#C8922A]'}`}>
                  {activeHotspot === spot.id ? (
                    <motion.div layoutId="activePulse" className="absolute inset-0 rounded-full border border-[#C8922A] animate-ping opacity-50" />
                  ) : null}
                  <span className="sr-only">{t(`hotspots.${spot.id}.label`)}</span>
                  <div className={`w-2 h-2 rounded-full ${activeHotspot === spot.id ? 'bg-[#0A0A0A]' : 'bg-[#C8922A]'}`} />
                </div>
              </button>
            ))}
          </div>

          {/* Right: Active Info */}
          <div className="flex flex-col justify-center min-h-[250px]">
            <AnimatePresence mode="wait">
              {activeHotspot ? (
                <motion.div
                  key={activeHotspot}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-md"
                >
                  <h3 className="text-2xl font-bold text-[#C8922A] mb-4">
                    {t(`hotspots.${activeHotspot}.label`)}
                  </h3>
                  <p className="text-lg text-gray-300 leading-relaxed">
                    {t(`hotspots.${activeHotspot}.description`)}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/20 rounded-2xl h-full"
                >
                  <Info className="w-8 h-8 text-[#C8922A]/50 mb-4" />
                  <p className="text-gray-400">
                    {isRTL ? 'انقر على النقاط في المخطط الهندسي لاكتشاف التفاصيل' : 'Click on the points in the blueprint to discover details'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Concept to Table (Blueprint vs Reality) */}
        <div className="mb-32">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold mb-6 text-white">
              {t('conceptToTable.title')}
            </h3>
            <p className="text-lg text-gray-400 leading-relaxed mb-8">
              {t('conceptToTable.paragraph')}
            </p>
            <p className="text-xl text-[#C8922A] font-medium italic">
              &quot;{t('conceptToTable.shortStatement')}&quot;
            </p>
          </div>
          
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden group border border-white/10">
            {/* Reality Image (Base) */}
            <Image
              src="/assets/gallery/kahramana-mixed-grill.webp"
              alt={t('altTexts.reality')}
              fill
              className="object-cover transition-transform duration-1000 group-hover:scale-105"
            />
            
            {/* Overlay Gradient for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/80 via-transparent to-transparent z-10" />
            
            {/* Blueprint Overlay (Fades out on hover) */}
            <div className="absolute inset-0 bg-[#0A0A0A]/90 backdrop-blur-sm transition-all duration-700 group-hover:opacity-0 group-hover:backdrop-blur-none flex flex-col items-center justify-center z-20">
               <div className="relative w-64 h-64 md:w-96 md:h-96 opacity-60">
                 <Image
                    src="/assets/brand/kahramana-baghdad-brand-heritage-emblem.webp"
                    alt="Emblem"
                    fill
                    className="object-contain"
                 />
               </div>
               <span className="absolute bottom-8 text-[#C8922A] tracking-widest text-sm md:text-base uppercase">
                 {isRTL ? 'مرر لرؤية الواقع' : 'Hover to reveal reality'}
               </span>
            </div>
          </div>
        </div>

        {/* Closing Lamassu / Seal */}
        <div className="text-center max-w-2xl mx-auto flex flex-col items-center">
           <div className="w-16 h-16 border border-[#C8922A]/50 rounded-full flex items-center justify-center mb-6 relative overflow-hidden">
             <div className="w-8 h-8 bg-[#C8922A] rotate-45 opacity-20" />
           </div>
           <h4 className="text-2xl font-bold text-white mb-2">{t('closing.title')}</h4>
           <p className="text-lg text-[#C8922A] mb-8">{t('closing.line')}</p>
           
           <div className="mt-8 border-t border-white/10 pt-8">
             <span className="block text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
               {t('closing.lamassuLabel')}
             </span>
             <p className="text-sm text-gray-400">
               {t('closing.lamassuDescription')}
             </p>
           </div>
        </div>
      </motion.div>
    </section>
  );
}
