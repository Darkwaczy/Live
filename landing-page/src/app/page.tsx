'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Shield, Zap, Globe, Download, ArrowRight, Play, BookOpen } from 'lucide-react';
import { SpeechOrb } from '@/components/SpeechOrb';
import { ScriptureRiver } from '@/components/ScriptureRiver';
import { FeatureCard } from '@/components/FeatureCard';

export default function LandingPage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const transcriptionText = "Building the future of Nigerian worship technology...";

  return (
    <main className="relative min-h-screen selection:bg-emerald-500/30">
      {/* Background Layer */}
      <ScriptureRiver />
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass py-6 px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-black text-black">S</div>
          <span className="text-xl font-black tracking-tighter uppercase">SermonSync</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-gray-400">
          <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
          <a href="#technology" className="hover:text-emerald-400 transition-colors">Technology</a>
          <a href="#download" className="bg-emerald-500 text-black px-6 py-3 rounded-full hover:scale-105 transition-transform active:scale-95">Get Started</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
          <SpeechOrb />
        </div>

        <div className="relative z-10 text-center space-y-8 max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-emerald-400 text-xs font-black uppercase tracking-widest"
          >
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            V1.0 Now Available Offline
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
            className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white uppercase leading-[0.9]"
          >
            The Pulpit, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600 text-glow">
              Reimagined.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="text-xl md:text-2xl text-gray-400 font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Elite speech-to-text specifically optimized for Nigerian accents. 
            100% private, 100% local, 100% offline.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="flex flex-col md:flex-row items-center justify-center gap-6 pt-10"
          >
            <button className="w-full md:w-auto bg-emerald-500 text-black text-lg font-black px-10 py-5 rounded-full flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all active:scale-95 group">
              <Download size={20} /> Download for Windows
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full md:w-auto glass text-white text-lg font-black px-10 py-5 rounded-full flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95">
              <Play size={20} /> Watch Demo
            </button>
          </motion.div>

          {/* Transcription Simulation */}
          <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 1.5 }}
             className="pt-16"
          >
            <div className="inline-flex flex-col items-center">
               <span className="text-[10px] uppercase font-black tracking-[0.3em] text-emerald-500/50 mb-3 animate-pulse">Live Transcription Active</span>
               <div className="text-emerald-400/90 font-mono text-sm md:text-md italic max-w-lg">
                  {transcriptionText.split('').map((char, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 2 + (i * 0.05) }}
                    >
                      {char}
                    </motion.span>
                  ))}
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="inline-block w-2 h-4 bg-emerald-500 align-middle ml-1"
                  />
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative py-32 px-10 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Mic}
              title="Nigerian Accent Engine"
              description="Proprietary N-ATLAS model trained on thousands of hours of Nigerian spiritual discourse. Perfect accuracy for the pulpit."
              delay={0.1}
            />
            <FeatureCard 
              icon={Shield}
              title="Military-Grade Privacy"
              description="No cloud dependency. Your sermons stay on your machine. Not a single byte of audio ever leaves the church network."
              delay={0.2}
            />
            <FeatureCard 
              icon={Zap}
              title="Lightning Latency"
              description="Optimized C++ and Python core ensures sub-500ms transcription latency. Real-time captioning at the speed of thought."
              delay={0.3}
            />
            <FeatureCard 
              icon={BookOpen}
              title="Smart Bible Tagging"
              description="Automatically detects and displays Bible references in real-time. NIV, KJV, and NLT integration built natively."
              delay={0.4}
            />
            <FeatureCard 
              icon={Globe}
              title="Cross-Source Input"
              description="Transcribe from live microphones, system audio (YouTube/Zoom), or pre-recorded MP3/MP4 files effortlessly."
              delay={0.5}
            />
            <FeatureCard 
              icon={Zap} // Fixed Duplicate Icon Choice in planning
              title="Instant Airplay"
              description="One-click broadcasting to OBS, vMix, or internal projectors. The ultimate digital assistant for media teams."
              delay={0.6}
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="download" className="relative py-48 px-6 text-center z-10">
        <div className="max-w-4xl mx-auto space-y-12">
          <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-none">
            Ready to <span className="text-emerald-500">Sync?</span>
          </h2>
          <p className="text-xl text-gray-500 font-medium">
            Join the media teams of prominent Nigerian ministries already using AI to amplify their mission.
          </p>
          <div className="pt-6">
            <button className="bg-white text-black text-xl font-black px-16 py-7 rounded-full hover:scale-105 transition-transform active:scale-95 shadow-[0_10px_40px_rgba(255,255,255,0.2)]">
               DOWNLOAD SERMONSYNC PRO
            </button>
            <p className="mt-6 text-[10px] text-gray-600 uppercase tracking-widest font-black">Free Version available for small congregations</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-10 border-t border-white/5 text-center text-gray-600">
        <div className="flex flex-col items-center gap-8">
           <div className="flex items-center gap-6 text-xs font-black uppercase tracking-widest">
              <a href="#" className="hover:text-emerald-500 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-emerald-500 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-emerald-500 transition-colors">Documentation</a>
           </div>
           <p className="text-[10px] uppercase font-bold tracking-widest">© 2026 SermonSync AI. All Rights Reserved. Engineered in Nigeria.</p>
        </div>
      </footer>
    </main>
  );
}
