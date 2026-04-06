import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Monitor, Volume2 } from 'lucide-react';
import { LiveState } from '../models/liveState';
import { useBroadcastSync } from '../hooks/useBroadcastSync';

const INITIAL_STATE: LiveState = {
  session_id: '',
  current_text: '',
  current_verse: null,
  preview_text: '',
  preview_verse: null,
  is_live_dirty: false,
  is_analyzing: false,
  detection_history: [],
  history: [],
  ticker_enabled: false,
  ticker_items: [],
  is_blank: false,
  is_logo: false,
  is_point: false,
  media_muted: false,
  media_playing: true,
  media_volume: 1.0,
  media_epoch: Date.now(),
  updated_at: new Date().toISOString(),
};

// Minimal KaraokeLine for the projector (no interaction needed)
const LyricDisplay = ({ text, nextText, songTitle }: { text: string; nextText?: string | null; songTitle?: string }) => (
  <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center animate-in zoom-in-95 duration-700">
    {songTitle && <p className="text-[14px] text-emerald-400/60 font-black tracking-[0.4em] uppercase mb-6">{songTitle}</p>}
    <p className="text-white text-7xl leading-[1.1] font-serif font-bold tracking-tight max-w-5xl mx-auto drop-shadow-2xl text-center">
      "{text}"
    </p>
    {nextText && (
      <p className="text-white/30 text-3xl font-serif italic mt-8 tracking-wide">{nextText}</p>
    )}
  </div>
);

