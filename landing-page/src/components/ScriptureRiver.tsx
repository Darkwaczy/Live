'use client';

import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const VERSES = [
  "In the beginning was the Word...",
  "Let there be light...",
  "The Lord is my Shepherd...",
  "By His stripes we are healed...",
  "For God so loved the world...",
  "I can do all things through Christ...",
  "The joy of the Lord is my strength...",
  "Faith comes by hearing...",
  "Thy Word is a lamp unto my feet...",
];

export const ScriptureRiver = () => {
  const { scrollYProgress } = useScroll();
  const yRange = useTransform(scrollYProgress, [0, 1], [0, -500]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
      <motion.div 
        style={{ y: yRange }}
        className="flex flex-col gap-32 items-center pt-24"
      >
        {VERSES.concat(VERSES).map((verse, i) => (
          <div 
            key={i}
            className={`text-6xl md:text-8xl font-black uppercase tracking-tighter transition-colors select-none whitespace-nowrap ${
              i % 2 === 0 ? 'text-white/5' : 'text-emerald-500/5'
            }`}
            style={{
              paddingLeft: `${Math.sin(i) * 50}%`,
              transform: `rotate(${Math.sin(i) * 5}deg)`
            }}
          >
            {verse}
          </div>
        ))}
      </motion.div>
    </div>
  );
};
