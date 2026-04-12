'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue } from 'framer-motion';

export const SpeechOrb = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    mouseX.set((clientX / innerWidth) - 0.5);
    mouseY.set((clientY / innerHeight) - 0.5);
  };

  const springConfig = { damping: 25, stiffness: 150 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [15, -15]);
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-15, 15]);

  return (
    <div 
      className="relative w-[300px] h-[300px] md:w-[500px] md:h-[500px] flex items-center justify-center pointer-events-none"
      onMouseMove={handleMouseMove}
    >
      {/* Outer Glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-emerald-500/10 blur-[100px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* The Orb */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          perspective: 1000,
        }}
        className="relative w-48 h-48 md:w-80 md:h-80 rounded-full glass glow-emerald flex items-center justify-center overflow-hidden"
      >
        {/* Holographic Texture */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 via-transparent to-emerald-400/10"
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Pulse Ring */}
        <motion.div
          className="absolute inset-4 rounded-full border border-emerald-500/30"
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Core Glow */}
        <div className="w-1/3 h-1/3 rounded-full bg-emerald-500/40 blur-2xl" />
        
        {/* Floating Particles */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-emerald-400 rounded-full"
            animate={{
              x: [Math.random() * 200 - 100, Math.random() * 200 - 100],
              y: [Math.random() * 200 - 100, Math.random() * 200 - 100],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: Math.random() * 2,
            }}
          />
        ))}
      </motion.div>

      {/* Orbiting Rings */}
      <motion.div
        className="absolute w-[110%] h-[110%] rounded-full border border-white/5 border-dashed"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute w-[130%] h-[130%] rounded-full border border-emerald-500/5"
        animate={{ rotate: -360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
};
