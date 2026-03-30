import React, { useEffect, useMemo, useState } from 'react';
import { 
  Menu, Play, Pause, SkipForward, SkipBack, 
  BookOpen, Music, FileText, Settings, 
  Monitor, Cast, LayoutGrid, ChevronRight, X, Save, AlertCircle,
  Activity, Radio
} from 'lucide-react';
import { useLiveState } from './hooks/useLiveState';
import { LiveState } from './models/liveState';
import { useSync } from './hooks/useSync';
import { Session } from './models/session';
import { Note } from './models/note';
import { User } from './models/user';
import { login, logout, getCurrentUser } from './services/authService';
import { getNotes, saveNote, saveLiveState, getLiveState, saveSession, getSession } from './services/dbService';
import SettingsView from './components/SettingsView';

const SESSION_ID = 'service-001';

type ViewMode = 'live' | 'history' | 'documents' | 'settings';
type RightPanelTab = 'scriptures' | 'lyrics' | 'notes' | 'broadcast';
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
    speechEngine: 'deepgram',
    whisperApiKey: import.meta.env.VITE_DEEPGRAM_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || '',
    accuracyLevel: 95,
    languageModel: 'whisper-1',
    detectVerses: true,
    verseSensitivity: 60,
    bibleVersion: 'KJV',
    aiVerseDetection: true,
    aiEndpoint: 'https://api.openai.com/v1/chat/completions',
    aiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
    aiModel: 'gpt-4o-mini',
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
    alertVisual: true,
    autoAirVerses: false,
    secondaryBibleVersion: '',
    timerDuration: 45,
    autoShowTimer: false,
    projectorBg: '/worship-bg.png', // obsidian/emerald
  });

  const [draftSettings, setDraftSettings] = useState<typeof settings>(settings);

  const updateDraftSetting = (key: string, value: any) => {
    setDraftSettings(prev => ({ ...prev, [key as keyof typeof settings]: value }));
  };

  const commitSettings = () => {
    setSettings(draftSettings);
    showToast('Settings saved successfully!');
  };

  const { 
    liveState, interimText, currentSong, currentLine, currentVerse, isListening, 
    start, stop, clearText, applyLiveState, error, setError, goLive, setPreviewVerse, setSecondaryVerse, removeDetection, setLiveState
  } = useLiveState(
    session.id, 
    settings.speechEngine as 'web'|'worker'|'whisper'|'groq'|'deepgram', 
    { 
      apiKey: (settings.speechEngine === 'deepgram') ? (import.meta.env.VITE_DEEPGRAM_API_KEY || settings.whisperApiKey) : settings.whisperApiKey, 
      endpoint: '', 
      audioInput: settings.audioInput as 'live' | 'system' 
    },
    { enabled: settings.aiVerseDetection, endpointUrl: settings.aiEndpoint, apiKey: settings.aiApiKey, modelName: settings.aiModel }
  );

  // Helpers for transcription column (Now using preview_text for permanence)
  const sentences = useMemo(() => (liveState?.preview_text || '').split('. ').filter(s => s.trim().length > 0), [liveState?.preview_text]);
  const { connected } = useSync(session.id, liveState, applyLiveState);

  const transcriptScrollRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
     if (transcriptScrollRef.current) {
        transcriptScrollRef.current.scrollTo({ top: transcriptScrollRef.current.scrollHeight, behavior: 'smooth' });
     }
  }, [liveState.preview_text, interimText]);

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

  const bibleVersions = ['KJV', 'NIV', 'NLT', 'TPT'];
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

  useEffect(() => {
    const fetchVerse = async (ref: string, version: string, isSecondary: boolean) => {
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
        const verse = liveState.preview_verse;
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
      fetchVerse(mainRef, settings.bibleVersion, false);
      
      if (settings.secondaryBibleVersion) {
        fetchVerse(mainRef, settings.secondaryBibleVersion, true);
      } else {
        setSecondaryFetchedVerse(null);
      }
    } else {
      setFetchedVerse(null);
      setSecondaryFetchedVerse(null);
    }
  }, [liveState.preview_verse, settings.bibleVersion, settings.secondaryBibleVersion]);

  // Hook into auto-air logic
  useEffect(() => {
    if (settings.autoAirVerses && liveState.preview_verse && liveState.preview_verse !== liveState.current_verse) {
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

  const displayVersePreview = liveState.preview_verse 
    ? fetchedVerse 
      ? fetchedVerse
      : { reference: `${liveState.preview_verse.book} ${liveState.preview_verse.chapter}:${liveState.preview_verse.verse_start}${liveState.preview_verse.verse_end && liveState.preview_verse.verse_end > liveState.preview_verse.verse_start ? `-${liveState.preview_verse.verse_end}` : ''}`, text: 'Retrieving passage...', translation: settings.bibleVersion } 
    : null;

  const displayVerseLive = liveState.current_verse
    ? fetchedVerse && fetchedVerse.reference.includes(liveState.current_verse.book)
      ? fetchedVerse
      : { reference: `${liveState.current_verse.book} ${liveState.current_verse.chapter}:${liveState.current_verse.verse_start}${liveState.current_verse.verse_end && liveState.current_verse.verse_end > liveState.current_verse.verse_start ? `-${liveState.current_verse.verse_end}` : ''}`, text: 'Live on Screen', translation: settings.bibleVersion }
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

  const transcriptTextClass = settings.transcriptSize === 'small' ? 'text-xl' : settings.transcriptSize === 'medium' ? 'text-2xl' : 'text-3xl';
  const projectorTextClass1 = settings.transcriptSize === 'small' ? 'text-4xl' : settings.transcriptSize === 'medium' ? 'text-5xl' : 'text-6xl';
  const projectorTextClass2 = settings.transcriptSize === 'small' ? 'text-3xl' : settings.transcriptSize === 'medium' ? 'text-4xl' : 'text-5xl';
  const projectorTextClass3 = settings.transcriptSize === 'small' ? 'text-2xl' : settings.transcriptSize === 'medium' ? 'text-3xl' : 'text-4xl';

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
                   <div className="flex-1">
                     <h4 className={`${colorClass} font-medium pb-4 border-b border-white/10 mb-4 text-xl`}>{displayVerseLive.reference} <span className="text-gray-500 font-normal">({settings.bibleVersion})</span></h4>
                     <p className="text-gray-200 text-3xl leading-relaxed font-serif">{displayVerseLive.text}</p>
                   </div>
                   {secondaryFetchedVerse && (
                     <div className="flex-1 border-l border-white/10 pl-10">
                       <h4 className="text-emerald-400 font-medium pb-4 border-b border-white/10 mb-4 text-xl">{secondaryFetchedVerse.reference} <span className="text-gray-500 font-normal">({settings.secondaryBibleVersion})</span></h4>
                       <p className="text-gray-300 text-3xl leading-relaxed font-serif italic">{secondaryFetchedVerse.text}</p>
                     </div>
                   )}
                </div>
              </div>
           )}
           {(!displayVerseLive || !settings.showVerse) && settings.showTranscript && settings.enableTranscription && (
             <div className="w-full space-y-8 px-24 text-center z-0">
                <p className={`${projectorTextClass1} text-white leading-normal font-medium tracking-tight whitespace-pre-wrap`}>
                  {liveState.current_text.split(' ').slice(-30).join(' ') || (isListening ? 'Listening...' : 'Click Play to start the live transcription.')}
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
              <button 
                onClick={() => setTimerSession(prev => ({ ...prev, isRunning: !prev.isRunning }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${timerSession.isRunning ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'}`}
                title={timerSession.isRunning ? "Pause Stage Timer" : "Start Stage Timer"}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${timerSession.isRunning ? 'bg-red-400 animate-pulse' : 'bg-gray-500'}`}></div>
                Timer
              </button>
              <button 
                onClick={() => setTimerSession(prev => ({ ...prev, remaining: (settings.timerDuration || 45) * 60, isRunning: false }))}
                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                title="Reset Timer"
              >
                <X size={12} />
              </button>
              <div className="w-px h-5 bg-white/10 mx-1"></div>
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
                onClick={goLive}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${liveState.is_live_dirty ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-gray-700 text-gray-400 opacity-50 cursor-not-allowed'}`}
                disabled={!liveState.is_live_dirty}
              >
                <SkipForward size={18} fill="currentColor" /> GO LIVE (AIR)
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
              <button 
                onClick={() => { setRightPanelTab('broadcast'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-2 transition-colors h-[72px] relative ${rightPanelTab === 'broadcast' ? colorClass : 'hover:text-white'}`}>
                <Radio size={16} /> Broadcast
                {rightPanelTab === 'broadcast' && <div className={`absolute bottom-0 left-0 right-0 h-1 ${bgClass} rounded-t-full`}></div>}
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
        <div className="flex-1 flex overflow-hidden bg-black/20">
          
          {/* COLUMN 1: INTEGRATED FEED (LEFT) */}
          <section className="w-[280px] flex flex-col bg-[#161616] border-r border-white/5 shrink-0 animate-in slide-in-from-left-8 duration-500 overflow-hidden">
             
             {/* TOP: LIVE TRANSCRIPTION */}
             <div className="flex-[0.6] flex flex-col min-h-0 border-b border-white/5">
                <div className="h-[56px] p-4 flex items-center justify-between bg-[#1a1a1e] border-b border-white/5">
                   <div className="flex items-center gap-2">
                      <Activity size={14} className="text-emerald-500 animate-pulse" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Transcript</h3>
                   </div>
                   {isListening && <span className="text-[8px] font-bold text-emerald-500/60 uppercase tracking-widest">Live</span>}
                </div>
                
                <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar bg-[#0f0f12]">
                {sentences.length === 0 && !interimText ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                     <FileText size={24} className="mb-2" />
                     <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Feed Initialized</p>
                  </div>
                ) : (
                  sentences.map((line, i) => {
                    const isTopic = /topic[:\-]/i.test(line);
                    const isPoint = /^(?:point|number|no\.?)\s*\d+[:\-]?/i.test(line.trim());
                    
                    return (
                      <div key={i} className={`flex flex-col gap-1.5 group animate-in slide-in-from-bottom-1 duration-300 ${isTopic ? 'mt-6 mb-2' : isPoint ? 'mt-4' : ''}`}>
                         <div className="flex items-center justify-between opacity-30">
                            <span className={`text-[8px] font-black uppercase tracking-widest ${isTopic ? 'text-blue-400' : isPoint ? 'text-amber-400' : 'text-emerald-500/60'}`}>
                               {isTopic ? 'New Segment' : isPoint ? 'Structural Point' : 'Live Feed'}
                            </span>
                            <span className="text-[8px] font-mono text-gray-600">[{new Date(Date.now() - (sentences.length - i) * 2000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}]</span>
                         </div>
                         <p className={`leading-relaxed transition-all ${
                            isTopic 
                              ? 'text-lg font-black text-white py-2 border-b-2 border-blue-500/30 tracking-tight' 
                              : isPoint 
                                ? 'text-sm font-bold text-amber-200 border-l-2 border-amber-500/40 pl-3 italic'
                                : line.toLowerCase().includes(selectedBook.toLowerCase()) 
                                  ? 'text-xs text-emerald-400 font-bold border-l-2 border-emerald-500/40 pl-3 shadow-glow' 
                                  : 'text-xs text-gray-400 group-hover:text-gray-200 font-medium'
                         }`}>
                            {displayVerseLive && line.split(' ').some(w => displayVerseLive.text.toLowerCase().includes(w.toLowerCase())) ? (
                                <KaraokeLine 
                                   lyric={line.trim() + (line.endsWith('.') ? '' : '.')}
                                   spokenText={displayVerseLive.text}
                                   colorClass={colorClass}
                                   animationClass="glow"
                                   sizeClass="text-xs"
                                />
                             ) : (
                                <span>{line.trim()}{line.endsWith('.') ? '' : '.'}</span>
                             )}
                         </p>
                      </div>
                    );
                  })
                )}
                {interimText && (
                  <div className="flex flex-col gap-1 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between opacity-30">
                       <span className="text-[8px] font-black text-blue-400 uppercase">Live Interim</span>
                       <span className="text-[8px] font-mono text-gray-600">Now</span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed font-medium underline decoration-blue-500/30 underline-offset-4">{interimText}...</p>
                  </div>
                )}
             </div>
             </div>

             {/* BOTTOM: QUEUE */}
             <div className="flex-[0.4] flex flex-col min-h-0 bg-[#0a0a0c]">
                <div className="h-[48px] p-4 flex items-center gap-2 bg-black/40 border-b border-white/5">
                   <LayoutGrid size={14} className="text-blue-400" />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Queue</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                   {liveState.detection_history.length === 0 ? (
                      <p className="text-[9px] text-gray-700 italic text-center mt-4 uppercase tracking-widest opacity-30">Queue is empty</p>
                   ) : (
                      liveState.detection_history.map((det) => (
                        <div 
                           key={det.id} 
                           className="relative flex flex-col p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/8 hover:border-emerald-500/40 transition-all cursor-pointer group shadow-lg active:scale-[0.98]"
                        >
                           <div className="flex items-center justify-between mb-2">
                              <span className="text-[8px] font-black text-emerald-500/40 uppercase group-hover:text-emerald-500 transition-colors">Detected</span>
                              <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                 <button 
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       removeDetection(det.id);
                                    }}
                                    className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors"
                                 >
                                    <X size={10} />
                                 </button>
                              </div>
                           </div>
                           <div className="flex items-end justify-between" onClick={() => setPreviewVerse(det.verse)}>
                              <div>
                                 <p className="text-[11px] font-bold text-white mb-0.5">{det.verse.book} {det.verse.chapter}:{det.verse.verse_start}</p>
                                 <p className="text-[8px] font-mono text-gray-600 tracking-tighter uppercase">{new Date(det.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</p>
                              </div>
                              <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                                 <Play size={10} fill="currentColor" />
                              </div>
                           </div>
                        </div>
                      ))
                   )}
                </div>
             </div>
          </section>
          
          {/* Main Content Area based on ViewMode */}
          <div className="flex-1 flex flex-col relative px-10 py-8 overflow-hidden z-0">
            {activeView === 'live' ? (
              <>
              <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                {/* Center Header: Same-Height Side-by-Side Preview and Live */}
                <div className="flex items-start gap-4 h-[300px] p-1 shrink-0">
                   
                   {/* PREVIEW PANE (Top Left - Square) */}
                   <div className="h-full aspect-square flex flex-col items-center justify-center p-6 bg-[#1a1a1e] rounded-3xl border border-white/5 relative overflow-hidden group shrink-0">
                     <div className="absolute top-4 left-4 flex items-center gap-2 text-[9px] font-bold tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                       PREVIEW
                     </div>
                     
                    {displayVersePreview && settings.detectVerses ? (
                       <div className="w-full h-full flex flex-col justify-between">
                         <div className="text-center space-y-3">
                            <h4 className={`${colorClass} font-bold text-sm tracking-wide uppercase`}>{displayVersePreview.reference}</h4>
                            <p className="text-white text-[13px] leading-relaxed font-serif line-clamp-5 italic">"{displayVersePreview.text}"</p>
                         </div>
                         
                         <button 
                           onClick={goLive}
                           className="w-full mt-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-pulse active:scale-95 transition-all flex items-center justify-center gap-2"
                         >
                           <SkipForward size={14} fill="currentColor" /> GO LIVE (AIR)
                         </button>
                       </div>
                     ) : (
                       <div className="w-full text-center opacity-30 group-hover:opacity-50 transition-opacity">
                         <div className="relative inline-block mb-4">
                            <FileText size={48} className="mx-auto text-gray-400" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-ping"></div>
                         </div>
                         <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-300">Ready to Stage</p>
                         <p className="text-[8px] text-gray-500 mt-1 uppercase">Click Queue or Speak Verse</p>
                       </div>
                     )}
                   </div>

                   {/* LIVE ON SCREEN (Top Right - Landscape) */}
                   <div className="h-full flex-1 flex flex-col items-center justify-center p-8 bg-black rounded-3xl border-2 border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden group">
                      {/* MIRROR BACKGROUND */}
                      <div 
                         className="absolute inset-0 bg-cover bg-center brightness-[0.35] saturate-[0.8] opacity-60 group-hover:opacity-100 transition-opacity duration-1000"
                         style={{ backgroundImage: `url('${settings.projectorBg}')` }}
                      />
                      
                      <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold tracking-widest text-red-500 bg-red-500/10 px-3 py-1 rounded-full z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        LIVE ON SCREEN
                      </div>

                      {displayVerseLive && settings.detectVerses ? (
                        <div className="w-full text-center animate-in fade-in duration-500 px-4 z-10">
                           <h4 className={`${colorClass} font-bold text-lg mb-2 tracking-wide uppercase drop-shadow-glow`}>{displayVerseLive.reference}</h4>
                           <p className="text-white text-xl lg:text-2xl leading-tight font-serif italic line-clamp-4">"{displayVerseLive.text}"</p>
                        </div>
                      ) : currentSong && settings.detectSongs && mainLyric ? (
                        <div className="w-full text-center animate-in slide-in-from-bottom-4 duration-500 px-4 z-10">
                           <p className={`text-2xl lg:text-3xl font-black ${colorClass} tracking-tight leading-none drop-shadow-glow mb-2`}>{mainLyric}</p>
                           {nextLyric && <p className="text-white/40 text-sm italic">{nextLyric}</p>}
                        </div>
                      ) : (
                        <p className="text-white/40 text-sm font-medium max-w-lg text-center leading-relaxed italic animate-pulse px-4 z-10">
                          {liveState.current_text.split(' ').slice(-50).join(' ') || 'Screen is clear'}
                        </p>
                      )}

                      {/* MIRROR TICKER */}
                      {liveState.ticker_enabled && liveState.ticker_items && liveState.ticker_items.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-red-600/20 backdrop-blur-md border-t border-red-500/30 flex items-center overflow-hidden z-10">
                           <div className="flex whitespace-nowrap animate-marquee-fast py-1 px-4 text-[9px] font-bold text-white/80 uppercase tracking-widest">
                              {liveState.ticker_items.join(' • ')} • {liveState.ticker_items.join(' • ')}
                           </div>
                        </div>
                      )}
                   </div>
                </div>

                {/* BOTTOM BLOCK: UNTOUCHED PLACEHOLDER */}
                <div className="flex-1 bg-transparent border border-white/5 border-dashed rounded-3xl flex items-center justify-center relative group overflow-hidden">
                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02),transparent)] opacity-20" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/10 select-none">Expansion Zone</p>
                </div>
              </div>

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
                 <SettingsView settings={draftSettings} onUpdate={updateDraftSetting} onSave={commitSettings} />
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
                
                {/* Broadcast Hub (The News Ticker Editor) */}
                {rightPanelTab === 'broadcast' && (
                  <div className="space-y-6 animate-in slide-in-from-right-4">
                     <div className="flex items-center justify-between">
                       <div>
                         <h3 className="text-white font-bold text-lg mb-0.5 flex items-center gap-2">
                           <Radio size={18} className="text-red-500 animate-pulse" /> Live Broadcast
                         </h3>
                         <p className="text-gray-500 text-[9px] uppercase tracking-widest font-black leading-tight">Infinite News Ticker Control</p>
                       </div>
                       <input 
                         type="checkbox" 
                         checked={liveState.ticker_enabled ?? true} 
                         onChange={(e) => setLiveState((s: LiveState) => ({ ...s, ticker_enabled: e.target.checked, updated_at: new Date().toISOString() }))}
                         className="accent-emerald-500 h-5 w-5 bg-black cursor-pointer"
                       />
                     </div>

                     <div className="bg-[#1e1e1e] p-5 rounded-2xl border border-white/5 space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Add Scrolling Headline</label>
                        <input 
                          type="text" 
                          placeholder="Type breaking news..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                          onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                                const msg = (e.target as HTMLInputElement).value;
                                if (msg) {
                                   setLiveState((s: LiveState) => ({ ...s, ticker_items: [...(s.ticker_items || []), msg], updated_at: new Date().toISOString() }));
                                   (e.target as HTMLInputElement).value = '';
                                }
                             }
                          }}
                        />
                     </div>

                     <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Queue</span>
                           <button 
                             onClick={() => setLiveState((s: LiveState) => ({ ...s, ticker_items: [], updated_at: new Date().toISOString() }))}
                             className="text-[10px] uppercase text-red-500 hover:text-red-400 font-black"
                           >
                             Clear All
                           </button>
                        </div>
                        <div className="space-y-2 max-h-[350px] overflow-y-auto no-scrollbar pb-10">
                           {liveState.ticker_items?.map((item, i) => (
                             <div key={i} className="group relative bg-[#1c1c1f] hover:bg-[#252525] p-3 rounded-xl border border-white/5 transition-all">
                                <p className="text-[13px] text-gray-200 pr-8">{item}</p>
                                <button 
                                  onClick={() => setLiveState((s: LiveState) => ({ ...s, ticker_items: s.ticker_items?.filter((_, idx: number) => idx !== i), updated_at: new Date().toISOString() }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-red-500 font-black text-[10px] opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  DELETE
                                </button>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
                )}


                {/* Scriptures Tab */}
                {rightPanelTab === 'scriptures' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 uppercase tracking-wider">Bible Translation</label>
                        <select
                          value={settings.bibleVersion}
                          onChange={(e) => setSettings(prev => ({ ...prev, bibleVersion: e.target.value }))}
                          className="w-full mt-1 bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        >
                          {bibleVersions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-gray-400 uppercase tracking-wider">Selected Book</label>
                        <select
                          value={selectedBook}
                          onChange={(e) => { setSelectedBook(e.target.value); setSelectedChapter(1); }}
                          className="w-full mt-1 bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        >
                          {bibleBooks.map((book) => <option key={book} value={book}>{book}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 uppercase tracking-wider">Chapter</label>
                        <input
                          type="number"
                          min={1}
                          value={selectedChapter}
                          onChange={(e) => setSelectedChapter(Math.max(1, Math.min(150, Number(e.target.value) || 1)))}
                          className="w-full mt-1 bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <button
                          onClick={() => {
                            if (bibleData.length > 0) {
                              const book = bibleData.find((b: any) => (b.name || b.book || '').toLowerCase() === selectedBook.toLowerCase());
                              if (book && book.chapters) {
                                setSelectedChapter(Math.max(1, Math.min(Number(selectedChapter), book.chapters.length)));
                                return;
                              }
                            }
                            setSelectedChapter(Number(selectedChapter));
                          }}
                          className="px-4 py-2 bg-emerald-500 text-black rounded-lg font-semibold hover:bg-emerald-400 transition-colors"
                        >
                          Go
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 bg-[#1e1e1e] p-4 rounded-xl border border-white/10 shadow-sm">
                      <h3 className={`${colorClass} font-semibold text-base`}>{selectedBook} {selectedChapter} <span className="text-gray-400 text-xs">({settings.bibleVersion})</span></h3>
                      <div className="mt-2 max-h-[250px] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-gray-200 font-serif">
                        {chapterText}
                      </div>
                    </div>
                    {displayVersePreview && settings.detectVerses ? (
                      <div className={`bg-[#1e1e1e] p-5 rounded-xl border shadow-sm animate-in fade-in ${borderClass}/50`}>
                        <h3 className={`${colorClass} font-semibold text-lg mb-3 tracking-tight`}>{displayVersePreview.reference} <span className="text-gray-500 font-normal text-xs ml-1">({displayVersePreview.translation || settings.bibleVersion})</span></h3>
                        <p className="text-gray-300 font-serif leading-relaxed text-[15px]">{displayVersePreview.text}</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {liveState.history.slice(-10).reverse().map((item, idx) => (
                            <div key={idx} className="p-4 bg-white/5 rounded-xl border border-white/5 animate-in slide-in-from-right-2">
                               <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${item.type === 'scripture' ? 'text-emerald-400' : 'text-blue-400'}`}>{item.type}</span>
                                  <span className="text-[9px] text-gray-500 uppercase">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               </div>
                               {item.reference && <p className="text-xs font-bold text-white mb-1">{item.reference}</p>}
                               <p className="text-xs text-gray-400 italic line-clamp-2">{item.content || '(Content Aired)'}</p>
                            </div>
                          ))}
                        </div>
                        <button 
                          onClick={() => {
                            const content = `SERMON SUMMARY: ${session.name}\nDate: ${new Date().toLocaleDateString()}\n\n` + 
                              liveState.history.map(h => `[${new Date(h.timestamp).toLocaleTimeString()}] ${h.type.toUpperCase()}: ${h.reference || ''} ${h.content}`).join('\n');
                            const blob = new Blob([content], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `sermon-summary-${session.id}.txt`;
                            a.click();
                          }}
                          className="w-full mt-6 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl font-medium transition-all"
                        >
                          Download Session Summary
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Notes Tab (Consolidated) */}
                {rightPanelTab === 'notes' && (
                  <div className="space-y-4 pb-20">
                    <h3 className="text-white font-bold text-lg mb-2">Session Notes</h3>
                    {notes.length === 0 ? (
                       <p className="text-gray-500 text-sm italic">No notes captured yet. Save snippets from the transcript or type below.</p>
                    ) : (
                      <div className="space-y-3">
                        {notes.map(n => (
                          <div key={n.id} className="bg-[#1e1e1e] p-4 rounded-xl border border-white/5 shadow-sm text-[13px] text-gray-300 leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                             {n.content}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {rightPanelTab === 'lyrics' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <h3 className="text-white font-bold text-lg">Worship Lyrics</h3>
                       <button 
                         onClick={() => {
                           const p = prompt("Paste lyrics here (each line will be a slide):");
                           if (p) {
                             const lines = p.split('\n').filter(l => l.trim().length > 0);
                             const newId = `pasted-${Date.now()}`;
                             const newSong = {
                               id: newId,
                               title: 'Pasted Lyrics',
                               artist: 'Operator',
                               lyrics: lines.map((l, i) => ({ order: i, line: l.trim() }))
                             };
                             // Temporary add to sampleSongs (Note: strictly for session persistence)
                             import('./services/lyricsService').then(m => {
                               m.sampleSongs.unshift(newSong as any);
                               showToast("Lyrics pasted and ready!");
                             });
                           }
                         }}
                         className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded-md"
                       >
                         Live Paste
                       </button>
                    </div>
                    
                    {!currentSong || !settings.detectSongs ? (
                      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                         <Music size={32} className="text-gray-600 mb-2 opacity-20" />
                         <p className="text-gray-500 text-sm italic text-center">No worship song detected yet.<br/>Start singing or use "Live Paste".</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar pr-1 pb-10">
                        {currentSong?.lyrics?.map((lyricLine) => (
                          <div 
                             key={lyricLine.order} 
                             onClick={() => setManualLineOffset(lyricLine.order - (currentLine ?? 0))}
                             className={`p-4 rounded-xl border shadow-sm text-gray-300 cursor-pointer hover:${borderClass}/50 transition-all duration-300 ${lyricLine.order === actualLineIndex ? `bg-[#1e1e1e] ${borderClass} shadow-lg scale-[1.02] text-white` : 'bg-transparent border-white/5 opacity-60'}`}>
                            <div className="flex items-center gap-3">
                               <span className={`text-[10px] font-bold ${lyricLine.order === actualLineIndex ? colorClass : 'text-gray-600'}`}>{lyricLine.order + 1}</span>
                               <span className="text-sm font-medium">{lyricLine.line}</span>
                            </div>
                            {lyricLine.order === actualLineIndex && <div className={`h-0.5 w-full mt-3 rounded-full ${bgClass} animate-pulse`}></div>}
                          </div>
                        ))}
                      </div>
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

      {/* Full Screen Projector Mode (Redesigned for Premium Cinematic Experience) */}
      {isProjector && (
        <div className="fixed inset-0 bg-black z-100 flex flex-col items-center justify-center p-12 overflow-hidden animate-in fade-in duration-700">
          
          {/* ATMOSPHERIC BACKGROUND OVERLAY */}
          <div 
             className="absolute inset-0 bg-cover bg-center brightness-[0.25] saturate-[0.8] transition-all duration-1000 scale-105"
             style={{ 
               backgroundImage: `url('${settings.projectorBg}')`,
               filter: 'blur(5px) contrast(1.1)' 
             }} 
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-black opacity-60" />

          {/* ESCAPE BUTTON */}
          <button 
            onClick={() => setProjector(false)}
            className="absolute top-8 right-8 text-white/5 hover:text-white/40 p-2 transition-all z-150 border border-white/5 rounded-full"
          >
            <X size={20} />
          </button>
          
          <div className={`w-full max-w-[85vw] relative mx-auto ${liveState.ticker_enabled ? 'h-[70vh] mb-24' : 'h-[80vh]'} flex flex-col items-center justify-center text-center z-10 transition-all duration-700`}>
            
            {/* LYRICS OVERLAY (Karaoke Mode) */}
            {settings.showLyrics && settings.detectSongs && mainLyric && (
              <div className="w-full absolute bottom-12 flex flex-col items-center animate-in slide-in-from-bottom-8 duration-500">
                <KaraokeLine 
                  lyric={mainLyric} 
                  spokenText={fullTranscript} 
                  colorClass={colorClass} 
                  animationClass={settings.highlightAnimation} 
                  sizeClass="text-[88px] font-black tracking-tight leading-tight"
                />
                {nextLyric && <p className="text-[44px] text-gray-400/80 font-medium italic mt-10 tracking-wide font-serif">{nextLyric}</p>}
              </div>
            )}

            {/* SCRIPTURE OVERLAY (Floating High-Contrast Card) */}
            {settings.showVerse && settings.detectVerses && displayVerseLive && (!mainLyric || !settings.showLyrics) && (
              <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center animate-in zoom-in-95 duration-700">
                
                {/* PRIMARY BIBLE CARD */}
                <div className="glass-panel w-full p-16 bg-white/3 backdrop-blur-3xl border border-white/10 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group">
                   <div className="absolute inset-0 bg-linear-to-br from-white/5 via-transparent to-transparent opacity-30" />
                   
                   <div className="relative space-y-12">
                      <div className="flex flex-col items-center gap-4">
                         <h2 className={`${colorClass} text-5xl font-black tracking-[0.2em] uppercase drop-shadow-glow`}>
                            {displayVerseLive.reference} 
                            <span className="opacity-40 text-2xl font-light ml-4 tracking-normal">({settings.bibleVersion})</span>
                         </h2>
                         <div className={`h-1 w-24 rounded-full ${bgClass} opacity-50`}></div>
                      </div>

                      <p className="text-white text-[72px] leading-[1.1] font-serif font-semibold tracking-tight max-w-5xl mx-auto drop-shadow-2xl selection:bg-emerald-500/30">
                         "{displayVerseLive.text}"
                      </p>

                      {/* SECONDARY TRANSLATION (Subtle stack) */}
                      {secondaryFetchedVerse && (
                        <div className="pt-12 border-t border-white/10 space-y-4">
                           <h3 className="text-emerald-500/70 text-2xl font-bold tracking-[0.15em] uppercase italic">
                              {settings.secondaryBibleVersion}
                           </h3>
                           <p className="text-white/60 text-[38px] leading-[1.2] font-serif italic tracking-tight font-medium">
                              {secondaryFetchedVerse.text}
                           </p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            )}

            {/* FALLBACK: CONTINUOUS TRANSCRIPTION (Atmospheric) */}
            {!displayVerseLive && (!mainLyric || !settings.showLyrics) && settings.showTranscript && (
              <div className="px-12 animate-in fade-in duration-1000 max-w-7xl">
                <blockquote className="text-white/90 text-[64px] leading-[1.15] font-medium italic tracking-tight drop-shadow-2xl font-serif">
                   {/* Ghost word fix: Show only stable final words in the big feed */}
                   {liveState.current_text.split(' ').slice(-60).join(' ') || (isListening ? '...' : '')}
                </blockquote>
                {isListening && (
                   <div className="mt-12 flex items-center justify-center gap-4 opacity-40">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-sm font-black uppercase tracking-[0.5em] text-white/50 italic">Listening Live Session</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150"></div>
                   </div>
                )}
              </div>
            )}

            {/* STICKY STAGE TIMER */}
            {settings.autoShowTimer && (
              <div className="absolute bottom-32 right-0 glass-panel px-10 py-5 bg-black/60 border border-white/10 rounded-l-3xl flex items-center gap-6 animate-in fade-in slide-in-from-right-8 duration-700 shadow-2xl z-120">
                 <Activity size={32} className="text-emerald-400 animate-pulse" />
                 <span className="text-white text-6xl font-mono font-black tracking-tighter tabular-nums drop-shadow-glow">
                    {Math.floor(timerSession.remaining / 60)}:{String(timerSession.remaining % 60).padStart(2, '0')}
                 </span>
              </div>
            )}

            {/* LIVE NEWS TICKER (Infinite Scroll) */}
            {liveState.ticker_enabled && (liveState.ticker_items || []).length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-black/80 backdrop-blur-3xl border-t-4 border-emerald-500/50 flex items-center overflow-hidden z-130 group">
                 {/* LABEL TAG */}
                 <div className="h-full bg-emerald-500 px-10 flex items-center justify-center shadow-[20px_0_40px_rgba(0,0,0,0.4)] z-140 relative">
                    <span className="text-black text-2xl font-black uppercase tracking-[0.2em] animate-pulse">Live</span>
                 </div>
                 
                 {/* SCROLLING CONTENT */}
                 <div className="flex-1 whitespace-nowrap flex items-center">
                    <div className="animate-marquee inline-block">
                       {liveState.ticker_items?.map((item, i) => (
                         <span key={i} className="inline-flex items-center text-white text-4xl font-bold font-serif uppercase tracking-wider px-12 group-hover:text-emerald-300 transition-colors">
                            {item}
                            <span className="mx-12 text-emerald-500/30 text-5xl">•</span>
                         </span>
                       ))}
                    </div>
                    {/* Double it for infinite loop appearance */}
                    <div className="animate-marquee inline-block">
                       {liveState.ticker_items?.map((item, i) => (
                         <span key={`dup-${i}`} className="inline-flex items-center text-white text-4xl font-bold font-serif uppercase tracking-wider px-12 group-hover:text-emerald-300 transition-colors">
                            {item}
                            <span className="mx-12 text-emerald-500/30 text-5xl">•</span>
                         </span>
                       ))}
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