export default function ProjectorPage() {
  const [liveState, setLiveState] = useState<LiveState>(INITIAL_STATE);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [projectorBg, setProjectorBg] = useState('/worship-bg.png');
  const [churchLogo, setChurchLogo] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ca_settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.projectorBg) setProjectorBg(s.projectorBg);
        if (s.churchLogo) setChurchLogo(s.churchLogo);
      }
    } catch {}
  }, []);

  const handleRemoteUpdate = useCallback((state: LiveState) => {
    setLiveState(state);
    // Re-read settings on every update in case operator changed them
    try {
      const raw = localStorage.getItem('ca_settings');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.projectorBg) setProjectorBg(s.projectorBg);
        if (s.churchLogo) setChurchLogo(s.churchLogo);
      }
    } catch {}
  }, []);

  // Sync Handshake: Seek to operator's time only once on load
  const hasInitialSynced = useRef(false);
  const handleRemoteUpdateWithSeek = useCallback((newState: LiveState) => {
     handleRemoteUpdate(newState);
     // If this is the initial load and we have an incoming timestamp, seek to it.
     if (!hasInitialSynced.current && newState.current_media && (newState.media_currentTime || 0) > 0) {
        if (videoRef.current) {
           videoRef.current.currentTime = newState.media_currentTime!;
           hasInitialSynced.current = true;
        }
     }
  }, [handleRemoteUpdate]);

  // BroadcastChannel sync — projector only listens
  useBroadcastSync(liveState, handleRemoteUpdateWithSeek, true);

  // Hardware video sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = liveState.media_muted ?? false;
    video.volume = liveState.media_volume ?? 1.0;
    
    if (liveState.media_playing) {
      video.play().catch(() => setAudioBlocked(true));
    } else {
      video.pause();
      // SYNC ON PAUSE: Ensure TV matches the operator's frame
      if (liveState.media_currentTime !== undefined) {
        video.currentTime = liveState.media_currentTime;
      }
    }
  }, [liveState.media_playing, liveState.media_muted, liveState.media_volume, liveState.media_currentTime]);

  const handleActivateAudio = () => {
    videoRef.current?.play().catch(() => {});
    setAudioBlocked(false);
  };

  // Derived display values
  const displayVerseLive = (() => {
    if (!liveState.current_verse) return null;
    // We only have the reference here — for the verse text we'd need the fetch
    // Instead, use current_text which goLive copies into
    return liveState.current_verse ? { reference: `${liveState.current_verse.book} ${liveState.current_verse.chapter}:${liveState.current_verse.verse_start}` } : null;
  })();

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* ATMOSPHERIC BACKGROUND */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage: `url('${projectorBg}')`,
          filter: 'brightness(0.25) blur(5px) contrast(1.1)',
        }}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-black opacity-30" />

      {/* MEDIA OVERLAY */}
      {liveState.current_media && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <div className="relative w-full h-full overflow-hidden">
            {liveState.current_media.match(/\.(mp4|webm|ogg|blob)/i) || liveState.current_media.includes('#video') ? (
              <video
                key={(liveState.current_media || '') + '-' + (liveState.media_epoch || 0)}
                src={liveState.current_media}
                autoPlay={liveState.media_playing}
                loop
                playsInline
                crossOrigin="anonymous"
                className="w-full h-full object-contain"
                ref={videoRef}
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget;
                  el.muted = liveState.media_muted ?? false;
                  el.volume = liveState.media_volume ?? 1.0;
                }}
              />
            ) : liveState.current_media.match(/\.(pdf|doc|docx|ppt|pptx)/i) || liveState.current_media.includes('#doc') ? (
              <iframe src={liveState.current_media} className="w-full h-full border-0 bg-white" title="Broadcast Document" />
            ) : (
              <img src={liveState.current_media} alt="Broadcast" className="w-full h-full object-contain" />
            )}
          </div>

          {audioBlocked && !liveState.media_muted && (
            <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <button
                onClick={handleActivateAudio}
                className="flex flex-col items-center gap-6 p-12 bg-emerald-500 hover:bg-emerald-400 text-black rounded-[48px] shadow-[0_30px_60px_rgba(16,185,129,0.3)] transition-all active:scale-95"
              >
                <Volume2 size={64} strokeWidth={2.5} />
                <div className="text-center">
                  <h3 className="text-4xl font-black uppercase tracking-[0.2em] mb-2">Enable Audio</h3>
                  <p className="text-sm font-bold uppercase tracking-widest opacity-60">Tap to start congregation broadcast</p>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* CONTENT AREA */}
      <div className={`w-full max-w-[96vw] relative mx-auto ${liveState.ticker_enabled ? 'h-[65vh] mb-32' : 'h-[80vh]'} flex flex-col items-center justify-center text-center z-10 p-4 transition-all duration-300`}>

        {/* MANUAL LYRIC MODE */}
        {liveState.current_lyric_line && !liveState.current_media && (
          <LyricDisplay
            text={liveState.current_lyric_line}
            nextText={liveState.preview_lyric_line}
          />
        )}

        {/* SCRIPTURE OVERLAY */}
        {liveState.current_verse && (liveState.current_verse_text || liveState.current_text) && !liveState.current_lyric_line && !liveState.current_media && (
          <div className="w-full max-w-[95%] mx-auto flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
            <div className="glass-panel w-full p-16 bg-white/3 backdrop-blur-3xl border border-white/10 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent opacity-30" />
              <div className="relative space-y-12">
                <div className="flex flex-col items-center gap-4">
                  <h2 className="text-5xl text-emerald-400 font-black tracking-widest uppercase drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                    {displayVerseLive?.reference}
                  </h2>
                  <div className="h-1.5 w-24 rounded-full bg-emerald-400 opacity-60" />
                </div>
                <p className="text-white text-6xl leading-[1.1] font-serif font-bold tracking-tight mx-auto drop-shadow-2xl w-full">
                  "{liveState.current_verse_text || liveState.current_text}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SERMON POINT */}
        {liveState.is_point && liveState.current_text && !liveState.current_verse && !liveState.current_lyric_line && !liveState.current_media && (
          <div className="w-full max-w-[95%] mx-auto flex flex-col items-center justify-center animate-in slide-in-from-bottom-12 duration-400">
            <div className="glass-panel w-full p-16 bg-white/3 backdrop-blur-3xl border-2 border-amber-500/20 rounded-[64px] shadow-[0_40px_120px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <div className="relative space-y-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="px-6 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full">
                    <h2 className="text-2xl text-amber-500 font-black tracking-[0.5em] uppercase">Sermon Point</h2>
                  </div>
                  <div className="h-1 w-32 rounded-full bg-amber-500/40" />
                </div>
                <p className="text-white text-7xl font-black tracking-tight mx-auto leading-[1.1] drop-shadow-2xl font-serif italic text-center w-full">
                  "{liveState.current_text}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!liveState.current_text && !liveState.current_verse && !liveState.current_lyric_line && !liveState.current_media && (
          <div className="opacity-10 flex flex-col items-center">
            <Monitor size={80} className="text-white mb-6" />
            <p className="text-[12px] font-black uppercase tracking-[0.5em] text-white">Awaiting Broadcast</p>
          </div>
        )}
      </div>

      {/* BLANK OVERLAY */}
      {liveState.is_blank && (
        <div className="absolute inset-0 z-300 bg-black pointer-events-none" />
      )}

      {/* THEME OVERLAY */}
      {liveState.is_logo && (
        <div className="absolute inset-0 z-1000 flex animate-in fade-in flex-col items-center justify-center bg-black">
          {churchLogo ? (
            <img src={churchLogo} alt="Theme" className="w-full h-full object-contain" />
          ) : (
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150" />
              <div className="text-white/80 p-16 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex flex-col items-center">
                <Monitor size={100} className="mb-8 text-emerald-500/70" />
                <h2 className="text-4xl font-black tracking-[0.4em] uppercase text-white/50 text-center">Worship Live</h2>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NEWS TICKER */}
      {liveState.ticker_enabled && (liveState.ticker_items?.length ?? 0) > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-red-600 border-t-8 border-red-800 flex items-center overflow-hidden z-250">
          <div className="animate-marquee h-full flex items-center whitespace-nowrap">
            <div className="flex shrink-0">
              {(liveState.ticker_items || []).map((item, i) => (
                <span key={i} className="px-16 text-2xl font-black text-white uppercase tracking-widest">
                  {item} <span className="text-red-400 mx-6">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
