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
  { id: 'face', top: '42%', left: '71.5%' },
  { id: 'vessel', top: '58%', left: '71.5%' },
  { id: 'hands', top: '75%', left: '73%' },
  { id: 'ornament', top: '45%', left: '65%' },
  { id: 'frame', top: '32%', left: '73%' },
];

export function EngineeringOfHeritageSection({ isRTL }: EngineeringOfHeritageSectionProps) {
  const t = useTranslations('story.engineeringOfHeritage');
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const opacityFade = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
  const scaleUp = useTransform(scrollYProgress, [0, 0.15], [0.98, 1]);

  return (
    <section 
      ref={containerRef}
      className="relative w-full py-24 md:py-32 bg-[#0A0A0A] text-white overflow-hidden"
    >
      {/* Background Deep Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-[#15120e] to-[#0A0A0A] opacity-60 pointer-events-none" />

      <motion.div 
        style={{ opacity: opacityFade, scale: scaleUp }}
        className="w-full relative z-10"
      >
        {/* Header Section */}
        <div className="max-w-4xl mx-auto text-center px-4 mb-16 md:mb-24">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="section-subtitle !mb-6 block"
          >
            {t('eyebrow')}
          </motion.span>
          <h2 className="section-title !text-5xl md:!text-7xl tracking-tight">
            {t('title')}
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed font-light">
            {t('intro')}
          </p>
          <div className="w-32 h-px bg-[#C8922A]/40 mx-auto mb-8" />
          <p className="text-lg text-gray-400 leading-relaxed max-w-3xl mx-auto">
            {t('paragraph')}
          </p>
        </div>

        {/* Blueprint - Maximum Scale Interaction */}
        <div className="flex flex-col items-center mb-40 px-4 md:px-8">
          <div className="relative w-full max-w-[1600px] aspect-[16/9] md:aspect-[21/9] group mb-12 bg-black/40 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <Image
              src="/assets/brand/kahramana-baghdad-brand-heritage-emblem.webp"
              alt={t('altTexts.blueprint')}
              fill
              className="object-contain p-4 md:p-12 drop-shadow-[0_0_60px_rgba(200,146,42,0.15)] transition-all duration-1000 group-hover:scale-[1.03]"
              priority
            />
            
            {/* Interactive Points Layer */}
            <div className="absolute inset-0 z-20">
              {HOTSPOTS.map((spot) => (
                <button
                  key={spot.id}
                  onClick={() => setActiveHotspot(spot.id)}
                  onMouseEnter={() => setActiveHotspot(spot.id)}
                  className="absolute flex items-center justify-center w-10 h-10 md:w-14 md:h-14 -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
                  style={{ top: spot.top, left: spot.left }}
                  aria-label={t(`hotspots.${spot.id}.label`)}
                >
                  <div className={`relative flex items-center justify-center w-full h-full rounded-full transition-all duration-500 ${activeHotspot === spot.id ? 'bg-[#C8922A]/20 scale-125' : 'bg-transparent hover:bg-[#C8922A]/10'}`}>
                    <div className={`w-3.5 h-3.5 md:w-5 md:h-5 rounded-full border-2 border-[#C8922A] transition-all duration-300 ${activeHotspot === spot.id ? 'bg-[#C8922A] scale-110 shadow-[0_0_20px_#C8922A]' : 'bg-[#0A0A0A] shadow-xl'}`} />
                    {activeHotspot === spot.id && (
                      <motion.div layoutId="blueprintPulse" className="absolute inset-0 rounded-full border border-[#C8922A] animate-ping opacity-40" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Visual Scan Effect */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-[#C8922A]/5 to-transparent w-full h-full -translate-x-full animate-[scan_8s_linear_infinite]" />
          </div>

          {/* Dynamic Information Display */}
          <div className="w-full max-w-5xl min-h-[220px] flex items-center justify-center relative px-4">
            <AnimatePresence mode="wait">
              {activeHotspot ? (
                <motion.div
                  key={activeHotspot}
                  initial={{ opacity: 0, scale: 0.95, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -30 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/20 p-10 md:p-14 rounded-[3rem] backdrop-blur-2xl text-center w-full shadow-2xl"
                >
                  <h3 className="text-3xl md:text-4xl font-bold text-[#C8922A] mb-6 tracking-tight">
                    {t(`hotspots.${activeHotspot}.label`)}
                  </h3>
                  <p className="text-xl md:text-2xl text-gray-200 leading-relaxed font-light max-w-3xl mx-auto">
                    {t(`hotspots.${activeHotspot}.description`)}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center group"
                >
                  <div className="inline-flex items-center gap-4 px-10 py-5 bg-white/5 border border-white/10 rounded-full text-gray-400 text-base md:text-lg hover:bg-white/10 transition-colors cursor-default">
                    <Info className="w-6 h-6 text-[#C8922A] animate-bounce" />
                    <span>{isRTL ? 'انقر على النقاط الذهبية لاستكشاف أسرار التصميم' : 'Click on the golden points to explore design secrets'}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Concept to Reality - Comparison Section */}
        <div className="mb-40 px-4 md:px-8">
          <div className="max-w-4xl mx-auto text-center mb-20 px-4">
            <h3 className="text-4xl md:text-6xl font-bold mb-10 text-white tracking-tight">
              {t('conceptToTable.title')}
            </h3>
            <p className="text-xl md:text-2xl text-gray-400 leading-relaxed mb-12 font-light">
              {t('conceptToTable.paragraph')}
            </p>
            <div className="inline-block px-10 py-6 bg-[#C8922A]/10 border-s-4 border-[#C8922A] rounded-2xl">
              <p className="text-2xl md:text-3xl text-[#C8922A] font-medium italic">
                &quot;{t('conceptToTable.shortStatement')}&quot;
              </p>
            </div>
          </div>
          
          <div className="relative w-full max-w-[1600px] mx-auto aspect-[16/8] md:aspect-[21/9] rounded-[3.5rem] overflow-hidden group border border-white/10 shadow-3xl">
            <Image
              src="/assets/gallery/kahramana-mixed-grill.webp"
              alt={t('altTexts.reality')}
              fill
              className="object-cover transition-transform duration-[3000ms] group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent z-10 opacity-90" />
            
            {/* The Blueprint Overlay Reveal */}
            <div className="absolute inset-0 bg-[#0A0A0A]/95 backdrop-blur-xl transition-all duration-1000 group-hover:opacity-0 group-hover:backdrop-blur-none flex flex-col items-center justify-center z-20">
               <div className="relative w-4/5 h-4/5 max-w-4xl opacity-50 group-hover:scale-110 transition-transform duration-1000">
                 <Image
                    src="/assets/brand/kahramana-baghdad-brand-heritage-emblem.webp"
                    alt="Immersion"
                    fill
                    className="object-contain"
                 />
               </div>
               <div className="absolute bottom-16 flex flex-col items-center gap-6">
                  <div className="w-px h-16 bg-gradient-to-b from-transparent to-[#C8922A] animate-pulse" />
                  <span className="text-[#C8922A] tracking-[0.5em] text-sm md:text-base uppercase font-bold">
                    {isRTL ? 'مرر الماوس لتجسيد المخطط في الواقع' : 'Hover to materialize reality'}
                  </span>
               </div>
            </div>
          </div>
        </div>

        {/* Heritage Footer Seal */}
        <div className="text-center max-w-3xl mx-auto border-t border-white/5 pt-32 px-4">
           <div className="mb-12 opacity-40 hover:opacity-100 transition-all duration-1000">
              <Image 
                src="/assets/brand/kahramana-baghdad-brand-heritage-emblem.webp" 
                alt="Emblem Seal" 
                width={120} 
                height={120} 
                className="mx-auto drop-shadow-[0_0_30px_rgba(200,146,42,0.2)]"
              />
           </div>
           <h4 className="text-4xl font-bold text-white mb-6 tracking-tight">{t('closing.title')}</h4>
           <p className="text-2xl text-[#C8922A] mb-16 font-light">{t('closing.line')}</p>
           
           <div className="bg-gradient-to-b from-white/5 to-transparent p-12 rounded-[3rem] border border-white/5 shadow-2xl">
             <span className="block text-xs text-[#C8922A] tracking-[0.4em] uppercase mb-6 font-bold">
               {t('closing.lamassuLabel')}
             </span>
             <p className="text-lg text-gray-500 max-w-md mx-auto leading-relaxed font-light">
               {t('closing.lamassuDescription')}
             </p>
           </div>
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
}
