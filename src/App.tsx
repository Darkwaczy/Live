import React, { useState, useEffect } from 'react';
import { 
  Mic, Play, Pause, Settings, Monitor, BookOpen, 
  Music, FileText, Save, History, X, AlertCircle,
  Menu, ChevronRight, Cast, LayoutGrid, SkipForward,
  Activity, Globe, Search, MoreHorizontal, Layers, 
  Trash2, Share2, Sidebar, Maximize2
} from 'lucide-react';
import { useLiveState } from './hooks/useLiveState';
import { useSync } from './hooks/useSync';
import { saveLiveState, getLiveState, saveNote, getNotes, saveSession, getSession } from './services/dbService';
import { getCurrentUser } from './services/authService';
import { Note } from './models/note';
import { Session } from './models/session';

export default function App() {
  const [activeView, setActiveView] = useState<'live' | 'history' | 'settings'>('live');
  const [isProjector, setProjector] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [session] = useState<Session>({
    id: 'session-' + Date.now(),
    name: 'Sermon Session',
    status: 'live',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('sermonsync_settings');
    return saved ? JSON.parse(saved) : {
      bibleVersion: 'KJV',
      highlightColor: 'emerald',
      timerDuration: 45,
      aiVerseDetection: true,
      speechEngine: 'web'
    };
  });

  const { 
    liveState, interimText, isListening, 
    start, stop, clearText, error, setError, goLive, setPreviewVerse, applyLiveState
  } = useLiveState(
    session.id, 
    settings.speechEngine, 
    {}, 
    { 
      enabled: settings.aiVerseDetection, 
      endpointUrl: settings.aiEndpoint || 'http://localhost:11434/api/generate', 
      apiKey: settings.aiApiKey || '', 
      modelName: settings.aiModel || 'llama3' 
    }
  );
  const { connected } = useSync(session.id, liveState, applyLiveState);

  const [selectedBook, setSelectedBook] = useState('Genesis');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const bibleBooks = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];

  const transcriptScrollRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [liveState.current_text, interimText]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const nebulaStyle = {
    background: 'radial-gradient(circle at 50% 50%, rgba(20, 40, 80, 0.4) 0%, rgba(5, 10, 20, 1) 100%), url("https://www.transparenttextures.com/patterns/stardust.png")',
    boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)'
  };

  const displayVersePreview = liveState.preview_verse 
    ? { reference: `${liveState.preview_verse.book} ${liveState.preview_verse.chapter}:${liveState.preview_verse.verse_start}`, text: 'Staged for Live' } 
    : null;

  const displayVerseLive = liveState.current_verse
    ? { reference: `${liveState.current_verse.book} ${liveState.current_verse.chapter}:${liveState.current_verse.verse_start}`, text: 'Live on Screen' }
    : null;

  return (
    <div className="flex h-screen w-full bg-[#0a0a0c] text-white font-sans overflow-hidden select-none">
      
      {/* 1. FAR-LEFT ICON SIDEBAR */}
      <aside className="w-[64px] flex flex-col items-center py-6 bg-[#0f0f12] border-r border-white/5 shrink-0 z-50">
        <div className="p-3 mb-10 text-emerald-500">
          <Layers size={24} />
        </div>
        <nav className="flex flex-col gap-8">
          <button onClick={() => setActiveView('live')} className={`p-3 rounded-xl transition-all ${activeView === 'live' ? 'bg-emerald-500/10 text-emerald-500 shadow-glow' : 'text-gray-500 hover:text-white'}`}>
            <LayoutGrid size={22} />
          </button>
          <button onClick={() => setActiveView('history')} className={`p-3 rounded-xl transition-all ${activeView === 'history' ? 'bg-emerald-500/10 text-emerald-500' : 'text-gray-500 hover:text-white'}`}>
            <History size={22} />
          </button>
          <button onClick={() => setActiveView('settings')} className={`p-3 rounded-xl transition-all mt-auto ${activeView === 'settings' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>
            <Settings size={22} />
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* GLOBAL TOP HEADER */}
        <header className="h-[64px] flex items-center justify-between px-8 bg-[#0a0a0c] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-[#ff3b30]/10 px-3 py-1.5 rounded-lg border border-[#ff3b30]/30 outline-none">
              <div className="w-2 h-2 rounded-full bg-[#ff3b30] animate-pulse"></div>
              <span className="text-[10px] font-black text-[#ff3b30] tracking-widest">LIVE</span>
            </div>
            <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-sm font-mono text-gray-400">00:12</span>
              <div className="w-px h-4 bg-white/10"></div>
              <button className="text-[10px] font-bold text-emerald-500 flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Trash2 size={12} /> CLEAR SCREEN
              </button>
            </div>
            <button onClick={isListening ? stop : start} className="p-2 transition-transform active:scale-95 text-emerald-500">
               {isListening ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <button onClick={goLive} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-sm font-bold px-5 py-2 rounded-xl border border-white/10 transition-all">
              <SkipForward size={16} fill="currentColor" /> GO LIVE
            </button>
          </div>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-gray-500">
               <BookOpen size={18} />
               <span className="text-sm font-mono">30:12</span>
            </div>
            <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-full">
               <div className="w-8 h-8 rounded-full bg-linear-to-tr from-emerald-500 to-teal-400"></div>
            </div>
          </div>
        </header>

        {/* 3-COLUMN STUDIO LAYOUT */}
        <div className="flex-1 flex gap-px bg-white/5 overflow-hidden">
          
          {/* COLUMN 1: LIVE TRANSCRIPT (LEFT) */}
          <section className="w-[340px] flex flex-col bg-[#0a0a0c] shrink-0">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
               <h3 className="text-sm font-bold tracking-tight text-white">Live Transcript</h3>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">Listening...</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-glow-emerald"></div>
               </div>
            </div>
            <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
               {(liveState.current_text || '').split('. ').slice(-20).map((line, i) => (
                  <div key={i} className={`space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500`} style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-center gap-3 opacity-40">
                      <SkipForward size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Speaker</span>
                    </div>
                    <div className="flex gap-4">
                       <span className="text-[10px] font-mono text-emerald-500 font-bold mt-1">
                          {new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                       <p className={`text-sm leading-relaxed font-medium transition-colors ${line.toLowerCase().includes(selectedBook.toLowerCase()) ? 'text-emerald-400 font-bold' : 'text-gray-400'}`}>
                          {line.trim()}{line.length > 0 ? '.' : ''}
                       </p>
                    </div>
                  </div>
               ))}
               {interimText && (
                  <div className="flex gap-4 opacity-50 italic">
                     <span className="text-[10px] font-mono text-emerald-500/50 mt-1">now</span>
                     <p className="text-sm text-gray-400 leading-relaxed font-medium">{interimText}</p>
                  </div>
               )}
            </div>
            <div className="p-6 border-t border-white/5 flex items-center justify-between">
               <span className="text-xs font-mono text-gray-600">12:01</span>
               <div className="flex gap-1 items-end h-6">
                  <div className="w-1 h-3 bg-white/10 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1 h-5 bg-white/20 rounded-full animate-bounce"></div>
                  <div className="w-1 h-4 bg-white/15 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                  <div className="w-1 h-6 bg-white/25 rounded-full animate-bounce [animation-delay:0.3s]"></div>
                  <div className="w-1 h-2 bg-white/10 rounded-full animate-bounce"></div>
               </div>
            </div>
          </section>

          {/* COLUMN 2: PRODUCTION (CENTER) */}
          <section className="flex-1 flex flex-col gap-px bg-white/5">
            
            {/* PROGRAM PREVIEW (TOP) */}
            <div className="flex-1 flex flex-col bg-[#0a0a0c] p-6 min-h-0 relative">
               <div className="flex items-center justify-between mb-4 z-10">
                  <h3 className="text-sm font-bold tracking-tight text-white/90">Program Preview</h3>
                  <button onClick={goLive} className="flex items-center gap-2 bg-emerald-500 text-black text-[10px] font-black px-4 py-1.5 rounded-lg hover:bg-emerald-400 transition-all uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95">
                    <Activity size={12} /> Go Live
                  </button>
               </div>
               <div className="flex-1 rounded-[32px] overflow-hidden border border-white/10 relative group" style={nebulaStyle}>
                  <div className="absolute top-6 left-6 px-3 py-1 bg-white/10 rounded-lg text-[9px] font-black tracking-widest uppercase text-white/60">PREVIEW</div>
                  <div className="absolute inset-0 flex items-center justify-center p-12 text-center overflow-y-auto">
                    {displayVersePreview ? (
                      <p className="text-4xl text-white font-serif italic leading-tight drop-shadow-2xl animate-in fade-in zoom-in-95 duration-700">
                         "{displayVersePreview.text}"
                         <span className="block text-sm font-sans font-bold uppercase tracking-widest mt-6 text-emerald-400 opacity-60">{displayVersePreview.reference}</span>
                      </p>
                    ) : (
                      <div className="opacity-20 flex flex-col items-center gap-4">
                        <Monitor size={48} />
                        <p className="text-xs font-bold uppercase tracking-widest">Staging Content</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>

            {/* LIVE ON SCREEN (BOTTOM) */}
            <div className="flex-1 flex flex-col bg-[#0a0a0c] p-6 min-h-0 relative">
               <div className="flex items-center justify-between mb-4 z-10">
                  <div className="flex items-center gap-3">
                    <span className="text-red-500 text-[10px] font-black tracking-widest uppercase">LIVE ON SCREEN</span>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={clearText} className="text-[10px] font-bold bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-lg border border-white/5 uppercase tracking-widest text-white/70 transition-colors">Clear</button>
                     <button className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-4 py-1.5 rounded-lg border border-emerald-500/30 uppercase tracking-widest transition-colors">Show Live</button>
                  </div>
               </div>
               <div className="flex-1 rounded-[32px] overflow-hidden border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.05)] relative" style={nebulaStyle}>
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-r from-transparent via-red-500/40 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center p-12 text-center overflow-y-auto">
                    {displayVerseLive ? (
                      <p className="text-4xl text-white font-serif italic leading-tight drop-shadow-2xl animate-in fade-in duration-500">
                         "{displayVerseLive.text}"
                         <span className="block text-sm font-sans font-bold uppercase tracking-widest mt-6 text-red-500 opacity-80">{displayVerseLive.reference}</span>
                      </p>
                    ) : (
                      <div className="opacity-10">
                        <h2 className="text-6xl font-serif italic font-black tracking-tighter">SermonSync</h2>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </section>

          {/* COLUMN 3: INTELLIGENCE (RIGHT) */}
          <section className="w-[360px] flex flex-col gap-px bg-white/5 shrink-0">
            
            {/* AI DETECTION (TOP) */}
            <div className="flex-1 flex flex-col bg-[#0a0a0c] p-6 min-h-0">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold tracking-tight text-white/90">AI Detection</h3>
                  <button className="text-gray-500 hover:text-white transition-colors"><MoreHorizontal size={18} /></button>
               </div>
               <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                  {liveState.detection_history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                      <Activity size={32} className="mb-4" />
                      <p className="text-[10px] font-black tracking-widest uppercase">Listening for intent...</p>
                    </div>
                  ) : (
                    liveState.detection_history.map((det) => (
                      <div key={det.id} className="bg-[#141417] rounded-3xl border border-white/5 p-6 space-y-4 group hover:border-emerald-500/30 transition-all animate-in slide-in-from-right-4">
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">DETECTION</span>
                            <span className="text-[9px] font-mono text-gray-600 tracking-tighter">{new Date(det.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                         </div>
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${det.is_paraphrase ? 'bg-orange-500/10 text-orange-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                               <Activity size={16} />
                            </div>
                            <h4 className="text-[14px] font-bold text-white tracking-tight">
                               {det.verse.book} {det.verse.chapter}:{det.verse.verse_start}
                               <span className={`text-[10px] font-black uppercase ml-2 tracking-widest ${det.is_paraphrase ? 'text-orange-500' : 'text-emerald-500'}`}>
                                  {det.is_paraphrase ? 'semantic' : 'detected'}
                               </span>
                            </h4>
                         </div>
                         <div className="flex gap-2">
                            <button 
                              onClick={() => setPreviewVerse(det.verse)}
                              className="flex-1 py-3 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-400 shadow-glow-emerald transition-all active:scale-95"
                            >
                              Present
                            </button>
                            <button className="px-5 py-3 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors">
                              <SkipForward size={12} /> Queue
                            </button>
                         </div>
                      </div>
                    ))
                  )}
               </div>
            </div>

            {/* SCRIPTURES SELECTION (BOTTOM) */}
            <div className="bg-[#0a0a0c] p-6 border-t border-white/5">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold tracking-tight text-white">Scriptures</h3>
                  <button className="text-gray-500 hover:text-white"><MoreHorizontal size={18} /></button>
               </div>
               <div className="space-y-6">
                  <div>
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2 block">BOOK</label>
                    <select 
                      value={selectedBook} 
                      onChange={(e) => setSelectedBook(e.target.value)}
                      className="w-full bg-[#141417] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:ring-1 ring-emerald-500/30 transition-all appearance-none"
                    >
                      {bibleBooks.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2 block">CHAPTER</label>
                    <select 
                      value={selectedChapter} 
                      onChange={(e) => setSelectedChapter(Number(e.target.value))}
                      className="w-full bg-[#141417] border border-white/5 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:ring-1 ring-emerald-500/30 transition-all appearance-none"
                    >
                      {[...Array(150)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                    </select>
                  </div>
                  <button 
                    onClick={() => setPreviewVerse({ book: selectedBook, chapter: selectedChapter, verse_start: 1, verse_end: 1 })}
                    className="w-full py-5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl border border-emerald-500/30 transition-all active:scale-[0.98]"
                  >
                    Load
                  </button>
               </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
