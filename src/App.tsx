import React, { useState, useEffect } from 'react';
import { 
  Mic, Play, Pause, Square, Settings, Monitor, BookOpen, 
  Music, FileText, Save, History, Download, X, AlertCircle,
  Menu, ChevronRight, Cast, LayoutGrid, SkipBack, SkipForward,
  Activity, Clock, Trash2, Globe
} from 'lucide-react';
import { useLiveState } from './hooks/useLiveState';
import { useSync } from './hooks/useSync';
import { saveLiveState, getLiveState, saveNote, getNotes, saveSession, getSession } from './services/dbService';
import { getCurrentUser } from './services/authService';
import { Note } from './models/note';
import { Session } from './models/session';
import SettingsView from './components/SettingsView';
import KaraokeLine from './components/KaraokeLine';

export default function App() {
  const [activeView, setActiveView] = useState<'live' | 'history' | 'documents' | 'settings'>('live');
  const getFontSizeClass = (text: string) => {
    const len = text.length;
    if (len > 800) return 'text-lg sm:text-xl md:text-2xl font-bold leading-normal';
    if (len > 500) return 'text-xl sm:text-2xl md:text-3xl font-bold leading-normal';
    if (len > 300) return 'text-2xl sm:text-3xl md:text-4xl font-bold leading-relaxed';
    if (len > 150) return 'text-3xl sm:text-4xl md:text-5xl font-bold leading-tight';
    if (len > 80) return 'text-4xl sm:text-5xl md:text-6xl font-serif italic leading-tight';
    return 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-serif italic leading-tight';
  };

  const [isProjector, setProjector] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'scriptures' | 'lyrics' | 'notes'>('scriptures');
  const [session, setSession] = useState<Session>({
    id: 'session-' + Date.now(),
    name: 'Sunday Service - ' + new Date().toLocaleDateString(),
    status: 'live',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  const [user, setUser] = useState<any>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [manualLineOffset, setManualLineOffset] = useState(0);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('sermonsync_settings');
    return saved ? JSON.parse(saved) : {
      gain: 50,
      bibleVersion: 'KJV',
      secondaryBibleVersion: '',
      speechEngine: 'web',
      audioInput: 'live',
      showTranscript: true,
      showVerse: true,
      showLyrics: true,
      enableTranscription: true,
      verseSensitivity: 80,
      transcriptSize: 'medium',
      highlightColor: 'emerald',
      highlightAnimation: 'glow',
      transparency: 90,
      autoSave: true,
      saveHistory: true,
      autoAirVerses: false,
      timerDuration: 45,
      autoShowTimer: true,
      detectSongs: true,
      detectVerses: true,
      autoSyncLyrics: true,
      lyricsSource: 'local',
      aiVerseDetection: false,
      aiEndpoint: 'http://localhost:11434/api/generate',
      aiModel: 'llama3',
      aiApiKey: ''
    };
  });

  const [draftSettings, setDraftSettings] = useState(settings);
  const updateDraftSetting = (key: string, val: any) => setDraftSettings((prev: any) => ({ ...prev, [key]: val }));
  const commitSettings = () => {
    setSettings(draftSettings);
    localStorage.setItem('sermonsync_settings', JSON.stringify(draftSettings));
    showToast('Settings saved successfully!');
  };

  const { 
    liveState, interimText, currentSong, currentLine, currentVerse, isListening, 
    start, stop, clearText, clearPreview, applyLiveState, error, setError, goLive, setPreviewVerse, setSecondaryVerse
  } = useLiveState(
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
  }, [liveState.current_text, liveState.preview_text, interimText]);

  const [fetchedVerse, setFetchedVerse] = useState<{ reference: string; text: string; translation?: string } | null>(null);
  const [secondaryFetchedVerse, setSecondaryFetchedVerse] = useState<{ reference: string; text: string; translation?: string } | null>(null);

  const [timerSession, setTimerSession] = useState({ 
    isRunning: false, 
    remaining: (settings.timerDuration || 45) * 60,
    startTime: 0
  });

  useEffect(() => {
    let interval: any;
    if (timerSession.isRunning && timerSession.remaining > 0) {
      interval = setInterval(() => {
        setTimerSession(prev => ({ ...prev, remaining: prev.remaining - 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerSession.isRunning, timerSession.remaining]);

  const [bibleData, setBibleData] = useState<any[]>([]);
  const [selectedBook, setSelectedBook] = useState('Genesis');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [chapterText, setChapterText] = useState('Loading book...');

  const bibleBooks = [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
  ];

  useEffect(() => {
    const loadBibleData = async () => {
      const version = settings.bibleVersion.toLowerCase();
      try {
        const res = await fetch(`/bibles/${version}.json`);
        if (!res.ok) throw new Error(`Content not found: /bibles/${version}.json`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setBibleData(data);
          if (!data.find((b: any) => b.name === selectedBook || b.book === selectedBook)) {
            setSelectedBook(data[0]?.name || data[0]?.book || 'Genesis');
            setSelectedChapter(1);
          }
          return;
        }
        setBibleData([]);
      } catch (err) {
        setBibleData([]);
        console.warn('Bible data load failed:', err);
      }
    };

    loadBibleData();
  }, [settings.bibleVersion]);

  // Handle Bible Explorer Text
  useEffect(() => {
    if (!bibleData || bibleData.length === 0) {
      setChapterText('(Loading locally, or book unavailable for this translation)');
      return;
    }
    const book = bibleData.find((b: any) => (b.name || b.book || '').toLowerCase() === selectedBook.toLowerCase());
    if (!book || !Array.isArray(book.chapters)) {
      setChapterText('(Selected book data not found in translation)');
      return;
    }

    const chapters = book.chapters;
    const chapterIndex = Math.max(0, selectedChapter - 1);
    if (chapterIndex >= chapters.length) {
      setChapterText('(Chapter out of range)');
      return;
    }

    const passages = chapters[chapterIndex];
    setChapterText(
      passages.map((verse: string, idx: number) => `${selectedChapter}:${idx + 1} ${verse}`).join('\n\n')
    );
  }, [bibleData, selectedBook, selectedChapter]);

  // Handle Live Detection Verse Fetching
  useEffect(() => {
    const fetchVerseAction = async (ref: string, version: string, isSecondary: boolean) => {
      try {
        const apiRes = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${version}`);
        if (!apiRes.ok) throw new Error("API failed");
        const apiData = await apiRes.json();
        if (apiData.text) {
          const result = { reference: apiData.reference || ref, text: apiData.text.replace(/\n/g, ' ').trim(), translation: version };
          if (!isSecondary) setFetchedVerse(result);
          else setSecondaryFetchedVerse(result);
          return true;
        }
      } catch (e) {}

      try {
        const res = await fetch(`/bibles/${version.toLowerCase()}.json`);
        if (!res.ok) return false;
        const bibleDataLocal = await res.json();
        const verse = liveState.preview_verse || liveState.current_verse;
        if (!verse) return false;
        
        const book = bibleDataLocal.find((b: any) => (b.name || b.book || '').toLowerCase() === verse.book.toLowerCase());
        if (book && book.chapters && book.chapters[verse.chapter - 1]) {
           const text = book.chapters[verse.chapter - 1][verse.verse_start - 1];
           const result = { reference: ref, text, translation: version };
           if (!isSecondary) setFetchedVerse(result);
           else setSecondaryFetchedVerse(result);
           return true;
        }
      } catch (e) {}
      return false;
    };

    if (liveState.preview_verse) {
      const mainRef = `${liveState.preview_verse.book} ${liveState.preview_verse.chapter}:${liveState.preview_verse.verse_start}`;
      fetchVerseAction(mainRef, settings.bibleVersion, false);
      
      if (settings.secondaryBibleVersion) {
        fetchVerseAction(mainRef, settings.secondaryBibleVersion, true);
      } else {
        setSecondaryFetchedVerse(null);
      }
    } else if (liveState.current_verse) {
       const mainRef = `${liveState.current_verse.book} ${liveState.current_verse.chapter}:${liveState.current_verse.verse_start}`;
       fetchVerseAction(mainRef, settings.bibleVersion, false);
    } else {
      setFetchedVerse(null);
      setSecondaryFetchedVerse(null);
    }
  }, [liveState.preview_verse, liveState.current_verse, settings.bibleVersion, settings.secondaryBibleVersion]);

  // Hook into auto-air logic
  useEffect(() => {
    if (settings.autoAirVerses && liveState.preview_verse && (!liveState.current_verse || liveState.preview_verse.book !== liveState.current_verse.book || liveState.preview_verse.verse_start !== liveState.current_verse.verse_start)) {
      goLive();
    }
  }, [liveState.preview_verse, settings.autoAirVerses, goLive, liveState.current_verse]);

  useEffect(() => {
    (async () => {
      const existingUser = await getCurrentUser();
      if (existingUser && (!user || existingUser.id !== user.id)) {
        setUser(existingUser);
      }
      
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
      console.error('Unable to persist note', err);
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
    
    try {
      if (window.sermonSync?.db?.saveNote) {
        window.sermonSync.db.saveNote(noteObj);
      }
    } catch (e) {}
  };

  const displayVersePreview = liveState.preview_verse 
    ? fetchedVerse 
      ? fetchedVerse
      : { reference: `${liveState.preview_verse.book} ${liveState.preview_verse.chapter}:${liveState.preview_verse.verse_start}`, text: 'Retrieving passage...', translation: settings.bibleVersion } 
    : null;

  const displayVerseLive = liveState.current_verse
    ? fetchedVerse && fetchedVerse.reference.includes(liveState.current_verse.book)
      ? fetchedVerse
      : { reference: `${liveState.current_verse.book} ${liveState.current_verse.chapter}:${liveState.current_verse.verse_start}`, text: 'Live on Screen', translation: settings.bibleVersion }
    : null;

  const fullTranscript = (liveState.current_text + ' ' + (interimText || '')).trim();

  // Lyrics calculation
  const baseLineIndex = settings.autoSyncLyrics ? (currentLine ?? 0) : 0;
  const actualLineIndex = Math.max(0, baseLineIndex + manualLineOffset);
  const mainLyric = currentSong?.lyrics?.find(l => l.order === actualLineIndex)?.line || '';
  const nextLyric = currentSong?.lyrics?.find(l => l.order === actualLineIndex + 1)?.line || '';

  const handleNext = () => setManualLineOffset(prev => prev + 1);
  const handlePrev = () => setManualLineOffset(prev => prev - 1);

  // Styling
  const colorClass = settings.highlightColor === 'gold' ? 'text-amber-400' : settings.highlightColor === 'blue' ? 'text-blue-400' : 'text-emerald-400';
  const bgClass = settings.highlightColor === 'gold' ? 'bg-amber-500' : settings.highlightColor === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
  const borderClass = settings.highlightColor === 'gold' ? 'border-amber-500' : settings.highlightColor === 'blue' ? 'border-blue-500' : 'border-emerald-500';
  const animationClass = settings.highlightAnimation === 'glow' ? `drop-shadow-[0_0_12px_rgba(currentColor,0.4)]` : settings.highlightAnimation === 'fade' ? 'animate-pulse' : '';
  
  const transcriptTextClass = settings.transcriptSize === 'small' ? 'text-xl' : settings.transcriptSize === 'medium' ? 'text-2xl' : 'text-3xl';
  const projectorTextClass1 = settings.transcriptSize === 'small' ? 'text-4xl' : settings.transcriptSize === 'medium' ? 'text-5xl' : 'text-6xl';

  if (isProjector) {
    const minutes = Math.floor(timerSession.remaining / 60);
    const seconds = timerSession.remaining % 60;
    
    return (
      <div className="flex h-screen w-full bg-[#000000] text-white font-sans overflow-hidden select-none relative px-12 py-12">
        <button onClick={() => setProjector(false)} className="absolute top-6 right-6 p-4 text-white/20 hover:text-white/80 transition-opacity z-50">
           <X size={32} />
        </button>

        {/* Countdown Timer */}
        {settings.autoShowTimer && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-8 py-4 glass-panel bg-red-600/20 border border-red-500/30 rounded-full z-50">
            <span className="text-4xl font-mono font-bold text-red-400">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center items-center w-full max-w-6xl mx-auto space-y-12">
           {settings.showVerse && displayVerseLive && settings.detectVerses && (
              <div className="z-10 w-full max-w-4xl glass-panel p-10 shadow-2xl bg-[#1a1a1a]/90 border-t border-white/10" style={{ backdropFilter: `blur(${settings.transparency/5 + 5}px)` }}>
                <div className="flex gap-10">
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                      <h4 className={`${colorClass} font-medium pb-4 border-b border-white/10 mb-4 text-xl`}>{displayVerseLive.reference} <span className="text-gray-500 font-normal">({settings.bibleVersion})</span></h4>
                      <p className={`${getFontSizeClass(displayVerseLive.text)} text-gray-200 text-center drop-shadow-md`}>{displayVerseLive.text}</p>
                    </div>
                   {secondaryFetchedVerse && settings.secondaryBibleVersion && (
                       <div className="flex-1 border-l border-white/10 pl-10 overflow-y-auto custom-scrollbar">
                        <h4 className="text-emerald-400 font-medium pb-4 border-b border-white/10 mb-4 text-xl">{secondaryFetchedVerse.reference} <span className="text-gray-500 font-normal">({settings.secondaryBibleVersion})</span></h4>
                        <p className={`${getFontSizeClass(secondaryFetchedVerse.text)} text-gray-300 text-center drop-shadow-md italic`}>{secondaryFetchedVerse.text}</p>
                      </div>
                   )}
                </div>
              </div>
           )}
           {(!displayVerseLive || !settings.showVerse) && settings.showTranscript && settings.enableTranscription && (
             <div className="w-full px-12 text-center z-0">
                <p className={`${projectorTextClass1} text-white leading-relaxed font-medium tracking-tight whitespace-pre-wrap transition-all duration-1000`}>
                   {(liveState.current_text || '').split(' ').slice(-100).join(' ') || (isListening ? 'Listening...' : 'Screen is clear')}
                </p>
             </div>
           )}
        </div>
        
        {settings.showLyrics && settings.detectSongs && currentSong && (
           <div className="absolute bottom-12 left-12 right-12 glass-panel p-8 bg-[#111111]/90 border border-white/10 text-center" style={{ backdropFilter: `blur(${settings.transparency/5 + 5}px)` }}>
              <KaraokeLine 
                lyric={mainLyric || '...'} 
                spokenText={fullTranscript} 
                colorClass={colorClass} 
                animationClass={settings.highlightAnimation} 
                sizeClass="text-5xl"
              />
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
        <button className="p-3 hover:bg-white/5 rounded-xl mb-8 transition-colors">
          <Menu size={24} className={activeView === 'settings' ? 'text-white' : 'text-gray-400'} />
        </button>
        <nav className="flex flex-col gap-6 w-full px-3">
          <button onClick={() => setActiveView('live')} className={`flex justify-center p-3 rounded-xl relative transition-colors ${activeView === 'live' ? 'bg-red-500/10 text-red-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Live Session">
            <Monitor size={22} />
          </button>
          <button onClick={() => setActiveView('history')} className={`flex justify-center p-3 rounded-xl relative transition-colors ${activeView === 'history' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="History">
            <BookOpen size={22} />
          </button>
          <button onClick={() => setActiveView('settings')} className={`flex justify-center p-3 rounded-xl relative transition-colors mt-auto ${activeView === 'settings' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} title="Settings">
            <Settings size={22} />
          </button>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-[#1a2332]/40 via-[#121212] to-[#121212]">
        
        {/* Error Toast */}
        {error && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in flex items-center gap-3 bg-red-500/90 backdrop-blur-md text-white px-5 py-3 rounded-xl border border-red-400/30">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)}><X size={14} /></button>
          </div>
        )}

        {/* Top Navbar */}
        <header className="h-[72px] flex items-center justify-between px-6 border-b border-white/5 bg-transparent z-10 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-red-500 rounded-md px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
              <span className="text-[11px] font-bold text-white tracking-widest uppercase">LIVE</span>
            </div>
            
            <div className="flex items-center gap-1 bg-[#1e1e24]/80 p-0.5 rounded-lg border border-white/5">
              <button 
                onClick={() => setTimerSession(prev => ({ ...prev, isRunning: !prev.isRunning }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all ${timerSession.isRunning ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/5 text-gray-400 border border-white/5'}`}>
                Timer
              </button>
              <button onClick={() => setTimerSession(prev => ({ ...prev, remaining: (settings.timerDuration || 45) * 60, isRunning: false }))} className="p-1.5 text-gray-500 hover:text-white"><X size={12} /></button>
              
              <div className="w-px h-5 bg-white/10 mx-1"></div>
              
              <button onClick={handleSnapshotToNotes} className="px-3 py-1.5 flex items-center gap-2 text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md">
                <Save size={14} /> Clear Screen
              </button>
              
              <div className="w-px h-5 bg-white/10 mx-1"></div>
              
              <button onClick={isListening ? stop : start} className={`p-2 transition-colors ${colorClass}`}>
                {isListening ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
              
              <button onClick={goLive} className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${liveState.is_live_dirty ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-700 text-gray-400'}`} disabled={!liveState.is_live_dirty}>
                <SkipForward size={18} fill="currentColor" /> GO LIVE
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-gray-400 h-full">
              <button onClick={() => { setRightPanelTab('scriptures'); setIsRightPanelOpen(true); }} className={`flex items-center gap-2 transition-colors h-[72px] relative ${rightPanelTab === 'scriptures' ? colorClass : 'hover:text-white'}`}>
                <BookOpen size={16} /> Scriptures
              </button>
              <button onClick={() => { setRightPanelTab('notes'); setIsRightPanelOpen(true); }} className={`flex items-center gap-2 transition-colors h-[72px] relative ${rightPanelTab === 'notes' ? colorClass : 'hover:text-white'}`}>
                <FileText size={16} /> Notes
              </button>
            </nav>
            <div className="flex items-center gap-4 text-gray-400 font-mono text-xl">
               {Math.floor(timerSession.remaining / 60)}:{String(timerSession.remaining % 60).padStart(2, '0')}
            </div>
            <button onClick={() => setProjector(true)} className="p-2 hover:text-white transition-colors"><Cast size={20} /></button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          
          <div className="flex-1 flex flex-col relative px-10 py-8 overflow-hidden z-0">
            {activeView === 'live' ? (
              <div className="flex-1 flex gap-8 overflow-hidden">
                
                {/* PREVIEW PANE */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#1a1a1e] rounded-3xl border border-white/5 relative overflow-hidden">
                  <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                    {liveState.is_analyzing ? (
                      <span className="flex items-center gap-1.5">
                        <Activity size={10} className="animate-pulse" /> AI ANALYZING INTENT...
                      </span>
                    ) : (
                      "PREVIEW / STAGING"
                    )}
                  </div>
                  
                  <button 
                    onClick={clearPreview}
                    className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-all"
                    title="Clear Preview"
                  >
                    <X size={16} />
                  </button>
                  
                  {displayVersePreview && settings.detectVerses ? (
                    <div className="w-full space-y-6">
                      <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                        <h4 className={`${colorClass} font-bold text-xl mb-2`}>{displayVersePreview.reference} <span className="text-gray-500 font-normal">({settings.bibleVersion})</span></h4>
                        <p className="text-white text-xl leading-relaxed font-serif">{displayVersePreview.text}</p>
                      </div>
                      {secondaryFetchedVerse && settings.secondaryBibleVersion && (
                        <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                          <h4 className="text-emerald-400 font-bold text-xl mb-2">{secondaryFetchedVerse.reference} <span className="text-gray-500 font-normal">({settings.secondaryBibleVersion})</span></h4>
                          <p className="text-gray-200 text-xl leading-relaxed font-serif">{secondaryFetchedVerse.text}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full text-center">
                      <p className={`${transcriptTextClass} text-white/90 leading-relaxed font-medium`}>
                        {(liveState.preview_text || '').split(' ').slice(-20).join(' ') || (interimText ? interimText : 'Listening...')}
                      </p>
                    </div>
                  )}
                </div>

                  <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black rounded-3xl border-2 border-red-500/20 shadow-2xl relative">
                    <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded">
                      LIVE ON SCREEN
                    </div>

                    {displayVerseLive && settings.detectVerses ? (
                      <div className="w-full flex flex-col items-center justify-center space-y-4">
                         <h4 className={`${colorClass} font-bold text-xl mb-2`}>{displayVerseLive.reference}</h4>
                         <p className={`${getFontSizeClass(displayVerseLive.text)} text-white/90 text-center drop-shadow-2xl`}>
                            {displayVerseLive.text}
                         </p>
                      </div>
                    ) : (
                      <p className="text-white/40 text-lg font-medium text-center">
                        {(liveState.current_text || '').split(' ').slice(-10).join(' ') || 'Screen is clear'}
                      </p>
                    )}
                  </div>
                </div>
              ) : activeView === 'settings' ? (
              <div className="absolute inset-0 z-10 flex">
                 <SettingsView settings={draftSettings} onUpdate={updateDraftSetting} onSave={commitSettings} />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                 <h2 className="text-3xl text-white font-semibold mb-4 capitalize">{activeView} View</h2>
              </div>
            )}
          </div>

          {/* Right Panel */}
          {isRightPanelOpen && (
            <aside className="w-[340px] bg-[#161616] border-l border-white/5 flex flex-col shrink-0 z-20">
              <div className="h-[72px] flex items-center justify-between px-6 border-b border-white/5 text-sm text-gray-300">
                <button onClick={() => setIsRightPanelOpen(false)} className="flex items-center gap-2 hover:text-white capitalize">
                  <ChevronRight size={18} /> {rightPanelTab}
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 pb-8 flex flex-col bg-[#0d0d0d]">
                {rightPanelTab === 'scriptures' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 uppercase">Book</label>
                        <select value={selectedBook} onChange={(e) => { setSelectedBook(e.target.value); setSelectedChapter(1); }} className="w-full mt-1 bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                          {bibleBooks.map((book) => <option key={book} value={book}>{book}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase">Chapter</label>
                        <input type="number" min={1} value={selectedChapter} onChange={(e) => setSelectedChapter(Number(e.target.value))} className="w-full mt-1 bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                      </div>
                    </div>

                    <div className="bg-[#1e1e1e] p-4 rounded-xl border border-white/10">
                      <h3 className={`${colorClass} font-semibold mb-2`}>{selectedBook} {selectedChapter}</h3>
                      <div className="max-h-[250px] overflow-y-auto text-sm whitespace-pre-wrap text-gray-200 font-serif">{chapterText}</div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <button 
                        onClick={() => {
                          const content = `SERMON SUMMARY: ${session.name}\n\n` + liveState.history.map(h => `[${new Date(h.timestamp).toLocaleTimeString()}] ${h.type.toUpperCase()}: ${h.reference || ''} ${h.content}`).join('\n');
                          const blob = new Blob([content], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `summary-${session.id}.txt`;
                          a.click();
                        }}
                        className="w-full py-2 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                        Download Summary
                      </button>
                    </div>
                  </div>
                )}

                {rightPanelTab === 'notes' && (
                  <div className="space-y-4">
                    {notes.map(n => (
                      <div key={n.id} className="bg-[#1e1e1e] p-4 rounded-xl border border-white/5 text-sm text-gray-300">{n.content}</div>
                    ))}
                    <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveNote()} placeholder="Add a note..." className="w-full bg-[#1c1c1f] text-sm text-white rounded-lg px-4 py-3 outline-none border border-white/5" />
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
