import React, { useEffect, useMemo, useState } from 'react';
import { 
  Menu, Play, Pause, SkipForward, SkipBack, 
  BookOpen, Music, FileText, Settings, 
  Monitor, Cast, LayoutGrid, ChevronRight, X, Save, AlertCircle
} from 'lucide-react';
import { useLiveState } from './hooks/useLiveState';
import { useSync } from './hooks/useSync';
import { Session } from './models/session';
import { Note } from './models/note';
import { User } from './models/user';
import { login, logout, getCurrentUser } from './services/authService';
import { getNotes, saveNote, saveLiveState, getLiveState, saveSession, getSession } from './services/dbService';
import SettingsView from './components/SettingsView';

const SESSION_ID = 'service-001';

type ViewMode = 'live' | 'history' | 'documents' | 'settings';
type RightPanelTab = 'scriptures' | 'lyrics' | 'notes';
const KaraokeLine = ({ lyric, spokenText, colorClass, animationClass, sizeClass }: { lyric: string, spokenText: string, colorClass: string, animationClass: string, sizeClass: string }) => {
  const words = lyric.split(' ');
  const recentSpoken = spokenText.toLowerCase().replace(/[^a-z0-9 \']/g, '').split(' ').filter(w => w.length > 0).slice(-20);
  
  let highestMatchIdx = -1;
  let spokenSearchStart = 0;
  const normalizedLyricWords = words.map(w => w.toLowerCase().replace(/[^a-z0-9 \']/g, ''));
  
  for (let i = 0; i < normalizedLyricWords.length; i++) {
    const target = normalizedLyricWords[i];
    if (!target) continue;
    
    let foundIdx = -1;
    for (let j = spokenSearchStart; j < recentSpoken.length; j++) {
       const spoken = recentSpoken[j];
       if (spoken === target || (target.length > 3 && (target.includes(spoken) || spoken.includes(target)))) {
          foundIdx = j;
          break;
       }
    }
    if (foundIdx !== -1) {
       highestMatchIdx = i;
       spokenSearchStart = foundIdx + 1;
    }
  }

  if (!lyric || lyric === '...') return <span className={`${sizeClass} font-bold text-white/30 tracking-wide`}>...</span>;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 w-full relative z-10">
      {words.map((word, idx) => {
         const isSung = idx <= highestMatchIdx;
         const isNext = idx === highestMatchIdx + 1;
         
         let className = "text-white/40 font-bold transition-all duration-300 transform";
         if (isSung) {
            className = `${colorClass.replace('text-', 'text-')} font-black ${animationClass === 'glow' ? 'drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]' : ''} transition-all duration-200`;
         } else if (isNext) {
            className = "text-white/90 font-bold scale-105 transition-all duration-200 drop-shadow-md";
         }
         return <span key={idx} className={`${sizeClass} ${className} tracking-tight`}>{word}</span>
      })}
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState<Session>({
    id: SESSION_ID,
    name: 'Sunday Morning Service',
    status: 'live',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const [selectedNote, setSelectedNote] = useState<string | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [newNote, setNewNote] = useState('');

  // UI Interactive States
  const [activeView, setActiveView] = useState<ViewMode>('live');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('notes');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isProjector, setProjector] = useState(false);
  const [manualLineOffset, setManualLineOffset] = useState(0);

  // Global Settings State
  const [settings, setSettings] = useState({
    audioInput: 'live',
    micDevice: 'default',
    noiseSuppression: true,
    gain: 75,
    enableTranscription: true,
    speechEngine: 'web',
    whisperApiKey: '',
    accuracyLevel: 80,
    languageModel: 'whisper-large',
    detectVerses: true,
    verseSensitivity: 60,
    bibleVersion: 'KJV',
    aiVerseDetection: false,
    aiEndpoint: 'https://api.ollama.ai/v1/chat/completions',
    aiApiKey: '62fb62e21a924e8b840f89eadf63ac60.4oe6yZavxGWszCrtRY3iuLhJ',
    aiModel: 'mistral',
    detectSongs: true,
    lyricsSource: 'local',
    autoSyncLyrics: true,
    showTranscript: true,
    showVerse: true,
    showLyrics: true,
    transcriptSize: 'large',
    highlightColor: 'emerald',
    highlightAnimation: 'glow',
    transparency: 50,
    autoSave: true,
    saveHistory: true,
    exportFormat: 'txt',
    cloudSync: false,
    alertVerse: true,
    alertSong: true,
    alertSync: true,
    alertSound: false,
    alertVisual: true,
  });

  const [draftSettings, setDraftSettings] = useState<typeof settings>(settings);

  const updateDraftSetting = (key: string, value: any) => {
    setDraftSettings(prev => ({ ...prev, [key as keyof typeof settings]: value }));
  };

  const commitSettings = () => {
    setSettings(draftSettings);
    showToast('Settings saved successfully!');
  };

  const { liveState, interimText, currentSong, currentLine, currentVerse, isListening, start, stop, clearText, applyLiveState, error, setError } = useLiveState(
    session.id, 
    settings.speechEngine as 'web'|'worker'|'whisper'|'groq'|'deepgram', 
    { apiKey: settings.whisperApiKey, endpoint: '', audioInput: settings.audioInput as 'live' | 'system' },
    { enabled: settings.aiVerseDetection, endpointUrl: settings.aiEndpoint, apiKey: settings.aiApiKey, modelName: settings.aiModel }
  );
  const { connected } = useSync(session.id, liveState, applyLiveState);

  const transcriptScrollRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
     if (transcriptScrollRef.current) {
        transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
     }
  }, [liveState.current_text, interimText]);

  const [fetchedVerse, setFetchedVerse] = useState<{ reference: string; text: string; translation?: string } | null>(null);

  useEffect(() => {
    if (!currentVerse) {
      setFetchedVerse(null);
      return;
    }
    
    setFetchedVerse(null);
    const fetchLocalVerse = async () => {
      const version = settings.bibleVersion.toLowerCase();
      const reference = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse_start}${currentVerse.verse_end && currentVerse.verse_end > currentVerse.verse_start ? `-${currentVerse.verse_end}` : ''}`;
      
      try {
        // Primary: Cloud API
        const apiRes = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=${version}`);
        if (!apiRes.ok) throw new Error("Bible API fetch failed");
        const apiData = await apiRes.json();
        
        if (apiData.text) {
           setFetchedVerse({ 
             reference: apiData.reference || reference, 
             text: apiData.text.replace(/\n/g, ' ').trim(), 
             translation: settings.bibleVersion 
           });
           return;
        }
      } catch (apiErr) {
        console.warn("Cloud Bible API failed, falling back to local JSON...", apiErr);
      }

      try {
        // Secondary Fallback: Local Offline JSON Datasets
        const res = await fetch(`/bibles/${version}.json`);
        
        if (!res.ok) {
           throw new Error(`Local Bible dataset for ${version.toUpperCase()} not found`);
        }
        
        const data = await res.json();
        let verseText = "";
        
        if (Array.isArray(data)) {
           const bookData = data.find((b: any) => b.name?.toLowerCase() === currentVerse.book.toLowerCase() || b.book?.toLowerCase() === currentVerse.book.toLowerCase());
           if (bookData && bookData.chapters) {
              const chapterArr = bookData.chapters[currentVerse.chapter - 1]; // 0-indexed
              if (chapterArr) {
                 for (let i = currentVerse.verse_start; i <= (currentVerse.verse_end || currentVerse.verse_start); i++) {
                    if (chapterArr[i - 1]) verseText += chapterArr[i - 1] + " ";
                 }
              }
           }
        }
        
        if (verseText) {
           setFetchedVerse({ 
             reference: reference, 
             text: verseText.trim(), 
             translation: settings.bibleVersion 
           });
        } else {
           throw new Error("Passage not found in local dataset structure.");
        }
      } catch (err: any) {
        console.warn("Both API and Local Dataset fetching failed.");
        setFetchedVerse({ 
           reference: reference, 
           text: `(Passage text unavailable. Check internet or add local ${settings.bibleVersion}.json dataset)`,
           translation: settings.bibleVersion
        });
      }
    };
    fetchLocalVerse();
  }, [currentVerse, settings.bibleVersion]);

  useEffect(() => {
    (async () => {
      const existingUser = await getCurrentUser();
      if (existingUser) setUser(existingUser);
      
      const persistedNotes = await getNotes(session.id);
      setNotes(persistedNotes);

      const persistedSession = await getSession(session.id);
      if (persistedSession) {
        setSession(persistedSession);
      } else {
        await saveSession(session);
      }

      const persistedLiveState = await getLiveState(session.id);
      if (persistedLiveState) {
        applyLiveState(persistedLiveState);
      }
    })();
  }, [applyLiveState, session.id]);

  useEffect(() => {
    if (!liveState.current_text && !isListening) return;
    const save = async () => {
      try {
        await saveLiveState(liveState);
      } catch (e) {
        console.warn('saveLiveState failed', e);
      }
    };
    save();
  }, [liveState, isListening]);

  const handleSaveNote = async () => {
    if (!newNote.trim()) return;
    const noteObj: Note = {
      id: Date.now().toString(),
      user_id: user?.id || 'guest',
      session_id: session.id,
      content: newNote,
      timestamp: Date.now(),
      created_at: new Date().toISOString()
    };
    
    setNotes((prev) => [noteObj, ...prev]);
    setNewNote('');
    
    try {
      await saveNote(noteObj);
    } catch (err) {
      console.error('Unable to persist note to Supabase DB', err);
      try {
        if (window.sermonSync?.db?.saveNote) {
          await window.sermonSync.db.saveNote(noteObj);
        }
      } catch (localErr) {
        console.error('Unable to persist note to local DB fallback', localErr);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSnapshotToNotes = () => {
    const fullBuffer = liveState.current_text + (interimText ? ' ' + interimText : '');
    if (!fullBuffer.trim()) {
       showToast('No active text to save!');
       return;
    }
    const safeId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const noteObj: Note = {
      id: safeId,
      user_id: user?.id || 'guest',
      session_id: session.id,
      content: fullBuffer.trim(),
      timestamp: Date.now(),
      created_at: new Date().toISOString()
    };
    
    setNotes(prev => [noteObj, ...prev]);
    clearText();
    showToast('Saved transcript block to Notes and cleared screen!');
    
    // Attempt local storage fallback
    try {
      if (window.sermonSync?.db?.saveNote) {
        window.sermonSync.db.saveNote(noteObj);
      }
    } catch (e) {}
  };

  const displayVerse = currentVerse 
    ? fetchedVerse 
      ? fetchedVerse
      : { reference: `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse_start}${currentVerse.verse_end && currentVerse.verse_end > currentVerse.verse_start ? `-${currentVerse.verse_end}` : ''}`, text: 'Retrieving passage from the cloud...', translation: settings.bibleVersion } 
    : null;

  const fullTranscript = (liveState.current_text + ' ' + (interimText || '')).trim();

  // Calculate actual line of song
  const baseLineIndex = settings.autoSyncLyrics ? (currentLine ?? 0) : 0;
  const actualLineIndex = Math.max(0, baseLineIndex + manualLineOffset);
  const mainLyric = currentSong?.lyrics?.find(l => l.order === actualLineIndex)?.line || '';
  const nextLyric = currentSong?.lyrics?.find(l => l.order === actualLineIndex + 1)?.line || '';

  const handleNext = () => setManualLineOffset(prev => prev + 1);
  const handlePrev = () => setManualLineOffset(prev => prev - 1);

  // Dynamic Tailwind Classes based on settings
  const colorClass = settings.highlightColor === 'gold' ? 'text-amber-400' : settings.highlightColor === 'blue' ? 'text-blue-400' : 'text-emerald-400';
  const bgClass = settings.highlightColor === 'gold' ? 'bg-amber-500' : settings.highlightColor === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
  const borderClass = settings.highlightColor === 'gold' ? 'border-amber-500' : settings.highlightColor === 'blue' ? 'border-blue-500' : 'border-emerald-500';
  const animationClass = settings.highlightAnimation === 'glow' ? `drop-shadow-[0_0_12px_rgba(currentColor,0.4)]` : settings.highlightAnimation === 'fade' ? 'animate-pulse' : '';
  const blurStyle = { backdropFilter: `blur(${settings.transparency/10 + 2}px)`, filter: `opacity(${settings.transparency}%)` };

  const transcriptTextClass = settings.transcriptSize === 'small' ? 'text-2xl' : settings.transcriptSize === 'medium' ? 'text-3xl' : 'text-[34px]';
  const projectorTextClass1 = settings.transcriptSize === 'small' ? 'text-4xl' : settings.transcriptSize === 'medium' ? 'text-5xl' : 'text-6xl';
  const projectorTextClass2 = settings.transcriptSize === 'small' ? 'text-3xl' : settings.transcriptSize === 'medium' ? 'text-4xl' : 'text-5xl';
  const projectorTextClass3 = settings.transcriptSize === 'small' ? 'text-2xl' : settings.transcriptSize === 'medium' ? 'text-3xl' : 'text-4xl';

  if (isProjector) {
    return (
      <div className="flex h-screen w-full bg-[#000000] text-white font-sans overflow-hidden select-none relative px-12 py-12">
        <button onClick={() => setProjector(false)} className="absolute top-6 right-6 p-4 text-white/20 hover:text-white/80 transition-opacity z-50">
           <X size={32} />
        </button>
        <div className="flex-1 flex flex-col justify-center items-center w-full max-w-6xl mx-auto space-y-12">
           {settings.showVerse && displayVerse && settings.detectVerses && (
              <div className="absolute top-12 left-12 z-10 w-[400px] glass-panel p-8 shadow-2xl bg-[#1a1a1a]/90 border-t border-white/10" style={{ backdropFilter: `blur(${settings.transparency/5 + 5}px)` }}>
                <h4 className={`${colorClass} font-medium pb-4 border-b border-white/10 mb-4 text-xl`}>{displayVerse.reference} ({settings.bibleVersion})</h4>
                <p className="text-gray-200 text-2xl leading-relaxed font-serif">{displayVerse.text}</p>
              </div>
           )}
           {settings.showTranscript && settings.enableTranscription && (
             <div className="w-full space-y-8 px-24 text-center z-0">
                <p className={`${projectorTextClass1} text-white leading-normal font-medium tracking-tight whitespace-pre-wrap`}>
                  {(liveState.current_text + (interimText ? ' ' + interimText : '')).trim().split(' ').slice(-30).join(' ') || (isListening ? 'Listening...' : 'Click Play to start the live transcription.')}
                </p>
             </div>
           )}
        </div>
        {settings.showLyrics && settings.detectSongs && currentSong && currentSong.lyrics && currentSong.lyrics.length > 0 && (
           <div className="absolute bottom-12 left-12 right-12 glass-panel p-8 bg-[#111111]/90 border border-white/10 text-center" style={{ backdropFilter: `blur(${settings.transparency/5 + 5}px)` }}>
              <p className={`text-5xl font-bold ${colorClass} tracking-wide mb-4 ${animationClass}`}>
                {mainLyric || '...'}
              </p>
              {nextLyric && <p className="text-3xl text-gray-500 italic mt-4">{nextLyric}</p>}
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#121212] text-white font-sans overflow-hidden select-none">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
           {toastMessage}
           <button onClick={() => setToastMessage(null)} className="hover:bg-white/20 rounded-full p-1"><X size={16}/></button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-[72px] flex flex-col items-center py-6 bg-[#161616] border-r border-white/5 z-20 shrink-0">
        <button onClick={() => showToast('Menu opened')} className="p-3 hover:bg-white/5 rounded-xl mb-8 transition-colors">
          <Menu size={24} className={activeView === 'settings' ? 'text-white' : 'text-gray-400'} />
        </button>
        <nav className="flex flex-col gap-6 w-full px-3">
          <button 
            onClick={() => setActiveView('live')}
            className={`flex justify-center p-3 rounded-xl relative group transition-colors ${activeView === 'live' ? 'bg-red-500/10 text-red-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} 
            title="Live Session">
            {activeView === 'live' && <div className="absolute inset-y-0 left-[-12px] w-[3px] bg-red-500 rounded-r-lg"></div>}
            <Monitor size={22} />
          </button>
          <button 
            onClick={() => setActiveView('history')}
            className={`flex justify-center p-3 rounded-xl relative group transition-colors ${activeView === 'history' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} 
            title="History">
            {activeView === 'history' && <div className="absolute inset-y-0 left-[-12px] w-[3px] bg-emerald-500 rounded-r-lg"></div>}
            <BookOpen size={22} />
          </button>
          <button 
            onClick={() => setActiveView('documents')}
            className={`flex justify-center p-3 rounded-xl relative group transition-colors ${activeView === 'documents' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} 
            title="Documents">
            {activeView === 'documents' && <div className="absolute inset-y-0 left-[-12px] w-[3px] bg-emerald-500 rounded-r-lg"></div>}
            <FileText size={22} />
          </button>
          <div className="flex-1" />
          <button 
            onClick={() => setActiveView('settings')}
            className={`flex justify-center p-3 rounded-xl relative group transition-colors mt-auto ${activeView === 'settings' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} 
            title="Settings">
            {activeView === 'settings' && <div className="absolute inset-y-0 left-[-12px] w-[3px] bg-white rounded-r-lg"></div>}
            <Settings size={22} />
          </button>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-[#1a2332]/40 via-[#121212] to-[#121212]">
        
        {/* API Error Toast */}
        {error && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-3 bg-red-500/90 backdrop-blur-md text-white px-5 py-3 rounded-xl shadow-2xl border border-red-400/30">
            <AlertCircle size={18} className="text-red-100" />
            <span className="text-sm font-medium pr-2">{error}</span>
            <div className="w-px h-4 bg-white/20"></div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-md transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Top Navbar */}
        <header className="h-[72px] flex items-center justify-between px-6 border-b border-white/5 bg-transparent z-10 shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={() => showToast('Burger menu clicked')} className="text-gray-400 hover:text-white transition-colors">
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2 bg-red-500 rounded-md px-2.5 py-1" title="Session is live">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
              <span className="text-[11px] font-bold text-white tracking-widest uppercase">LIVE</span>
            </div>
            
            <div className="flex items-center gap-1 bg-[#1e1e24]/80 p-0.5 rounded-lg border border-white/5">
              <button onClick={handleSnapshotToNotes} className="px-3 py-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded-md transition-all mr-1" title="Save current text to Notes and clear screen">
                <Save size={14} /> Save & Clear
              </button>
              <div className="w-px h-5 bg-white/10 mx-1"></div>
              <button onClick={isListening ? stop : start} className={`p-2 hover:bg-white/10 rounded-md transition-colors ${colorClass}`} title={isListening ? "Pause Transcription" : "Start Transcription"}>
                {isListening ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              <button 
                onClick={() => { handlePrev(); showToast('Skipped back one line'); }} 
                className="p-2 hover:bg-white/10 text-white rounded-md transition-colors"
                title="Previous Lyric/Item"
              >
                <SkipBack size={18} fill="currentColor" />
              </button>
              <button 
                onClick={() => { handleNext(); showToast('Skipped forward one line'); }} 
                className="p-2 hover:bg-white/10 text-white rounded-md transition-colors"
                title="Next Lyric/Item"
              >
                <SkipForward size={18} fill="currentColor" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-400 h-full">
              <button 
                onClick={() => { setRightPanelTab('scriptures'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-2 transition-colors h-[72px] relative ${rightPanelTab === 'scriptures' ? colorClass : 'hover:text-white'}`}>
                <BookOpen size={16} /> Scriptures
                {rightPanelTab === 'scriptures' && <div className={`absolute bottom-0 left-0 right-0 h-1 ${bgClass} rounded-t-full`}></div>}
              </button>
              <button 
                onClick={() => { setRightPanelTab('lyrics'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-2 transition-colors h-[72px] relative ${rightPanelTab === 'lyrics' ? colorClass : 'hover:text-white'}`}>
                <Music size={16} /> Lyrics
                {rightPanelTab === 'lyrics' && <div className={`absolute bottom-0 left-0 right-0 h-1 ${bgClass} rounded-t-full`}></div>}
              </button>
              <button 
                onClick={() => { setRightPanelTab('notes'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-2 transition-colors h-[72px] relative ${rightPanelTab === 'notes' ? colorClass : 'hover:text-white'}`}>
                <FileText size={16} /> Notes
                {rightPanelTab === 'notes' && <div className={`absolute bottom-0 left-0 right-0 h-1 ${bgClass} rounded-t-full`}></div>}
              </button>
            </nav>

            <div className="w-px h-6 bg-gray-700/50 mx-2 hidden lg:block"></div>

            <div className="flex items-center gap-4 text-gray-400">
              <button onClick={() => setActiveView('settings')} className={`p-2 transition-colors ${activeView === 'settings' ? 'text-white bg-white/10 rounded-lg' : 'hover:text-white'}`}><Settings size={20} /></button>
              <button onClick={() => setProjector(true)} title="Cast to Projector" className="p-2 hover:text-white transition-colors"><Cast size={20} /></button>
              <button onClick={() => setProjector(true)} title="Open Fullscreen Monitor" className="p-2 hover:text-white transition-colors"><Monitor size={20} /></button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main Content Area based on ViewMode */}
          <div className="flex-1 flex flex-col relative px-10 py-8 overflow-hidden z-0">
            {activeView === 'live' ? (
              <>
                {/* Main Background Glow */}
                <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-screen" 
                     style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #3b82f6 0%, transparent 50%)' }} />

                {/* Floating Verse Card */}
                {settings.showVerse && settings.detectVerses && displayVerse && (!mainLyric || !settings.showLyrics) && (
                    <div className={`absolute top-8 left-10 z-10 w-[460px] glass-panel p-8 shadow-2xl bg-[#22272e]/90 border-t ${settings.highlightAnimation === 'glow' ? `border-${colorClass.replace('text-','')}/30 shadow-[0_0_40px_-15px_rgba(52,211,153,0.3)]` : 'border-white/10'}`} style={blurStyle}>
                      <h4 className={`${colorClass} font-bold text-xl pb-4 border-b border-white/10 mb-4`}>{displayVerse.reference} <span className="opacity-60 text-sm font-normal ml-2">({displayVerse.translation || settings.bibleVersion})</span></h4>
                      <p className="text-gray-200 text-[21px] leading-relaxed font-serif tracking-tight">{displayVerse.text}</p>
                    </div>
                )}

                {/* Transcript Area */}
                {settings.showTranscript && settings.enableTranscription && (
                  <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto py-12 z-0 relative overflow-hidden">
                     <div 
                        ref={transcriptScrollRef}
                        className="flex-1 overflow-y-auto pr-8 scroll-smooth"
                        style={{ scrollBehavior: 'smooth' }}
                     >
                        {liveState.current_text || interimText ? (
                          <p className={`${transcriptTextClass} pb-32 text-gray-200 leading-[1.8] font-medium tracking-wide whitespace-pre-wrap`}>
                            {liveState.current_text}
                            {interimText && <span className="text-gray-500 ml-2 animate-pulse">{interimText}</span>}
                          </p>
                        ) : (
                          <div className="h-full flex items-center justify-center opacity-50">
                             <p className={`${transcriptTextClass} text-gray-500 font-medium tracking-wide`}>
                               {isListening ? 'Listening...' : 'Click Play to start the live transcription.'}
                             </p>
                          </div>
                        )}
                     </div>
                  </div>
                )}

                {/* Bottom Lyric Dock */}
                {settings.showLyrics && settings.detectSongs && currentSong && currentSong.lyrics && currentSong.lyrics.length > 0 && (
                  <div className="absolute bottom-6 left-10 right-10 glass-panel p-6 bg-[#161b22]/90 border border-white/5 flex flex-col gap-4 z-10" style={blurStyle}>
                    <div className="flex items-center gap-3 text-gray-400 mb-2">
                      <Music size={16} />
                      <span className="text-xs uppercase tracking-wider font-semibold">
                        {currentSong.title}
                      </span>
                      <div className="flex-1 h-0.5 bg-white/10 mx-4 rounded-full overflow-hidden">
                        <div className={`h-full w-2/5 rounded-full ${bgClass}`} />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 pl-8">
                      <div className="relative">
                        <div className={`absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-[2px] rounded-r-md ${bgClass}`}></div>
                        <KaraokeLine 
                          lyric={mainLyric || '...'} 
                          spokenText={fullTranscript} 
                          colorClass={colorClass} 
                          animationClass={settings.highlightAnimation} 
                          sizeClass="text-[26px]"
                        />
                      </div>
                      {nextLyric && <p className="text-xl text-gray-400 italic font-serif opacity-80">{nextLyric}</p>}
                    </div>
                  </div>
                )}
              </>
            ) : activeView === 'settings' ? (
              <div className="absolute inset-0 z-10 flex">
                 <SettingsView settings={settings} onUpdate={updateSetting} />
              </div>
            ) : (
              // Placeholder for other views
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                 <div className="bg-[#1e1e1e] p-12 rounded-2xl border border-white/5 shadow-xl max-w-lg">
                    <h2 className="text-3xl text-white font-semibold mb-4 capitalize">{activeView} View</h2>
                    <p className="text-gray-400 text-lg leading-relaxed">
                      You navigated to the {activeView} module. Functionality for this view will be built out in the relevant subsystem structure. Return to "Live Session" via the sidebar monitor icon.
                    </p>
                    <button 
                      onClick={() => setActiveView('live')}
                      className="mt-8 bg-emerald-500 hover:bg-emerald-600 px-6 py-3 rounded-xl font-medium transition-colors"
                    >
                      Return to Live
                    </button>
                 </div>
              </div>
            )}
          </div>

          {/* Right Panel */}
          {isRightPanelOpen && (
            <aside className="w-[340px] bg-[#161616] border-l border-white/5 flex flex-col shadow-2xl shrink-0 z-20 animate-in slide-in-from-right-8 duration-300">
              <div className="h-[72px] flex items-center justify-between px-6 border-b border-white/5 font-medium text-sm text-gray-300">
                <button 
                  onClick={() => setIsRightPanelOpen(false)}
                  className="flex items-center gap-2 hover:text-white transition-colors capitalize">
                  <ChevronRight size={18} /> {rightPanelTab}
                </button>
                <button onClick={() => setProjector(true)} title="Launch Projector from Panel" className="p-1.5 hover:bg-white/5 rounded-md transition-colors text-gray-400 hover:text-white">
                  <LayoutGrid size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 pb-8 flex flex-col bg-[#0d0d0d]">
                
                {rightPanelTab === 'notes' && (
                  <div className="space-y-4">
                    {notes.length === 0 && (
                       <p className="text-gray-500 text-sm text-center mt-4">No notes for this session yet.</p>
                    )}
                    {notes.map(n => (
                      <div key={n.id} className="bg-[#1e1e1e] p-4 rounded-xl border border-white/5 shadow-sm text-[14px] text-gray-300 leading-relaxed hover:border-emerald-500/30 transition-colors cursor-default">
                        {n.content}
                      </div>
                    ))}
                  </div>
                )}

                {/* Scriptures Tab */}
                {rightPanelTab === 'scriptures' && (
                  <div className="space-y-6">
                    {displayVerse && settings.detectVerses ? (
                      <div className={`bg-[#1e1e1e] p-5 rounded-xl border shadow-sm animate-in fade-in ${borderClass}/50`}>
                        <h3 className={`${colorClass} font-semibold text-lg mb-3 tracking-tight`}>{displayVerse.reference} <span className="text-gray-500 font-normal text-xs ml-1">({displayVerse.translation || settings.bibleVersion})</span></h3>
                        <p className="text-gray-300 font-serif leading-relaxed text-[15px]">{displayVerse.text}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
                         <BookOpen size={24} className="mb-3 opacity-40" />
                         <p className="text-sm italic">Waiting for pastor to mention<br/>a scripture reference...</p>
                      </div>
                    )}
                  </div>
                )}

                {rightPanelTab === 'lyrics' && (
                  <div className="space-y-4">
                    <h3 className="text-white font-medium mb-1">Upcoming Verses</h3>
                    {!currentSong || !settings.detectSongs ? (
                      <p className="text-gray-500 text-sm italic">No worship song detected.</p>
                    ) : (
                      currentSong?.lyrics?.map((lyricLine) => (
                        <div 
                           key={lyricLine.order} 
                           onClick={() => setManualLineOffset(lyricLine.order - (currentLine ?? 0))}
                           className={`p-4 rounded-xl border shadow-sm text-gray-300 cursor-pointer hover:${borderClass}/50 transition-colors ${lyricLine.order === actualLineIndex ? `bg-[#1e1e1e] ${borderClass}/30` : 'bg-transparent border-white/5'}`}>
                          {lyricLine.line}
                          {lyricLine.order === actualLineIndex && <div className={`opacity-50 text-sm italic mt-2 ${colorClass}`}>Current Line</div>}
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>

              {rightPanelTab === 'notes' && (
                <div className="p-5 border-t border-white/5 bg-[#161616]">
                  <input 
                    type="text" 
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveNote()}
                    placeholder="Add a note..." 
                    className="w-full bg-[#1c1c1f] text-sm text-white placeholder-gray-500 rounded-lg px-4 py-3 outline-none border border-white/5 focus:border-emerald-500/50 transition-colors shadow-inner"
                  />
                </div>
              )}
            </aside>
          )}
          
        </div>
      </main>

      {/* Full Screen Projector Mode */}
      {isProjector && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-12">
          <button 
            onClick={() => setProjector(false)}
            className="absolute top-8 right-8 text-gray-500 hover:text-white p-2 transition-colors"
          >
            Esc
          </button>
          
          <div className="w-full max-w-7xl relative mx-auto h-[70vh] flex flex-col items-center justify-center text-center">
            {settings.showLyrics && settings.detectSongs && mainLyric && (
              <div className="w-full absolute bottom-12 flex flex-col items-center">
                <KaraokeLine 
                  lyric={mainLyric} 
                  spokenText={fullTranscript} 
                  colorClass={colorClass} 
                  animationClass={settings.highlightAnimation} 
                  sizeClass="text-[72px]"
                />
                {nextLyric && <p className="text-[40px] text-gray-500 italic mt-8">{nextLyric}</p>}
              </div>
            )}
            {settings.showVerse && settings.detectVerses && displayVerse && (!mainLyric || !settings.showLyrics) && (
              <div className="w-full absolute inset-0 flex flex-col justify-center px-12">
                <h2 className={`${colorClass} text-5xl font-semibold mb-10 tracking-wide uppercase`}>{displayVerse.reference} <span className="opacity-50 text-3xl font-normal ml-3">({displayVerse.translation || settings.bibleVersion})</span></h2>
                <p className="text-white/90 text-[64px] leading-[1.3] font-serif tracking-tight max-w-6xl mx-auto drop-shadow-xl">"{displayVerse.text}"</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
