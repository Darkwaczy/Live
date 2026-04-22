import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { 
  Menu, Play, Pause, SkipForward, SkipBack, 
  BookOpen, Music, FileText, Settings, 
  Monitor, Cast, LayoutGrid, ChevronRight, X, Save, AlertCircle,
  Activity, Radio, Search, Heart, Mic, Square,
  ChevronLeft, RefreshCw, Volume2, VolumeX, ListOrdered, FastForward, ArrowUp, ArrowDown, Plus,
  Check,
  Edit2,
  Trash2,
  ChevronDown,
  ArrowLeft,
  Folder,
  ArrowUpRight,
  Link2
} from 'lucide-react';
import { useLiveState } from './hooks/useLiveState';
import { LiveState } from './models/liveState';
import { Session } from './models/session';
import { Note } from './models/note';
import { User } from './models/user';
import { useBroadcastSync } from './hooks/useBroadcastSync';
import ProjectorPage from './components/ProjectorPage';
import { login, logout, getCurrentUser } from './services/authService';
import { 
   getNotes, saveNote, getSession, saveSession, getLiveState, saveLiveState,
   savePastedSong, getPastedSongs, getCrossReferences
} from './services/dbService';
import { loadEssentialLyrics, searchLyrics, addPastedSong, setInitialPastedSongs } from './services/lyricsService';
import { Song } from './models/song';
import SettingsView from './components/SettingsView';
import { BroadcastService } from './services/broadcastService';
import { recorderService, RecorderStatus } from './services/sermonRecorderService';
import { cloudStorageService } from './services/cloudStorageService';
import { recoveryService } from './services/recoveryService';

const SESSION_ID = 'service-001';

type ViewMode = 'live' | 'history' | 'documents' | 'settings';
type RightPanelTab = 'schedule' | 'scriptures' | 'lyrics' | 'notes' | 'broadcast' | 'archive';
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
            className = `text-(--accent-color) font-black ${animationClass === 'glow' ? 'drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]' : ''} transition-all duration-200`;
         } else if (isNext) {
            className = "text-white/90 font-bold scale-105 transition-all duration-200 drop-shadow-md";
         }
         return <span key={idx} className={`${sizeClass} ${className} tracking-tight`}>{word}</span>
      })}
    </div>
  );
};

export default function App() {
  // Check if we are in standalone projector mode
  const isProjectorMode = typeof window !== 'undefined' && window.location.search.includes('projector');

  if (isProjectorMode) {
    return <ProjectorPage />;
  }


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
  const [resourceAssets, setResourceAssets] = useState<any[]>([
    { id: 'mission', type: 'note', title: 'Mission Statement', content: 'OUR MISSION: To spread the message of love and grace to our local community.', icon: <Activity size={24} />, category: 'Mission' },
    { id: 'confession', type: 'note', title: 'Faith Confession', content: 'WE BELIEVE: In the power of prayer, the truth of the Word, and the presence of the Holy Spirit.', icon: <Heart size={24} />, category: 'Faith' },
    { id: 'communion', type: 'scripture', title: 'Communion Script', reference: '1 Corinthians 11:24', detail: 'And when he had given thanks, he broke it...', icon: <BookOpen size={24} />, category: 'Communion' }
  ]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const projectorVideoRef = React.useRef<HTMLVideoElement>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('notes');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'info' | 'error' | 'success' } | null>(null);
  // Live Paste Lyrics Modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteLyrics, setPasteLyrics] = useState('');
  const [isProjector, setProjector] = useState(false);
  const [projectionRole, setProjectionRole] = useState<'audience' | 'stage'>('audience');
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
    aiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
    aiModel: 'llama-3.3-70b-versatile',
    aiApiKey: import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_DEEPGRAM_API_KEY || '',
    uiScale: 100,
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
    exportFormat: 'txt',
    cloudSync: false,
    alertVisual: true,
    autoAirVerses: false,
    secondaryBibleVersion: '',
    timerDuration: 45,
    autoShowTimer: false,
    projectorBg: '/worship-bg.png',
    churchLogo: '', // Start empty to allow detection of personal brand
    theme: 'obsidian',
  });
  
  const [recoverySessions, setRecoverySessions] = useState<string[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);

  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    rms: 0
  });

  const vuLevel = recorderStatus.rms * 2.55;

  // Track Recorder Status
  useEffect(() => {
    recorderService.onStatusUpdate(setRecorderStatus);
  }, []);

  // Load Persisted Settings on Init
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ca_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
        setDraftSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  }, []);

  const [draftSettings, setDraftSettings] = useState<typeof settings>(settings);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProjectorActive, setIsProjectorActive] = useState(false);

  // Sync Projector Window Status from Electron
  useEffect(() => {
    if ((window as any).sermonSync?.getProjectorStatus) {
      (window as any).sermonSync.getProjectorStatus().then(setIsProjectorActive);
    }
    if ((window as any).sermonSync?.onProjectorStatus) {
      (window as any).sermonSync.onProjectorStatus(setIsProjectorActive);
    }

    // --- OPTION 2: Silent N-ATLAS Background Download ---
    const triggerSilentAutoInstall = async () => {
      if (settings.speechEngine === 'n-atlas' && (window as any).sermonSync?.getNAtlasStatus) {
        try {
          const status = await (window as any).sermonSync.getNAtlasStatus();
          if (!status.installed && !status.inProgress && (window as any).sermonSync.installNAtlas) {
            console.log("N-ATLAS: Starting silent background download...");
            await (window as any).sermonSync.installNAtlas();
          }
        } catch (e) {
          console.warn("N-ATLAS Auto-install check failed:", e);
        }
      }
    };
    triggerSilentAutoInstall();
  }, [settings.speechEngine]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);


  const updateDraftSetting = (key: string, value: any) => {
    setDraftSettings(prev => ({ ...prev, [key as keyof typeof settings]: value }));
  };

  // Types for the Multi-Media Master Playlist
  type ServicePlanMediaItem = { type: 'video' | 'audio' | 'image'; url: string; name: string };
  type ServicePlanScripture = { book: string; chapter: number; verse_start: number; verse_end?: number; reference: string; text?: string };
  type ServicePlanTextItem = { id: string; title: string; content: string };

  type ServicePlanBlock = {
    id: string;
    title: string;
    type: string;
    songs?: Song[];
    scriptures?: ServicePlanScripture[];
    mediaItems?: ServicePlanMediaItem[];
    textItems?: ServicePlanTextItem[];
    fixed?: boolean;
  };

  // Order of Service State
   const [isEditingPlan, setIsEditingPlan] = useState(false);
   const [servicePlan, setServicePlan] = useState<ServicePlanBlock[]>([]);
   const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
   const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

   // Text Item Input State
   const [newTextTitle, setNewTextTitle] = useState('');
   const [newTextContent, setNewTextContent] = useState('');

  // Song Picker State
  const [songPickerBlockId, setSongPickerBlockId] = useState<string | null>(null);
  const [songPickerQuery, setSongPickerQuery] = useState('');
  const [songPickerResults, setSongPickerResults] = useState<Song[]>([]);

  // Scripture Picker State
  const [scripturePickerBlockId, setScripturePickerBlockId] = useState<string | null>(null);
  const [pickerSelectedBook, setPickerSelectedBook] = useState<string>('John');
  const [pickerSelectedChapter, setPickerSelectedChapter] = useState<number>(3);
  const [pickerSelectedVerse, setPickerSelectedVerse] = useState<number>(16);

  const resetToMasterRundown = () => {
    const masterSkeleton: ServicePlanBlock[] = [
      { id: crypto.randomUUID(), title: 'Worship', type: 'worship', fixed: true },
      { id: crypto.randomUUID(), title: 'Announcement', type: 'announcement', fixed: true },
      { id: crypto.randomUUID(), title: 'Africa Praise', type: 'praise', fixed: true },
      { id: crypto.randomUUID(), title: 'Contemporary Praise', type: 'praise', fixed: true },
      { id: crypto.randomUUID(), title: 'Bible Reading', type: 'scripture', fixed: true },
      { id: crypto.randomUUID(), title: 'Testimony', type: 'note', fixed: true },
      { id: crypto.randomUUID(), title: 'News', type: 'media', fixed: true }
    ];
    saveServicePlan(masterSkeleton);
    showToast("Standard Rundown Restored");
  };

  useEffect(() => {
    try {
      const savedPlan = localStorage.getItem('ca_service_plan');
      if (savedPlan) {
        const parsed: ServicePlanBlock[] = JSON.parse(savedPlan);
        // If the user has an old/incomplete plan, we'll nudge it toward the new master structure
        // but only if it's missing the requested types.
        const requiredTypes = ['worship', 'announcement', 'praise', 'scripture', 'media'];
        const hasRequired = requiredTypes.every(t => parsed.some(p => p.type === t));
        
        if (!hasRequired && parsed.length < 5) {
          resetToMasterRundown();
        } else {
          setServicePlan(parsed);
        }
      } else {
        resetToMasterRundown();
      }
    } catch (e) {
       console.error("Failed to load service plan", e);
    }
  }, []);

  const saveServicePlan = (newPlan: ServicePlanBlock[]) => {
    setServicePlan(newPlan);
    localStorage.setItem('ca_service_plan', JSON.stringify(newPlan));
  };

  const advanceService = () => {
    if (currentPlanIndex < servicePlan.length - 1) {
      const nextIndex = currentPlanIndex + 1;
      const nextItem = servicePlan[nextIndex];
      setCurrentPlanIndex(nextIndex);
      
      // Smart Auto-Switcher
      if (nextItem.type === 'worship' || nextItem.type === 'praise') {
         setRightPanelTab('lyrics');
      } else if (nextItem.type === 'sermon' || nextItem.type === 'scripture') {
         setRightPanelTab('scriptures');
      } else if (nextItem.type === 'media' || nextItem.type === 'announcement') {
         setRightPanelTab('broadcast');
      } else if (nextItem.type === 'note') {
         setRightPanelTab('notes');
      }
      
      
      // Auto-Recorder Trigger
      if (nextItem.type === 'sermon') {
         recorderService.start().catch(err => showToast(`Recorder Error: ${err.message}`));
         setRightPanelTab('archive');
      } else if (currentPlanIndex > 0 && servicePlan[currentPlanIndex].type === 'sermon') {
         // Stop recording if the previous item was a sermon
         const previousSermon = servicePlan[currentPlanIndex];
         recorderService.stop().then(async (blob) => {
            showToast(`Sermon Captured. Syncing to Supabase...`);
            const result = await cloudStorageService.uploadSermon(blob, previousSermon.title);
            if (result.success) {
               showToast(`Success: Sermon Archived to Cloud`);
            } else {
               showToast(`Upload Failed: ${result.error}`, "error");
            }
         });
      }

      showToast(`Advanced to: ${nextItem.title}`);
    }
  };

  // Bible & Lyrics Browser States
  const [bibleData, setBibleData] = useState<any[]>([]);

  const [selectedBook, setSelectedBook] = useState<string>('John');
  const [selectedChapter, setSelectedChapter] = useState<number>(3);
  const [chapterVerses, setChapterVerses] = useState<any[]>([]);
  const [isBibleLoading, setIsBibleLoading] = useState(false);
  const [apiBibleCache, setApiBibleCache] = useState<Record<string, any[]>>({});
  const [lyricSearchResults, setLyricSearchResults] = useState<Song[]>([]);
  const [lyricSearchQuery, setLyricSearchQuery] = useState('');

  const commitSettings = () => {
    setSettings(draftSettings);
    // Persist to disk/storage immediately
    localStorage.setItem('ca_settings', JSON.stringify(draftSettings));
    showToast('Settings saved successfully!');
  };

  const { 
    liveState, interimText, currentSong, currentLine, currentVerse, isListening, 
    start, stop, clearText: originalClearText, applyLiveState, error, setError, goLive: originalGoLive, directAir, setPreviewVerse, setSecondaryVerse, setPreviewVerseText, removeDetection, setBlank, setLogo, loadSong, airLyricLine, setLiveState
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

  const [crossRefs, setCrossRefs] = useState<any[]>([]);

  useEffect(() => {
    if (liveState.preview_verse) {
      getCrossReferences(
        liveState.preview_verse.book, 
        liveState.preview_verse.chapter, 
        liveState.preview_verse.verse_start, 
        3
      ).then(setCrossRefs);
    } else {
      setCrossRefs([]);
    }
  }, [liveState.preview_verse]);

  // Sync state between Operator and Projector windows via BroadcastChannel
  // No internet required, same-origin only.
  useBroadcastSync(liveState, applyLiveState, isProjectorMode, useCallback(() => {
    // Provide 'Now' state for the handshake (initial TV open)
    const videoEl = document.getElementById('live-video-element') as HTMLVideoElement;
    return {
      media_currentTime: videoEl ? videoEl.currentTime : 0
    };
  }, []));

  const [airedVerse, setAiredVerse] = useState<{ reference: string; text: string; translation?: string } | null>(null);
  const [airedLyric, setAiredLyric] = useState<string | null>(null);

  // DASHBOARD DISPLAY LOGIC: Calculate human-readable verses and lyrics
  const displayVersePreview = useMemo(() => {
    if (!liveState.preview_verse) return null;
    const { book, chapter, verse_start, verse_end } = liveState.preview_verse;
    return {
      reference: `${book} ${chapter}:${verse_start}${verse_end && verse_end !== verse_start ? '-' + verse_end : ''}`,
      text: liveState.preview_verse_text || '(Loading...)',
      translation: settings.bibleVersion
    };
  }, [liveState.preview_verse, liveState.preview_verse_text, settings.bibleVersion]);

  const displayVerseLive = useMemo(() => {
    if (!liveState.current_verse) return null;
    const { book, chapter, verse_start, verse_end } = liveState.current_verse;
    return {
      reference: `${book} ${chapter}:${verse_start}${verse_end && verse_end !== verse_start ? '-' + verse_end : ''}`,
      text: liveState.current_verse_text || '',
      translation: settings.bibleVersion
    };
  }, [liveState.current_verse, liveState.current_verse_text, settings.bibleVersion]);

  const actualLineIndex = liveState.current_lyric_index;
  const nextLineIndex = liveState.preview_lyric_index;
  const mainLyric = currentSong?.lyrics?.find((l: any) => l.order === actualLineIndex)?.line || '';
  const nextLyric = nextLineIndex !== undefined ? currentSong?.lyrics?.[nextLineIndex]?.line : null;

  const goLive = () => {
    // Snapshot the current preview content for the dashboard mirror
    if (displayVersePreview) setAiredVerse(displayVersePreview);
    else setAiredVerse(null);

    const mainLyric = currentSong?.lyrics?.find((l: any) => l.order === actualLineIndex)?.line || '';
    if (mainLyric) setAiredLyric(mainLyric);
    else setAiredLyric(null);

    originalGoLive();
  };

  const clearText = () => {
    setAiredVerse(null);
    setAiredLyric(null);
    originalClearText();
  };

  // NUCLEAR SILENCE GUARD: Enforce dashboard silence every 500ms for non-preview videos.
  useEffect(() => {
    if (isProjectorMode) return;
    const interval = setInterval(() => {
      const liveVideo = document.getElementById('live-video-element') as HTMLVideoElement;
      if (liveVideo) {
        liveVideo.muted = true;
        liveVideo.volume = 0;
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isProjectorMode]);

  // AUTO-ADVANCE PREVIEW LYRIC: When goLive promotes preview→current, fill in the next line text.
  useEffect(() => {
    const idx = liveState.preview_lyric_index;
    if (idx === undefined || liveState.preview_lyric_line !== null) return;
    // preview_lyric_line is null but index was set — fill it from song
    if (currentSong && currentSong.lyrics && idx < currentSong.lyrics.length) {
      const nextText = currentSong.lyrics[idx]?.line || null;
      setLiveState((s: any) => ({ ...s, preview_lyric_line: nextText }));
    } else if (currentSong && idx >= (currentSong.lyrics?.length || 0)) {
      // End of song — no more lines
      setLiveState((s: any) => ({ ...s, preview_lyric_line: null, preview_lyric_index: undefined }));
    }
  }, [liveState.preview_lyric_index, liveState.preview_lyric_line, currentSong]);

  // Sync state to NDI Broadcast Sidecar
  useEffect(() => {
    if (settings.speechEngine === 'n-atlas' || settings.speechEngine === 'deepgram' || settings.detectVerses) {
      BroadcastService.updateNDI(liveState, true);
    }
  }, [liveState, settings.speechEngine, settings.detectVerses]);

  // Live transcript: committed lines from finalized speech
  const transcriptScrollRef = React.useRef<HTMLDivElement>(null);
  const bibleScrollRef = React.useRef<HTMLDivElement>(null);

  const fullTranscript = (liveState.transcription_text || liveState.current_text || '') + (interimText ? ' ' + interimText : '');

  useEffect(() => {
     if (transcriptScrollRef.current) {
        transcriptScrollRef.current.scrollTo({ top: transcriptScrollRef.current.scrollHeight, behavior: 'smooth' });
     }
  }, [liveState.transcription_text, liveState.current_text, interimText]);

  // Auto-scroll Bible Sidebar to active verse
  useEffect(() => {
    if (bibleScrollRef.current && liveState.preview_verse) {
      const activeElement = bibleScrollRef.current.querySelector('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [liveState.preview_verse]);

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
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectedLyricCategory, setSelectedLyricCategory] = useState('All');

  const bibleBooks = [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
  ];

  const BIBLE_CHAPTER_COUNTS: Record<string, number> = {
    'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34, 'Joshua': 24, 'Judges': 21, 'Ruth': 4,
    '1 Samuel': 31, '2 Samuel': 24, '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36, 'Ezra': 10, 'Nehemiah': 13,
    'Esther': 10, 'Job': 42, 'Psalms': 150, 'Proverbs': 31, 'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66, 'Jeremiah': 52,
    'Lamentations': 5, 'Ezekiel': 48, 'Daniel': 12, 'Hosea': 14, 'Joel': 3, 'Amos': 9, 'Obadiah': 1, 'Jonah': 4, 'Micah': 7,
    'Nahum': 3, 'Habakkuk': 3, 'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4, 'Matthew': 28, 'Mark': 16, 'Luke': 24,
    'John': 21, 'Acts': 28, 'Romans': 16, '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6, 'Ephesians': 6, 'Philippians': 4,
    'Colossians': 4, '1 Thessalonians': 5, '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1,
    'Hebrews': 13, 'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1, '3 John': 1, 'Jude': 1, 'Revelation': 22
  };

  useEffect(() => {
    const loadBibleData = async () => {
      const version = settings.bibleVersion.toLowerCase();
      try {
        const res = await fetch(`/bibles/${version}.json`);
        if (!res.ok) throw new Error(`Content not found: /bibles/${version}.json`);
        
        const rawText = await res.text();
        // Strip BOM (efbbbf) if present at the start of the file
        const cleanText = rawText.replace(/^\uFEFF/, "");
        
        try {
          const data = JSON.parse(cleanText);
          if (Array.isArray(data)) {
            // Enrich with full names from bibleBooks if missing (maps 1:1 for standard 66 books)
            const enriched = data.map((b: any, idx: number) => ({
              ...b,
              name: b.name || b.book || bibleBooks[idx] || b.abbrev
            }));
            setBibleData(enriched);
            if (!enriched.find((b: any) => b.name === selectedBook || b.book === selectedBook)) {
              setSelectedBook(enriched[0]?.name || enriched[0]?.book || 'Genesis');
              setSelectedChapter(1);
            }
            return;
          }
        } catch (parseErr: any) {
          const isTruncated = rawText.length < 2000000; // A full bible usually > 4MB
          throw new Error(isTruncated ? 
            `Bible file ${version}.json appears truncated or cut off (${(rawText.length/1024).toFixed(0)}KB). Please restore the full file.` : 
            `JSON Error in ${version}.json: ${parseErr.message}`
          );
        }
        setBibleData([]);
      } catch (err: any) {
        setBibleData([]);
        console.error('Bible load failed:', err.message);
        showToast(`Bible Error: ${err.message}`);
      }
    };

    loadBibleData();
  }, [settings.bibleVersion, selectedBook]);

  // RECOVERY CHECK: On mount, check for unfinished recording sessions
  useEffect(() => {
    const checkRecovery = async () => {
      const sessions = await recoveryService.listSessions();
      if (sessions.length > 0) {
        setRecoverySessions(sessions);
      }
    };
    checkRecovery();
  }, []);

  const handleRecover = async (sessionId: string) => {
    setIsRecovering(true);
    try {
      const blob = await recoveryService.recoverSession(sessionId);
      if (blob) {
        showToast("Recovering sermon audio...");
        const result = await cloudStorageService.uploadSermon(blob, `Recovered_${sessionId}`);
        if (result.success) {
          showToast("Sermon recovered & archived to cloud!");
          await recoveryService.clearSession(sessionId);
          setRecoverySessions(prev => prev.filter(id => id !== sessionId));
        } else {
          showToast(`Recovery failed: ${result.error}`, "error");
        }
      }
    } catch (err) {
      console.error("Recovery error:", err);
      showToast("Critical error during recovery", "error");
    } finally {
      setIsRecovering(false);
    }
  };

  // Update chapter verses when book or chapter changes
  useEffect(() => {
    const fetchChapter = async () => {
      setIsBibleLoading(true);
      const version = settings.bibleVersion;
      const cacheKey = `${version}-${selectedBook}-${selectedChapter}`;

      // 1. Try local data first
      if (bibleData.length > 0) {
        // More resilient lookup: check name, book, and abbrev
        const book = bibleData.find((b: any) => 
          (b.name || '').toLowerCase() === selectedBook.toLowerCase() || 
          (b.book || '').toLowerCase() === selectedBook.toLowerCase() ||
          (b.abbrev || '').toLowerCase() === selectedBook.toLowerCase()
        );
        if (book && book.chapters && book.chapters[selectedChapter - 1]) {
          const verses = book.chapters[selectedChapter - 1].map((text: string, i: number) => ({
            verse: i + 1,
            text: text.replace(/\n/g, ' ').trim()
          }));
          if (verses.length > 0) {
             setChapterVerses(verses);
             setIsBibleLoading(false);
             return;
          }
        }
      }

      // 2. Try Cache next
      if (apiBibleCache[cacheKey]) {
        setChapterVerses(apiBibleCache[cacheKey]);
        setIsBibleLoading(false);
        return;
      }

      // 3. Fallback to API (ONLY for supported public domain versions)
      const supportedApiVersions = ['kjv', 'bbe', 'web', 'asv', 'oeb'];
      if (!supportedApiVersions.includes(version.toLowerCase())) {
        console.warn(`External API does not support ${version}. Offline file is required.`);
        setIsBibleLoading(false);
        setChapterVerses([]);
        return;
      }

      try {
        const apiRes = await fetch(`https://bible-api.com/${encodeURIComponent(selectedBook)}+${selectedChapter}?translation=${version.toLowerCase()}`);
        if (!apiRes.ok) throw new Error("API Retrieval Failed");
        const apiData = await apiRes.json();
        if (apiData.verses && Array.isArray(apiData.verses)) {
           const verses = apiData.verses.map((v: any) => ({
             verse: v.verse,
             text: v.text.replace(/\n/g, ' ').trim()
           }));
           setChapterVerses(verses);
           setApiBibleCache(prev => ({ ...prev, [cacheKey]: verses }));
        } else {
           setChapterVerses([]);
        }
      } catch (err) {
        console.warn('Bible API fallback failed:', err);
        setChapterVerses([]);
      } finally {
        setIsBibleLoading(false);
      }
    };

    fetchChapter();
  }, [selectedBook, selectedChapter, bibleData, settings.bibleVersion]);

  const handleNextChapter = () => {
    const maxChapters = BIBLE_CHAPTER_COUNTS[selectedBook] || 1;
    if (selectedChapter < maxChapters) {
      setSelectedChapter(prev => prev + 1);
    } else {
      const bookIdx = bibleBooks.findIndex(b => b.toLowerCase() === selectedBook.toLowerCase());
      if (bookIdx !== -1 && bookIdx < bibleBooks.length - 1) {
        setSelectedBook(bibleBooks[bookIdx + 1]);
        setSelectedChapter(1);
      }
    }
  };

  const handlePrevChapter = () => {
    if (selectedChapter > 1) {
      setSelectedChapter(prev => prev - 1);
    } else {
      const bookIdx = bibleBooks.findIndex(b => b.toLowerCase() === selectedBook.toLowerCase());
      if (bookIdx > 0) {
        const prevBookName = bibleBooks[bookIdx - 1];
        setSelectedBook(prevBookName);
        setSelectedChapter(BIBLE_CHAPTER_COUNTS[prevBookName] || 1);
      }
    }
  };

  useEffect(() => {
    const fetchVerse = async (ref: string, version: string, isSecondary: boolean) => {
      // 0. Skip API for copyrighted versions to avoid 404/CORS spam
      const supportedApiVersions = ['kjv', 'bbe', 'web', 'asv', 'oeb'];

      try {
        if (supportedApiVersions.includes(version.toLowerCase())) {
          const apiRes = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${version}`);
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.text) {
              const result = { reference: apiData.reference || ref, text: apiData.text.replace(/\n/g, ' ').trim(), translation: version };
              if (!isSecondary) {
                setFetchedVerse(result);
                setPreviewVerseText(result.text); // Sync to TV
              } else {
                setSecondaryFetchedVerse(result);
              }
              return true;
            }
          }
        }
      } catch (e) {}

      try {
        const res = await fetch(`/bibles/${version.toLowerCase()}.json`);
        if (!res.ok) return false;
        const bibleDataLocal = await res.json();
        const verse = liveState.preview_verse;
        if (!verse) return false;
        
        const book = bibleDataLocal.find((b: any, idx: number) => 
          (b.name || '').toLowerCase() === verse.book.toLowerCase() || 
          (b.book || '').toLowerCase() === verse.book.toLowerCase() ||
          (b.abbrev || '').toLowerCase() === verse.book.toLowerCase() ||
          (bibleBooks[idx] || '').toLowerCase() === verse.book.toLowerCase()
        );
        if (book && book.chapters && book.chapters[verse.chapter - 1]) {
           const text = book.chapters[verse.chapter - 1][verse.verse_start - 1];
           const result = { reference: ref, text, translation: version };
           if (!isSecondary) {
             setFetchedVerse(result);
             setPreviewVerseText(result.text); // Sync to TV
           }
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

  // Hook into auto-air logic (DISABLED BY DEFAULT TO PREVENT UNWANTED INTERRUPTIONS)
  // The system will only put detected content into the Preview/Queue. The operator MUST manually air it.
  useEffect(() => {
     // Intentionally left blank. Nothing goes live without a physical click.
  }, []);

  // Sequential Advance: When a verse goes live, stage the next one automatically
  useEffect(() => {
    if (liveState.current_verse) {
      const currentIdx = chapterVerses.findIndex(v => v.verse === liveState.current_verse?.verse_start);
      if (currentIdx !== -1 && currentIdx < chapterVerses.length - 1) {
        const nextVerse = chapterVerses[currentIdx + 1];
        // Only stage next if we're not manually focusing on something else
        if (!liveState.preview_verse || (liveState.preview_verse.book === liveState.current_verse.book && liveState.preview_verse.chapter === liveState.current_verse.chapter && liveState.preview_verse.verse_start === liveState.current_verse.verse_start)) {
          setPreviewVerse({
            book: selectedBook,
            chapter: selectedChapter,
            verse_start: nextVerse.verse,
            verse_end: 0
          });
        }
      }
    }
  }, [liveState.current_verse, chapterVerses, selectedBook, selectedChapter]);

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

      // Load 1k Essential Lyrics
      const essentials = await loadEssentialLyrics();
      const persistedPasted = await getPastedSongs();
      setInitialPastedSongs(persistedPasted);
      setLyricSearchResults([...persistedPasted, ...essentials]);
    })();
  }, [applyLiveState, session.id]);

  useEffect(() => {
    if (!liveState.current_text && !liveState.transcription_text && !isListening) return;
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
    const safeId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const noteObj: Note = {
      id: safeId,
      user_id: user?.id || 'guest',
      session_id: session.id,
      content: newNote,
      timestamp: Date.now(),
      created_at: new Date().toISOString()
    };
    
    setNotes((prev) => {
      if (prev.some(n => n.id === noteObj.id)) return prev;
      return [noteObj, ...prev];
    });
    setNewNote('');
    
    try {
      if (window.sermonSync?.send) {
        window.sermonSync.send('notes:save', noteObj);
      }
      await saveNote(noteObj);
    } catch (err) {
      console.error('Note persistence error', err);
    }
  };

  const handleResourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isDoc = file.type === 'application/pdf' || file.name.match(/\.(doc|docx|ppt|pptx)$/i);
    
    // Append hash to blob URL for easy type detection in the UI
    const url = URL.createObjectURL(file) + (isVideo ? '#video' : isDoc ? '#doc' : '#image');
    
    const newAsset = {
      id: Math.random().toString(36).substring(7),
      type: 'media',
      mediaType: isVideo ? 'video' : isDoc ? 'document' : 'image',
      title: file.name.split('.')[0],
      url: url,
      icon: isVideo ? <Play size={18} /> : isDoc ? <FileText size={18} /> : <Search size={18} />,
      category: 'Uploads'
    };
    
    setResourceAssets(prev => [newAsset, ...prev]);
    showToast(`Uploaded: ${file.name}`);
  };

  const handleNewPoint = () => {
     const title = prompt("Enter Point Title:");
     const content = prompt("Enter Sermon Point Content:");
     if (!title || !content) return;
     
     const newAsset = {
        id: Math.random().toString(36).substring(7),
        type: 'note',
        title: title,
        content: content,
        icon: <FileText size={18} />,
        category: 'Custom'
     };
     setResourceAssets(prev => [newAsset, ...prev]);
  };

  const handleDeleteResource = (id: string) => {
     setResourceAssets(prev => prev.filter(a => a.id !== id));
     showToast("Resource removed from library");
  };

  // RESILIENT MEDIA ENGINE SYNC (Hardware-Level Overrides)
  useEffect(() => {
    const video = projectorVideoRef.current;
    if (!video) return;

    const syncMediaHardware = async () => {
      try {
        if (!video) return;
        
        // 1. Force state on the physical element bypassing React delay
        video.muted = liveState.media_muted ?? true;
        video.volume = liveState.media_volume ?? 1.0;
        
        if (liveState.current_media) {
           // 2. Transmit hard pause/play signals securely
           if (liveState.media_playing) {
             const playPromise = video.play();
             if (playPromise !== undefined) {
               playPromise.catch((e) => {
                 console.warn("Media Context Blocked Play:", e);
                 // Only show rescue overlay if attempting to play unmuted
                 if (!liveState.media_muted) setAudioBlocked(true);
               });
             }
           } else {
             // CRITICAL: Force the browser to halt playback on frame (rather than just clearing autoPlay)
             video.pause();
           }
        }
      } catch (err) {
        console.error("Critical Media Engine Sync Error:", err);
      }
    };

    syncMediaHardware();
  }, [liveState.media_muted, liveState.media_volume, liveState.media_playing, liveState.current_media]);

  const handleBroadcastActivation = () => {
     setAudioBlocked(false);
     // Force the state to unmuted and full volume
     setLiveState(s => ({ ...s, media_muted: false, media_volume: 1.0 }));
     if (projectorVideoRef.current) {
        projectorVideoRef.current.muted = false;
        projectorVideoRef.current.volume = 1.0;
        projectorVideoRef.current.play().catch(e => console.error("Rescue Play Failed:", e));
     }
  };

  const showToast = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSnapshotToNotes = () => {
    const fullBuffer = (liveState.transcription_text || liveState.current_text || '') + (interimText ? ' ' + interimText : '');
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
    
    setNotes(prev => {
      if (prev.some(n => n.id === noteObj.id)) return prev;
      return [noteObj, ...prev];
    });
    clearText();
    showToast('Saved transcript block to Notes and cleared screen!');
    
    // Attempt local storage fallback
    try {
      if (window.sermonSync?.send) {
        window.sermonSync.send('notes:save', noteObj);
      }
      saveNote(noteObj);
    } catch (e) {}
  };

  const startRecording = async () => {
    try {
      await recorderService.start();
      showToast("Sermon Recording Started", "success");
      setRightPanelTab('archive');
    } catch (err: any) {
      showToast(`Recorder Error: ${err.message}`, "error");
    }
  };

  const stopRecording = async () => {
    const currentSermonTitle = servicePlan[currentPlanIndex]?.title || 'Manual Recording';
    try {
      showToast("Processing Audio...", "info");
      const blob = await recorderService.stop();
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${new Date().toISOString().slice(0, 10)}_${currentSermonTitle.replace(/[^a-z0-9]/gi, '_')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast("Audio file downloaded securely!", "success");
    } catch (err: any) {
      showToast(`Recording error: ${err.message}`, "error");
    }
  };

  const handleNext = () => setManualLineOffset(prev => prev + 1);
  const handlePrev = () => setManualLineOffset(prev => prev - 1);

  // Dynamic Tailwind Classes based on settings
  const animationClass = settings.highlightAnimation === 'glow' ? `drop-shadow-[0_0_12px_rgba(currentColor,0.4)]` : settings.highlightAnimation === 'fade' ? 'animate-pulse' : '';
  const highlightHex = settings.highlightColor === 'gold' ? '#fbbf24' : settings.highlightColor === 'blue' ? '#3b82f6' : '#10b981';
  const blurStyle = { 
    backdropFilter: `blur(${settings.transparency/10 + 2}px)`, 
    filter: `opacity(${settings.transparency}%)`,
    '--highlight-override': highlightHex
  } as React.CSSProperties;

  const transcriptTextClass = settings.transcriptSize === 'small' ? 'text-xl' : settings.transcriptSize === 'medium' ? 'text-2xl' : 'text-3xl';
  const projectorTextClass1 = settings.transcriptSize === 'small' ? 'text-4xl' : settings.transcriptSize === 'medium' ? 'text-5xl' : 'text-6xl';
  const projectorTextClass2 = settings.transcriptSize === 'small' ? 'text-3xl' : settings.transcriptSize === 'medium' ? 'text-4xl' : 'text-5xl';
  const projectorTextClass3 = settings.transcriptSize === 'small' ? 'text-2xl' : settings.transcriptSize === 'medium' ? 'text-3xl' : 'text-4xl';


  return (
    <div 
      className={`flex h-screen w-full font-sans overflow-hidden select-none theme-${settings.theme} bg-(--bg-primary) text-(--text-primary) transition-colors duration-300`}
      style={{ 
        '--highlight-override': highlightHex,
        zoom: (settings.uiScale || 100) / 100
      } as React.CSSProperties}
    >
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 border ${
          toastMessage.type === 'error' ? 'bg-red-500 border-red-400 text-white' : 
          toastMessage.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 
          'bg-emerald-500 text-white border-emerald-400'
        }`}>
           <span className="text-xs font-bold tracking-wide">{toastMessage.text}</span>
           <button onClick={() => setToastMessage(null)} className="hover:bg-white/20 rounded-full p-1"><X size={14}/></button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-[72px] flex flex-col items-center py-6 bg-(--bg-secondary) border-r border-(--border-color) z-20 shrink-0 transition-colors">
        <button onClick={() => showToast('Menu opened')} className="p-3 hover:bg-white/5 rounded-xl mb-8 transition-colors">
          <Menu size={24} className={activeView === 'settings' ? 'text-white' : 'text-gray-400'} />
        </button>
        <nav className="flex flex-col gap-2 w-full px-2">
          <button 
            onClick={() => setActiveView('live')}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl relative group transition-all ${activeView === 'live' ? 'bg-red-500/10 text-red-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} 
            title="Live Session">
            {activeView === 'live' && <div className="absolute inset-y-0 left-[-8px] w-[3px] bg-red-500 rounded-r-lg"></div>}
            <Monitor size={20} />
            <span className="text-[8px] font-black tracking-widest uppercase">LIVE</span>
          </button>
          <button 
            onClick={() => setActiveView('history')}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl relative group transition-all ${activeView === 'history' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} 
            title="History">
            {activeView === 'history' && <div className="absolute inset-y-0 left-[-8px] w-[3px] bg-emerald-500 rounded-r-lg"></div>}
            <BookOpen size={20} />
            <span className="text-[8px] font-black tracking-widest uppercase">HISTORY</span>
          </button>
          <button 
            onClick={() => setActiveView('documents')}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl relative group transition-all ${activeView === 'documents' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} 
            title="Documents">
            {activeView === 'documents' && <div className="absolute inset-y-0 left-[-8px] w-[3px] bg-emerald-500 rounded-r-lg"></div>}
            <FileText size={20} />
            <span className="text-[8px] font-black tracking-widest uppercase">DOCS</span>
          </button>

          <div className="flex-1 min-h-[40px]"></div>

          <button 
            onClick={() => setActiveView('settings')}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl relative group transition-all mt-auto ${activeView === 'settings' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`} 
            title="Settings">
            {activeView === 'settings' && <div className="absolute inset-y-0 left-[-8px] w-[3px] bg-white rounded-r-lg"></div>}
            <Settings size={20} />
            <span className="text-[8px] font-black tracking-widest uppercase">CONFIG</span>
          </button>
        </nav>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-(--bg-secondary) via-(--bg-primary) to-(--bg-primary) transition-colors">
        
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

        {/* Recovery Toast */}
        {recoverySessions.length > 0 && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 flex items-center gap-4 bg-emerald-600/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl border border-emerald-400/30">
            <div className="flex flex-col">
               <span className="text-sm font-black uppercase tracking-widest">Unfinished recording found</span>
               <span className="text-[10px] opacity-80">We found a sermon that wasn't saved due to a crash or close.</span>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={() => { recoverySessions.forEach(id => recoveryService.clearSession(id)); setRecoverySessions([]); }}
                 className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold uppercase transition-all"
               >
                 Discard
               </button>
               <button 
                 disabled={isRecovering}
                 onClick={() => handleRecover(recoverySessions[0])}
                 className="px-4 py-2 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all flex items-center gap-2"
               >
                 {isRecovering ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                 {isRecovering ? 'Recovering...' : 'Recover & Upload'}
               </button>
            </div>
          </div>
        )}

        {/* Top Navbar */}
        <header className="h-[56px] flex items-center justify-between px-6 border-b border-(--border-color) bg-transparent z-10 shrink-0 transition-colors gap-4 overflow-hidden">
          <div className="flex items-center gap-4 shrink-0">
            {recorderStatus.isRecording && (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full animate-pulse mr-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                <span className="text-[9px] font-black text-red-400 tracking-widest">REC</span>
                <span className="text-[9px] font-mono text-red-300 ml-1">{new Date(recorderStatus.duration * 1000).toISOString().substr(14, 5)}</span>
              </div>
            )}
            
            <div className={`flex items-center gap-2 rounded-md px-2.5 py-1 transition-colors ${isOnline ? 'bg-emerald-500' : 'bg-gray-600'}`} title={isOnline ? "Connected to the Internet" : "Offline / Local Mode"}>
              <div className={`w-1.5 h-1.5 rounded-full bg-white ${isOnline ? 'animate-pulse' : ''}`}></div>
              <span className="text-[11px] font-bold text-white tracking-widest uppercase">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
            
            <div className="flex items-center gap-1 bg-(--bg-secondary)/80 p-0.5 rounded-lg border border-(--border-color)">
              <button onClick={isListening ? stop : start} className={`p-1.5 hover:bg-white/10 rounded-md transition-colors text-(--accent-color)`} title={isListening ? "Pause Transcription" : "Start Transcription"}>
                {isListening ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              
              <div className="w-px h-4 bg-white/10 mx-1 mr-2"></div>
              
              <button 
                onClick={goLive}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md font-bold text-[9px] tracking-widest uppercase transition-all bg-red-600 text-white shadow-lg active:scale-95 ml-1"
                title="Send Screen to Air!"
              >
                <SkipForward size={12} fill="currentColor" /> GO LIVE
              </button>
            </div>
          </div>

          {/* MASTER CENTERED HARDWARE SWITCHER */}
          <div className="flex items-center gap-0.5 bg-[#1a1a1c]/60 backdrop-blur-md p-0.5 rounded-lg border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)] scale-85 lg:scale-95 shrink-0 mx-auto">
            <button 
              onClick={clearText}
              className="px-2.5 py-1 rounded-md font-black text-[8px] tracking-[0.15em] uppercase transition-all text-gray-500 hover:text-white hover:bg-white/5 active:bg-white/10 flex items-center gap-1"
              title="Clear Foreground Text"
            >
              <X size={9} strokeWidth={3} className="text-gray-600" /> 
              <span>Clear</span>
            </button>
            
            <div className="w-px h-3 bg-white/5 mx-0.5" />

            <button 
              onClick={() => setLogo(!liveState.is_logo)}
              className={`px-2.5 py-1 rounded-md font-black text-[8px] tracking-[0.15em] uppercase transition-all flex items-center gap-1 ${liveState.is_logo ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-blue-400 hover:bg-blue-500/5'}`}
              title="Show Church Logo"
            >
              <LayoutGrid size={9} strokeWidth={2.5} /> 
              <span>Theme</span>
            </button>
            
            <div className="w-px h-3 bg-white/5 mx-0.5" />

            <button 
              onClick={() => setBlank(!liveState.is_blank)}
              className={`px-2.5 py-1 rounded-md font-black text-[8px] tracking-[0.15em] uppercase transition-all flex items-center gap-1 ${liveState.is_blank ? 'bg-gray-800 text-white shadow-lg border border-gray-600' : 'text-gray-500 hover:text-white hover:bg-black'}`}
              title="Pitch Black Out"
            >
              <div className={`w-1.5 h-1.5 rounded-[1px] transition-colors ${liveState.is_blank ? 'bg-red-500 animate-pulse' : 'bg-black border border-gray-600'}`}></div> 
              <span>Blank</span>
            </button>
          </div>

          <div className="flex items-center gap-3 lg:gap-6 shrink-0">
            <nav className="hidden lg:flex items-center gap-5 xl:gap-7 text-xs font-medium text-gray-400 h-full">
              <button 
                onClick={() => { setRightPanelTab('schedule'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-1.5 transition-colors h-[56px] relative ${rightPanelTab === 'schedule' ? 'text-(--accent-color)' : 'hover:text-white'}`} title="Schedule">
                <ListOrdered size={16} /> <span className="hidden xl:inline">Schedule</span>
                {rightPanelTab === 'schedule' && <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent-color) rounded-t-full`}></div>}
              </button>
              <button 
                onClick={() => { setRightPanelTab('scriptures'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-1.5 transition-colors h-[56px] relative ${rightPanelTab === 'scriptures' ? 'text-(--accent-color)' : 'hover:text-white'}`} title="Scriptures">
                <BookOpen size={16} /> <span className="hidden xl:inline">Scriptures</span>
                {rightPanelTab === 'scriptures' && <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent-color) rounded-t-full`}></div>}
              </button>
              <button 
                onClick={() => { setRightPanelTab('lyrics'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-1.5 transition-colors h-[56px] relative ${rightPanelTab === 'lyrics' ? 'text-(--accent-color)' : 'hover:text-white'}`} title="Lyrics">
                <Music size={16} /> <span className="hidden xl:inline">Lyrics</span>
                {rightPanelTab === 'lyrics' && <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent-color) rounded-t-full`}></div>}
              </button>
              <button 
                onClick={() => { setRightPanelTab('notes'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-1.5 transition-colors h-[56px] relative ${rightPanelTab === 'notes' ? 'text-(--accent-color)' : 'hover:text-white'}`} title="Notes">
                <FileText size={16} /> <span className="hidden xl:inline">Notes</span>
                {rightPanelTab === 'notes' && <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent-color) rounded-t-full`}></div>}
              </button>
              <button 
                onClick={() => { setRightPanelTab('archive'); setIsRightPanelOpen(true); }}
                className={`flex items-center gap-1.5 transition-colors h-[56px] relative ${rightPanelTab === 'archive' ? 'text-red-400' : 'hover:text-white'}`} title="Capture Sermon Audio">
                <Radio size={16} className={recorderStatus.isRecording ? 'text-red-400 animate-pulse' : ''} /> <span className="hidden xl:inline">Recorder</span>
                {rightPanelTab === 'archive' && <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-red-400 rounded-t-full`}></div>}
              </button>
            </nav>

            <div className="w-px h-6 bg-gray-700/50 mx-2 hidden lg:block"></div>

            <div className="flex items-center gap-4 text-gray-400">
              
              <button 
                onClick={async () => {
                  try {
                    if ((window as any).sermonSync?.openProjector) {
                      const isActive = await (window as any).sermonSync.openProjector();
                      setIsProjectorActive(isActive);
                    } else {
                      window.open(window.location.origin + window.location.pathname + '?projector', 'ProjectorWindow', 'width=1280,height=720');
                    }
                  } catch (err) {
                    console.error('Projector Launch Failed:', err);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all active:scale-95 group ${isProjectorActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/5'}`} 
                title={isProjectorActive ? "Stop TV Broadcast" : "Launch TV / Projector"}>
                <Cast size={18} className={isProjectorActive ? 'animate-pulse' : 'group-hover:animate-pulse'} />
                <span className="text-[10px] font-black uppercase tracking-widest">{isProjectorActive ? 'LIVE ON TV' : 'Projector'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden bg-black/20">
          
          {/* COLUMN 1: INTEGRATED FEED (LEFT) */}
          <section className="w-72 max-w-[20%] min-w-[240px] flex flex-col bg-(--bg-secondary) border-r border-(--border-color) shrink animate-in slide-in-from-left-8 duration-500 overflow-hidden transition-colors">
             
             {/* TOP: LIVE TRANSCRIPTION */}
             <div className="flex-[0.6] flex flex-col min-h-0 border-b border-(--border-color)">
                <div className="h-[56px] p-4 flex items-center justify-between bg-(--bg-primary) border-b border-(--border-color)">
                   <div className="flex items-center gap-2">
                      <Activity size={14} className="text-(--accent-color) animate-pulse" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-(--text-primary)">Transcript</h3>
                   </div>
                   <div className="flex items-center gap-2">
                     <button onClick={handleSnapshotToNotes} className="px-2 py-1 bg-white/5 hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-400 border border-white/10 rounded uppercase text-[8px] font-black tracking-widest transition-colors flex items-center gap-1" title="Snapshot to Notes">
                       <Save size={10} /> 
                     </button>
                     {isListening && <span className="text-[8px] font-bold text-(--accent-color)/60 uppercase tracking-widest">Live</span>}
                   </div>
                </div>
                
                <div ref={transcriptScrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 no-scrollbar bg-(--bg-primary)/50 relative">

                   {(!liveState.transcription_feed || liveState.transcription_feed.length === 0) && !interimText ? (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                        <FileText size={24} className="mb-2" />
                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">Feed Initialized</p>
                     </div>
                   ) : (
                     <>
                        {Array.isArray(liveState.transcription_feed) && liveState.transcription_feed.map((sentence: any, i: number, arr: any[]) => {
                          const isRecent = i >= arr.length - 2;
                          const timeStr = new Date(sentence.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          return (
                            <div key={sentence.id} className="animate-in slide-in-from-bottom-1 duration-200 px-1 mb-3">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/60">
                                  Live Feed
                                </span>
                                <span className="text-[8px] font-mono text-gray-400">[{timeStr}]</span>
                              </div>
                              <p className={`text-xs leading-relaxed transition-all ${
                                isRecent ? 'text-white font-black' : 'text-gray-400 font-normal'
                              }`}>
                                {sentence.text.trim()}{sentence.text.trim().match(/[.!?]$/) ? '' : '.'}
                              </p>
                            </div>
                          );
                        })}

                        {interimText && (
                          <div className="mt-1 px-1 border-l-2 border-emerald-500 pl-2 bg-emerald-500/5 py-2 rounded-r">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Listening...</span>
                            </div>
                            <p className="text-xs font-semibold text-white/90 leading-relaxed italic">{interimText}</p>
                          </div>
                        )}
                     </>
                   )}
                 </div>
             </div>

             {/* BOTTOM: QUEUE */}
             <div className="flex-[0.4] flex flex-col min-h-0 bg-(--bg-primary)/80">
                <div className="h-[48px] p-4 flex items-center gap-2 bg-black/10 border-b border-(--border-color)">
                   <LayoutGrid size={14} className="text-blue-400" />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-(--text-primary)/60">Queue</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 no-scrollbar">
                   {(!liveState.detection_history || liveState.detection_history.length === 0) ? (
                      <p className="text-[9px] text-gray-700 italic text-center mt-4 uppercase tracking-widest opacity-30">Queue is empty</p>
                   ) : (
                      liveState.detection_history.map((det) => (
                         <div 
                            key={det.id} 
                            onClick={() => {
                               setPreviewVerse(det.verse);
                               setSelectedBook(det.verse.book);
                               setSelectedChapter(det.verse.chapter);
                            }}
                            className="relative flex items-center justify-between px-3 py-2 bg-(--text-primary)/5 hover:bg-(--text-primary)/10 border border-transparent hover:border-(--border-color) border-l-2 border-l-transparent hover:border-l-(--accent-color) rounded-md transition-all cursor-pointer group"
                         >
                            <div className="flex flex-col min-w-0 pr-2">
                               <div className="flex items-baseline gap-1.5">
                                 <span className="text-[9px] font-black text-(--accent-color)/80 uppercase tracking-widest leading-none block">{det.verse.book}</span>
                                 <p className="text-[12px] font-bold text-white tracking-wide leading-none">{det.verse.chapter}:{det.verse.verse_start}</p>
                                 {det.is_paraphrase && (
                                   <span className="text-[7px] font-black bg-(--accent-color)/20 text-(--accent-color) px-1 rounded-[2px] ml-1 uppercase tracking-tighter border border-(--accent-color)/30">AI</span>
                                 )}
                               </div>
                               <span className="text-[8px] font-mono text-gray-500/60 tracking-tighter uppercase mt-1">{new Date(det.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewVerse(det.verse);
                                    setTimeout(() => goLive(), 400);
                                 }}
                                 className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] active:scale-95"
                               >
                                  <Play size={10} fill="currentColor" />
                               </button>
                               <button 
                                  onClick={(e) => {
                                     e.stopPropagation();
                                     removeDetection(det.id);
                                  }}
                                  className="p-1.5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-colors"
                               >
                                  <X size={10} />
                               </button>
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
              <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                <div className="flex items-start gap-4 h-[300px] p-1 shrink-0">
                   <div className="h-full aspect-square flex flex-col items-center justify-center p-6 bg-(--bg-secondary) rounded-3xl border border-(--border-color) relative overflow-hidden group shrink-0 transition-colors">
                      <div className="absolute top-4 left-4 flex items-center gap-2 text-[9px] font-bold tracking-widest text-(--accent-color) bg-(--accent-color)/10 px-2 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-(--accent-color) animate-pulse"></div>
                        PREVIEW
                      </div>
                      {liveState.preview_media ? (
                         <>
                           <div className="w-full h-full flex items-center justify-center p-2">
                             <div className="w-full h-full rounded-2xl overflow-hidden border border-emerald-500/30 bg-black/40 relative group/preview">
                                {liveState.preview_media.match(/\.(mp4|webm|ogg|blob)/i) || liveState.preview_media.includes('#video') ? (
                                   <video 
                                     src={liveState.preview_media} 
                                     className="w-full h-full object-contain" 
                                     autoPlay={liveState.preview_media_playing} 
                                     loop 
                                     playsInline 
                                     id="preview-video-element"
                                     muted={liveState.preview_media_muted ?? false}
                                     ref={(el) => {
                                        if (el) {
                                          el.muted = liveState.preview_media_muted ?? false;
                                          el.volume = liveState.preview_media_volume ?? 1.0;
                                          if (liveState.preview_media_playing) el.play().catch(() => {});
                                          else el.pause();
                                        }
                                     }}
                                   />
                                ) : (liveState.preview_media || '').match(/\.(pdf|doc|docx|ppt|pptx)/i) || (liveState.preview_media || '').includes('#doc') ? (
                                   <iframe src={liveState.preview_media || ''} className="w-full h-full border-0 bg-white" title="Preview Document" />
                                ) : (
                                   <img src={liveState.preview_media || ''} className="w-full h-full object-contain" />
                                )}
                             </div>
                           </div>
                           
                           {/* PREVIEW CONTROL HUB */}
                           <div className="absolute top-4 right-4 flex items-center gap-2 z-20 animate-in slide-in-from-top-2 duration-300">
                              <div className="flex bg-black/60 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-2xl">
                                 <button 
                                   onClick={() => setLiveState((s: any) => ({ ...s, preview_media_playing: !s.preview_media_playing }))}
                                   className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
                                 >
                                   {liveState.preview_media_playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                                 </button>
                                 <div className="w-px h-4 bg-white/10 my-auto mx-1" />
                                 <button 
                                   onClick={() => setLiveState((s: any) => ({ ...s, preview_media_muted: !s.preview_media_muted }))}
                                   className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${!liveState.preview_media_muted ? 'text-emerald-400' : 'text-gray-400'}`}
                                 >
                                   {!liveState.preview_media_muted ? <Volume2 size={12} /> : <VolumeX size={12} />}
                                 </button>
                                 <div className="flex items-center px-2">
                                    <input 
                                      type="range" 
                                      min="0" 
                                      max="1" 
                                      step="0.1" 
                                      value={liveState.preview_media_volume ?? 1}
                                      onChange={(e) => {
                                         const val = parseFloat(e.target.value);
                                         setLiveState((s: any) => ({ ...s, preview_media_volume: val }));
                                      }}
                                      className="w-12 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500 transition-all"
                                    />
                                 </div>
                              </div>
                           </div>
                         </>
                      ) : liveState.preview_lyric_line ? (
                         <div className="w-full h-full flex flex-col justify-center p-4 gap-2">
                           <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70 text-center">{currentSong?.title}</p>
                           <p className="text-sm font-bold text-white text-center leading-relaxed font-serif italic">"{liveState.preview_lyric_line}"</p>
                         </div>
                       ) : displayVersePreview && settings.detectVerses ? (
                        <div className="w-full h-full flex flex-col justify-center relative">
                          <div className="text-center space-y-3 px-4">
                             <h4 className="text-(--accent-color) font-bold text-lg tracking-wide uppercase">{displayVersePreview.reference}</h4>
                             <p className="text-(--text-primary) text-base leading-relaxed font-serif line-clamp-4 italic">"{displayVersePreview.text}"</p>
                          </div>
                          
                          {/* CROSS REFERENCES VIRTUAL DOCK */}
                          {crossRefs.length > 0 && (
                            <div className="absolute bottom-4 left-0 w-full px-4 animate-in slide-in-from-bottom-2 duration-300">
                               <div className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-500 mb-1.5 text-center">See Also</div>
                               <div className="flex flex-wrap justify-center gap-1.5">
                                  {crossRefs.map((ref, idx) => (
                                     <button 
                                       key={idx}
                                       onClick={() => {
                                         setLiveState(s => ({
                                           ...s,
                                           preview_verse: { book: ref.book, chapter: ref.chapter, verse_start: ref.verse_start, verse_end: ref.verse_start }
                                         }));
                                       }}
                                       className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-bold text-gray-300 transition-colors flex items-center gap-1 group/ref"
                                     >
                                        <BookOpen size={9} className="opacity-50 group-hover/ref:opacity-100" />
                                        {ref.book} {ref.chapter}:{ref.verse_start}
                                     </button>
                                  ))}
                               </div>
                            </div>
                          )}
                        </div>
                      ) : liveState.preview_text ? (
                          <div className="w-full h-full flex flex-col justify-center p-4">
                             <p className="text-sm font-bold text-emerald-400 text-center leading-relaxed font-serif italic">"{liveState.preview_text}"</p>
                          </div>
                       ) : (
                         <div className="w-full text-center opacity-30 group-hover:opacity-50 transition-opacity">
                           <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                           <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-300">Ready to Stage</p>
                         </div>
                       )}
                   </div>

                   <div className="flex-1 flex flex-col gap-3 min-w-0 h-full">
                      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black rounded-3xl border-2 border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden group">
                         <div className="absolute inset-0 bg-cover bg-center brightness-[0.35] saturate-[0.8] opacity-60 group-hover:opacity-100 transition-opacity duration-1000" style={{ backgroundImage: `url('${settings.projectorBg}')` }} />
                         <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold tracking-widest text-red-500 bg-red-500/10 px-3 py-1 rounded-full z-10">
                           <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> LIVE ON SCREEN
                         </div>

                         {/* MEDIA CONTROL HUB */}
                         {liveState.current_media && (
                            <div className="absolute top-4 right-4 flex items-center gap-2 z-20 animate-in slide-in-from-top-2 duration-300">
                               <div className="flex bg-black/60 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-2xl">
                                  <button 
                                    onClick={() => {
                                       const videoEl = document.getElementById('live-video-element') as HTMLVideoElement;
                                       const currentTime = videoEl ? videoEl.currentTime : 0;
                                       setLiveState(s => ({ 
                                          ...s, 
                                          media_playing: !s.media_playing,
                                          media_currentTime: s.media_playing ? currentTime : s.media_currentTime
                                       }));
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"
                                  >
                                    {liveState.media_playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                  </button>
                                  <div className="w-px h-4 bg-white/10 my-auto mx-1" />
                                  <button 
                                    onClick={() => setLiveState(s => ({ ...s, media_muted: !s.media_muted }))}
                                    className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${!liveState.media_muted ? 'text-emerald-400' : 'text-gray-400'}`}
                                  >
                                    {!liveState.media_muted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                                  </button>
                                  <div className="flex items-center px-2 group/vol">
                                     <input 
                                       type="range" 
                                       min="0" 
                                       max="1" 
                                       step="0.1" 
                                       value={liveState.media_volume || 1}
                                       onChange={(e) => {
                                          const val = parseFloat(e.target.value);
                                          setLiveState(s => ({ ...s, media_volume: val }));
                                       }}
                                       className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                                     />
                                  </div>
                               </div>
                            </div>
                         )}

                         {liveState.current_media ? (
                           <div className="w-full h-full p-2 z-10 animate-in zoom-in-95 duration-500">
                             <div className="w-full h-full rounded-2xl overflow-hidden border border-red-500/30">
                               {liveState.current_media.match(/\.(mp4|webm|ogg|blob)/i) || liveState.current_media.includes('#video') ? (
                                  <video 
                                     key={(liveState.current_media || '') + '-' + (liveState.media_epoch || 0)}
                                     src={liveState.current_media} 
                                     className="w-full h-full object-contain" 
                                     autoPlay={liveState.media_playing}
                                     loop 
                                     playsInline 
                                     muted
                                     onPlay={(e) => { e.currentTarget.muted = true; e.currentTarget.volume = 0; }}
                                     onVolumeChange={(e) => { e.currentTarget.muted = true; e.currentTarget.volume = 0; }}
                                     id="live-video-element"
                                     ref={(el) => {
                                       if (el) {
                                         // THE UNBREAKABLE SILENCE RULE: 
                                         // Dashboard MUST be silent to prevent echo.
                                         el.muted = true;
                                         el.volume = 0;
                                         if (liveState.media_playing) {
                                           el.play().catch(() => {});
                                         } else {
                                            el.pause();
                                            if (liveState.media_currentTime !== undefined) {
                                               el.currentTime = liveState.media_currentTime;
                                            }
                                         }
                                       }
                                     }}
                                   />
                               ) : (liveState.current_media || '').match(/\.(pdf|doc|docx|ppt|pptx)/i) || (liveState.current_media || '').includes('#doc') ? (
                                  <iframe 
                                    src={liveState.current_media || ''} 
                                    className="w-full h-full border-0 bg-white" 
                                    title="Live Document"
                                  />
                               ) : (
                                  <img src={liveState.current_media || ''} className="w-full h-full object-contain" />
                                )}
                             </div>
                           </div>
                         ) : liveState.current_lyric_line ? (
                            <div className="w-full text-center animate-in fade-in duration-500 px-4 z-10">
                               <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/70 mb-2">{currentSong?.title}</p>
                               <p className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-glow font-serif italic">"{liveState.current_lyric_line}"</p>
                               {liveState.preview_lyric_line && <p className="text-white/30 text-sm italic mt-2">{liveState.preview_lyric_line}</p>}
                            </div>
                          ) : displayVerseLive ? (
                             <div className="w-full text-center animate-in fade-in duration-500 px-4 z-10">
                                <h4 className="text-(--accent-color) font-black text-xs mb-2 tracking-[0.2em] uppercase">{displayVerseLive.reference}</h4>
                                <p className="text-white text-xl font-bold font-serif italic line-clamp-4 leading-relaxed">"{displayVerseLive.text}"</p>
                             </div>
                          ) : liveState.current_text ? (
                             <div className="w-full text-center animate-in fade-in duration-500 px-4 z-10 flex flex-col items-center gap-2">
                                <p className="text-xl font-black tracking-tight drop-shadow-glow italic font-serif text-emerald-400">
                                   "{liveState.current_text}"
                                </p>
                             </div>
                          ) : airedLyric ? (
                            <div className="w-full text-center animate-in slide-in-from-bottom-4 duration-500 px-4 z-10">
                               <p className="text-2xl lg:text-3xl font-black text-(--accent-color) tracking-tight leading-none drop-shadow-glow mb-2">{airedLyric}</p>
                               {nextLyric && <p className="text-white/40 text-sm italic">{nextLyric}</p>}
                            </div>
                          ) : (
                            <div className="opacity-10 flex flex-col items-center">
                               <Monitor size={80} className="text-white mb-6" />
                               <p className="text-[12px] font-black uppercase tracking-[0.5em] text-white">Awaiting Broadcast</p>
                            </div>
                          )}
                         
                         {liveState.is_logo && (
                           <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-35 flex items-center justify-center animate-in fade-in">
                              {settings.churchLogo && settings.churchLogo !== '/logo-placeholder.png' ? (
                                 <img src={settings.churchLogo} alt="Theme Overlay" className="max-h-[80%] max-w-[80%] object-contain" />
                              ) : (
                                 <div className="p-8 bg-white/5 border border-white/10 rounded-3xl flex flex-col items-center">
                                    <Monitor size={48} className="text-emerald-500/50 mb-3" />
                                    <h2 className="text-xl font-black tracking-[0.4em] uppercase text-emerald-400 text-center">Theme Active</h2>
                                 </div>
                              )}
                           </div>
                         )}
                         
                         {liveState.is_blank && (<div className="absolute inset-0 bg-black z-40 flex items-center justify-center animate-in fade-in">
                           <div className="p-4 bg-red-600/20 border border-red-500/40 rounded-2xl flex flex-col items-center gap-2">
                             <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.8)]"></div>
                             <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em]">Projector Blanked</p>
                           </div>
                         </div>)}
                      </div>
                   </div>
                </div>

                {/* Feature 4: THE CROSS-REFERENCE EXPLORER (Expansion Zone) */}
                <div className="flex-1 bg-(--bg-secondary)/40 border border-white/5 rounded-3xl flex flex-col overflow-hidden relative group">
                   <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2 shrink-0">
                      <div className="flex items-center gap-2">
                         <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg"><Link2 size={12} /></span>
                         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Scriptural Context & Cross-Refs</span>
                      </div>
                      {crossRefs.length > 0 && <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">{crossRefs.length} References Found</span>}
                   </div>
                   
                   <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                      {crossRefs.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center text-center px-10 opacity-10">
                            <BookOpen size={48} className="text-white mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white">No Detection Active</p>
                            <p className="text-[9px] font-medium text-gray-400 mt-2">Awaiting Bible verse detection to find related scriptures...</p>
                         </div>
                      ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {crossRefs.map((ref, idx) => (
                               <div 
                                 key={idx}
                                 className="group/ref-card p-4 bg-black/40 hover:bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-3 transition-all cursor-pointer"
                                 onClick={() => {
                                   setLiveState(s => ({
                                     ...s,
                                     preview_verse: { book: ref.book, chapter: ref.chapter, verse_start: ref.verse_start, verse_end: ref.verse_start }
                                   }));
                                   setActiveView('live');
                                   showToast(`Staged: ${ref.book} ${ref.chapter}:${ref.verse_start}`);
                                 }}
                               >
                                  <div className="flex items-center justify-between">
                                     <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{ref.book} {ref.chapter}:{ref.verse_start}</span>
                                     <ArrowUpRight size={12} className="text-gray-600 group-hover/ref-card:text-blue-400 transition-colors" />
                                  </div>
                                  <p className="text-[11px] text-gray-400 line-clamp-3 leading-relaxed italic group-hover/ref-card:text-gray-200 transition-colors">"{ref.text || 'Fetching related content...'}"</p>
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover/ref-card:opacity-100 transition-opacity">
                                     <button className="flex-1 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest">Preview</button>
                                     <button 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         directAir({
                                           type: 'scripture',
                                           content: ref.text,
                                           reference: `${ref.book} ${ref.chapter}:${ref.verse_start}`
                                         });
                                       }}
                                       className="flex-1 py-1.5 bg-blue-500 text-black rounded-lg text-[8px] font-black uppercase tracking-widest"
                                     >
                                       Air Now
                                      </button>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </div>

                {liveState.ticker_enabled && (liveState.ticker_items?.length ?? 0) > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-10 bg-red-600/40 backdrop-blur-md border-t border-red-500/30 flex items-center overflow-hidden z-20">
                     <div className="animate-marquee h-full flex items-center">
                        <div className="flex shrink-0">{(liveState.ticker_items || []).map((item, i) => (<span key={i} className="px-10 text-[11px] font-black text-white/90 uppercase tracking-widest whitespace-nowrap">{item} <span className="text-red-500/50 mx-4">•</span></span>))}</div>
                     </div>
                  </div>
                )}

                {/* LYRICS KARAOKE CARD — commented out
                {settings.showLyrics && settings.detectSongs && currentSong && currentSong.lyrics && currentSong.lyrics.length > 0 && (
                   <div className="absolute bottom-6 left-10 right-10 p-6 bg-[#161b22]/90 border border-white/5 flex flex-col gap-4 z-10 rounded-3xl backdrop-blur-xl">
                      <div className="flex items-center gap-3 text-gray-400 mb-2">
                         <Music size={16} /> <span className="text-xs uppercase tracking-wider font-semibold">{currentSong.title}</span>
                         <div className="flex-1 h-0.5 bg-white/10 mx-4 rounded-full overflow-hidden"><div className={`h-full w-2/5 rounded-full bg-(--accent-color)`} /></div>
                      </div>
                      <div className="relative pl-8">
                         <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-[2px] rounded-r-md bg-(--accent-color)"></div>
                         <KaraokeLine lyric={mainLyric || '...'} spokenText={fullTranscript} colorClass="text-(--accent-color)" animationClass={settings.highlightAnimation} sizeClass="text-[26px]" />
                         {nextLyric && <p className="text-xl text-gray-400 italic font-serif opacity-80 mt-2">{nextLyric}</p>}
                      </div>
                   </div>
                )}
                */}
              </div>
            ) : activeView === 'history' ? (
              <div className="flex-1 flex flex-col p-10 overflow-hidden bg-(--bg-primary) animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-8">
                   <div className="space-y-1"><h2 className="text-3xl text-white font-black uppercase tracking-widest">Aired History</h2><p className="text-gray-500 text-xs font-medium uppercase tracking-[0.3em]">Session Audit Log • {liveState.history.length} Events</p></div>
                   <button onClick={() => setLiveState(prev => ({ ...prev, history: [] }))} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest">Clear History</button>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                   {liveState.history.length === 0 ? (<div className="h-full flex flex-col items-center justify-center opacity-20"><Activity size={64} className="mb-6" /><p className="text-sm font-black uppercase tracking-[0.5em]">No history recorded</p></div>) : 
                   ([...liveState.history].reverse().map((item, idx) => (
                      <div key={idx} className="flex items-center gap-6 p-6 bg-white/3 border border-white/5 rounded-[32px]">
                         <div className={`p-4 rounded-2xl ${item.type === 'scripture' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-400'}`}>{item.type === 'scripture' ? <BookOpen size={24} /> : <Music size={24} />}</div>
                         <div className="flex-1 min-w-0 pr-10">
                            <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">{item.type} • {new Date(item.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                            {item.reference && <h3 className="text-white font-black text-xl mb-1">{item.reference}</h3>}
                            <p className="text-gray-400 text-sm italic line-clamp-2">{item.content}</p>
                         </div>
                      </div>
                   )))}
                </div>
              </div>
            ) : activeView === 'documents' ? (
              <div className="flex-1 flex flex-col p-10 overflow-hidden bg-(--bg-primary) animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-8">
                   <div className="space-y-1"><h2 className="text-3xl text-white font-black uppercase tracking-widest">Resources</h2><p className="text-gray-500 text-xs font-medium uppercase tracking-[0.3em]">Ready-to-Air Assets</p></div>
                   <div className="flex gap-3">
                      <input type="file" ref={fileInputRef} onChange={handleResourceUpload} style={{ display: 'none' }} accept="image/*,video/*,application/pdf,.doc,.docx,.ppt,.pptx" />
                      <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white/5 text-gray-300 border border-white/10 rounded-xl text-[10px] font-black uppercase">Upload Asset</button>
                      <button onClick={handleNewPoint} className="px-4 py-2 bg-emerald-500 text-black rounded-xl text-[10px] font-black uppercase tracking-widest">New Point</button>
                   </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto no-scrollbar pb-10">
                   {resourceAssets.map((asset, idx) => (
                      <div key={asset.id} className="group p-4 bg-[#1a1a1c] border border-white/5 rounded-2xl flex flex-col gap-3 min-h-[210px] max-h-[210px]">
                         <div className="flex items-center justify-between shrink-0"><div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-500/10 text-gray-400">{asset.icon}</div><button onClick={() => handleDeleteResource(asset.id)} className="p-1 text-gray-700 hover:text-red-500 transition-colors"><X size={12} /></button></div>
                         <div className="flex-1 overflow-y-auto no-scrollbar pt-2">
                           <h3 className="text-[11px] font-black text-gray-200 mb-2 uppercase tracking-wide">{asset.title}</h3>
                           {asset.type === 'media' && asset.url ? (
                              <div className="w-full aspect-video rounded-lg overflow-hidden bg-black border border-white/5 ring-1 ring-white/5 shadow-inner">
                                {asset.url.includes('#video') || asset.url.match(/\.(mp4|webm|ogg)/i) ? 
                                  <video src={asset.url} className="w-full h-full object-contain" muted /> : 
                                  <img src={asset.url} className="w-full h-full object-contain" />
                                }
                              </div>
                           ) : (
                              <p className="text-gray-500 text-[10px] leading-snug italic line-clamp-3">{asset.content || asset.detail}</p>
                           )}
                           {asset.type === 'scripture' && <p className="text-[10px] text-emerald-500 font-bold mt-1 uppercase tracking-tighter">{asset.reference}</p>}
                        </div>
                         <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-white/5">
                            <button onClick={() => { if (asset.type === 'media') setLiveState(prev => ({ ...prev, preview_media: asset.url })); else if (asset.type === 'scripture') { const pts = asset.reference?.match(/^(.+)\s+(\d+):(\d+)/); if (pts) setPreviewVerse({ book:pts[1], chapter:parseInt(pts[2]), verse_start:parseInt(pts[3]), verse_end:parseInt(pts[3]) }); } else setLiveState(prev => ({ ...prev, preview_text: asset.content })); setActiveView('live'); }} className="flex-1 py-2 bg-white/5 text-white rounded-lg text-[8px] font-bold uppercase">PREVIEW</button>
                            <button onClick={() => { directAir({ type: (asset.type === 'media' ? 'lyrics' : asset.type) as any, content: asset.content || (asset.type === 'scripture' ? `${asset.reference}: ${asset.detail}` : ''), media: asset.type === 'media' ? asset.url : null, reference: asset.type === 'scripture' ? asset.reference : undefined }); setActiveView('live'); }} className="flex-1 py-2 bg-emerald-600 text-black rounded-lg text-[8px] font-bold uppercase">AIR NOW</button>
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 z-10 flex">
                 <SettingsView settings={draftSettings} onUpdate={updateDraftSetting} onSave={commitSettings} />
              </div>
            )}
          </div>

          {/* Right Panel */}
          {isRightPanelOpen && (
            <aside className="w-80 max-w-[25%] min-w-[280px] bg-[#161616] border-l border-white/5 flex flex-col shadow-2xl shrink z-20 animate-in slide-in-from-right-8 duration-300">
              <div className="h-[56px] flex items-center justify-between px-6 border-b border-white/5 font-medium text-xs text-gray-300">
                <button 
                  onClick={() => setIsRightPanelOpen(false)}
                  className="flex items-center gap-2 hover:text-white transition-colors capitalize">
                  <ChevronRight size={16} /> {rightPanelTab}
                </button>
                <button onClick={() => setProjector(true)} title="Launch Projector from Panel" className="p-1 hover:bg-white/5 rounded-md transition-colors text-gray-400 hover:text-white">
                  <LayoutGrid size={16} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 pb-8 flex flex-col bg-[#0d0d0d]">
                
                {/* Schedule Tab */}
                {rightPanelTab === 'schedule' && (
                  <div className="flex flex-col h-full overflow-hidden space-y-4 animate-in slide-in-from-right-4">
                     <div className="shrink-0 flex items-center justify-between pb-3 border-b border-white/5">
                        <h3 className="text-white font-bold text-base flex items-center gap-2">
                           <ListOrdered size={16} className="text-(--accent-color)" /> Service Plan
                        </h3>
                        <div className="flex items-center gap-1">
                           <button 
                              onClick={() => { if(confirm("Reset to standard rundown?")) resetToMasterRundown(); }}
                              className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                           >
                              <RefreshCw size={10} /> Reset
                           </button>
                           <button 
                              onClick={() => setIsEditingPlan(!isEditingPlan)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors ${
                                isEditingPlan ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-400 hover:text-white'
                              }`}
                           >
                              {isEditingPlan ? <Check size={12} /> : <Edit2 size={12} />}
                              {isEditingPlan ? 'Done' : 'Edit'}
                           </button>
                        </div>
                     </div>
                     
                     {expandedBlockId && (
                        <div className="flex items-center gap-2 mb-2 animate-in slide-in-from-left-4 duration-300">
                           <button 
                              onClick={() => setExpandedBlockId(null)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                              title="Back to Rundown"
                           >
                              <ArrowLeft size={14} />
                           </button>
                        </div>
                     )}

                     <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-10">
                        {servicePlan.map((item, idx) => {
                           if (expandedBlockId && item.id !== expandedBlockId) return null;
                           
                           const isLive = idx === currentPlanIndex;
                           const isExpanded = item.id === expandedBlockId;
                           const itemCount = (item.songs?.length || 0) + (item.scriptures?.length || 0) + (item.mediaItems?.length || 0);
                           
                           if (isEditingPlan) {
                              return (
                                 <div key={item.id} className="p-3 bg-[#1c1c1f] rounded-xl border border-white/10 flex flex-col gap-3 animate-in fade-in">
                                    <div className="flex items-center gap-3">
                                       <div className="flex flex-col gap-1 shrink-0">
                                          <button disabled={idx === 0} onClick={() => { const nu = [...servicePlan]; [nu[idx-1], nu[idx]] = [nu[idx], nu[idx-1]]; saveServicePlan(nu); }} className="p-1 text-gray-600 hover:text-white disabled:opacity-20"><ArrowUp size={14} /></button>
                                          <button disabled={idx === servicePlan.length - 1} onClick={() => { const nu = [...servicePlan]; [nu[idx+1], nu[idx]] = [nu[idx], nu[idx+1]]; saveServicePlan(nu); }} className="p-1 text-gray-600 hover:text-white disabled:opacity-20"><ArrowDown size={14} /></button>
                                       </div>
                                       <div className="flex-1 flex flex-col gap-2">
                                          <input 
                                             type="text" 
                                             value={item.title} 
                                             onChange={(e) => { const nu = [...servicePlan]; nu[idx].title = e.target.value; saveServicePlan(nu); }}
                                             className="bg-black/50 border border-white/10 text-white text-sm font-bold px-3 py-1.5 rounded-md focus:outline-none focus:border-(--accent-color)"
                                          />
                                          <select 
                                             value={item.type}
                                             onChange={(e) => { const nu = [...servicePlan]; nu[idx].type = e.target.value; saveServicePlan(nu); }}
                                             className="bg-black/50 border border-white/10 text-gray-400 text-xs px-2 py-1.5 rounded-md focus:outline-none focus:border-(--accent-color) uppercase font-bold tracking-widest"
                                          >
                                             <option value="prayer">Prayer</option>
                                             <option value="worship">Worship</option>
                                             <option value="praise">Praise</option>
                                             <option value="sermon">Sermon</option>
                                             <option value="scripture">Scripture</option>
                                             <option value="announcement">Announcement</option>
                                             <option value="media">Media</option>
                                             <option value="closing">Closing</option>
                                             <option value="note">Note</option>
                                          </select>
                                       </div>
                                       {!item.fixed && (
                                          <button onClick={() => { const nu = servicePlan.filter((_, i) => i !== idx); saveServicePlan(nu); }} className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 self-start">
                                             <Trash2 size={16} />
                                          </button>
                                       )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 italic px-3 text-center">
                                      Open the folder in main view to manage items.
                                   </div>
                                 </div>
                              );
                           }

                           return (
                              <div 
                                key={item.id}
                                className={`rounded-lg border transition-all relative overflow-hidden ${
                                   isLive 
                                     ? 'ring-1 ring-(--accent-color) border-(--accent-color)/50' 
                                     : 'border-white/5'
                                } ${
                                   isExpanded ? 'bg-[#1c1c1f] shadow-2xl scale-[1.01] -mx-0.5 z-10 p-1.5' : 'bg-[#161618] hover:bg-[#1c1c1f]'
                                }`}
                              >
                                 {/* Folder Header / List View */}
                                 {!isExpanded && (
                                    <div 
                                       onClick={() => setExpandedBlockId(item.id)}
                                       className="p-2.5 flex items-center justify-between cursor-pointer select-none group"
                                    >
                                       <div className="flex items-center gap-2.5">
                                          <div className={`w-7 h-7 flex items-center justify-center rounded-md font-black text-xs ${isLive ? 'bg-(--accent-color) text-black' : 'bg-white/10 text-gray-400 group-hover:bg-white/20'}`}>
                                             {idx + 1}
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                             <h4 className={`font-bold text-sm transition-colors truncate ${isLive ? 'text-white' : 'text-gray-400'}`}>
                                                {item.title}
                                             </h4>
                                             <div className="flex items-center gap-2">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${isLive ? 'bg-(--accent-color)/20 text-(--accent-color)' : 'bg-white/5 text-gray-500'}`}>
                                                   {item.type}
                                                </span>
                                                {itemCount > 0 && (
                                                   <span className="text-[9px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                                   </span>
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          {!isLive && (
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); setCurrentPlanIndex(idx); }}
                                                className="p-1.5 opacity-0 group-hover:opacity-100 bg-emerald-500/10 text-emerald-500 rounded-md hover:bg-emerald-500 hover:text-black transition-all"
                                                title="Make Live Focus"
                                             >
                                                <Play size={14} fill="currentColor" />
                                             </button>
                                          )}
                                          <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-all transform group-hover:translate-x-1" />
                                       </div>
                                    </div>
                                 )}

                                 {/* Dedicated Workspace Interior */}
                                 {isExpanded && (
                                    <div className="px-3 pt-3 pb-6 bg-black/20 rounded-lg animate-in fade-in duration-500">
                                       <div className="flex items-center gap-3 mb-4">
                                          <div className="flex flex-col min-w-0">
                                             <h2 className="text-base font-black text-white truncate">{item.title}</h2>
                                          </div>
                                       </div>

                                       <div className="space-y-4">
                                          {/* Songs */}
                                          {(item.type === 'worship' || item.type === 'praise') && (
                                             <div className="space-y-1.5">
                                                {item.songs && item.songs.length > 0 && (
                                                   <div className="space-y-1">
                                                      {item.songs.map((song, sIdx) => (
                                                         <div key={sIdx} className="flex gap-1.5">
                                                            <button 
                                                               onClick={() => { 
                                                                  loadSong(song); 
                                                                  setRightPanelTab('lyrics'); 
                                                                  setActiveView('live');
                                                                  showToast(`Loaded: ${song.title}`); 
                                                               }}
                                                               className="flex-1 text-left bg-black/40 hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-white/5 flex items-center justify-between group/song transition-all min-w-0"
                                                            >
                                                               <div className="flex items-center gap-2 min-w-0">
                                                                  <span className="text-[9px] font-black text-emerald-500/50">{sIdx + 1}.</span>
                                                                  <span className="text-[11px] font-bold text-gray-300 group-hover/song:text-emerald-400 transition-colors truncate">{song.title}</span>
                                                               </div>
                                                               <Music size={10} className="text-emerald-500 opacity-50 group-hover/song:opacity-100 transition-opacity" />
                                                            </button>
                                                            <button 
                                                               onClick={() => { const nu = [...servicePlan]; nu[idx].songs = nu[idx].songs?.filter((_, i) => i !== sIdx); saveServicePlan(nu); }}
                                                               className="px-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 transition-colors"
                                                            >
                                                               <X size={10} />
                                                            </button>
                                                         </div>
                                                      ))}
                                                   </div>
                                                )}
                                                <button 
                                                   onClick={() => setSongPickerBlockId(item.id)}
                                                   className="w-full flex items-center justify-center gap-1 py-2 bg-emerald-500/5 border border-dashed border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 rounded-lg text-[9px] uppercase font-black tracking-widest transition-all"
                                                >
                                                   <Plus size={12} /> Add Song
                                                </button>
                                             </div>
                                          )}

                                          {/* Scriptures */}
                                          {(item.type === 'sermon' || item.type === 'scripture') && (
                                             <div className="space-y-2">
                                                {item.scriptures && item.scriptures.length > 0 && (
                                                   <div className="space-y-1.5">
                                                      {item.scriptures.map((scr, sIdx) => (
                                                         <div key={sIdx} className="flex gap-2">
                                                            <button 
                                                               onClick={() => { 
                                                                  setSelectedBook(scr.book); 
                                                                  setSelectedChapter(scr.chapter); 
                                                                  setPreviewVerse({ book: scr.book, chapter: scr.chapter, verse_start: scr.verse_start, verse_end: scr.verse_end || scr.verse_start }); 
                                                                  setRightPanelTab('scriptures'); 
                                                                  setActiveView('live');
                                                                  showToast(`Ready: ${scr.reference}`); 
                                                               }}
                                                               className="flex-1 text-left bg-black/40 hover:bg-blue-500/10 px-3 py-2 rounded-lg border border-white/5 shadow-inner flex items-center justify-between group/scr transition-all"
                                                            >
                                                               <div className="flex items-center gap-2 min-w-0">
                                                                  <span className="text-[10px] font-black text-blue-500/50">{sIdx + 1}.</span>
                                                                  <span className="text-xs font-bold text-gray-300 group-hover/scr:text-blue-400 transition-colors">{scr.reference}</span>
                                                               </div>
                                                               <BookOpen size={12} className="text-blue-500 opacity-50 group-hover/scr:opacity-100 transition-opacity" />
                                                            </button>
                                                            <button 
                                                               onClick={() => { const nu = [...servicePlan]; nu[idx].scriptures = nu[idx].scriptures?.filter((_, i) => i !== sIdx); saveServicePlan(nu); }}
                                                               className="px-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 transition-colors"
                                                            >
                                                               <X size={12} />
                                                            </button>
                                                         </div>
                                                      ))}
                                                   </div>
                                                )}
                                                <button 
                                                   onClick={() => setScripturePickerBlockId(item.id)}
                                                   className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-500/5 border border-dashed border-blue-500/30 text-blue-500 hover:bg-blue-500/10 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all"
                                                >
                                                   <Plus size={14} /> Add Scripture
                                                </button>
                                             </div>
                                          )}

                                          {/* Media */}
                                          {item.type === 'media' && (
                                             <div className="space-y-2">
                                                {item.mediaItems && item.mediaItems.length > 0 && (
                                                   <div className="space-y-1.5">
                                                      {item.mediaItems.map((med, sIdx) => (
                                                         <div key={sIdx} className="flex gap-2">
                                                            <button 
                                                               onClick={() => { 
                                                                  setLiveState((s: any) => ({ ...s, preview_media: med.url, updated_at: new Date().toISOString() })); 
                                                                  setRightPanelTab('broadcast'); 
                                                                  setActiveView('live');
                                                                  showToast(`Staged: ${med.name}`); 
                                                               }}
                                                               className="flex-1 text-left bg-black/40 hover:bg-purple-500/10 px-3 py-2 rounded-lg border border-white/5 shadow-inner flex items-center justify-between group/med transition-all"
                                                            >
                                                               <div className="flex items-center gap-2 min-w-0">
                                                                  <span className="text-[10px] font-black text-purple-500/50">{sIdx + 1}.</span>
                                                                  <span className="text-xs font-bold text-gray-300 group-hover/med:text-purple-400 transition-colors truncate">{med.name}</span>
                                                               </div>
                                                               <Monitor size={12} className="text-purple-500 opacity-50 group-hover/med:opacity-100 transition-opacity" />
                                                            </button>
                                                            <button 
                                                               onClick={() => { const nu = [...servicePlan]; nu[idx].mediaItems = nu[idx].mediaItems?.filter((_, i) => i !== sIdx); saveServicePlan(nu); }}
                                                               className="px-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 transition-colors"
                                                            >
                                                               <X size={12} />
                                                            </button>
                                                         </div>
                                                      ))}
                                                   </div>
                                                )}
                                                <label className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-purple-500/5 border border-dashed border-purple-500/30 text-purple-500 hover:bg-purple-500/10 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all cursor-pointer">
                                                   <input type="file" accept="video/*,image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const nu = [...servicePlan]; const type = file.type.startsWith('video') ? 'video' : 'image'; const url = URL.createObjectURL(file); nu[idx].mediaItems = nu[idx].mediaItems || []; nu[idx].mediaItems?.push({ type, url, name: file.name }); saveServicePlan(nu); } }} />
                                                   <Plus size={14} /> Add Media
                                                </label>
                                             </div>
                                          )}

                                          {/* Text Content (Announcements, Testimonies, Notes) */}
                                          {(item.type === 'announcement' || item.type === 'note' || item.type === 'testimony') && (
                                             <div className="space-y-4">
                                                {item.textItems && item.textItems.length > 0 && (
                                                   <div className="space-y-1.5">
                                                      {item.textItems.map((txt, sIdx) => (
                                                         <div key={txt.id} className="flex gap-2">
                                                            <button 
                                                               onClick={() => { 
                                                                  setLiveState((s: any) => ({ 
                                                                     ...s, 
                                                                     preview_text: txt.content, 
                                                                     updated_at: new Date().toISOString() 
                                                                  })); 
                                                                  setRightPanelTab('broadcast'); 
                                                                  setActiveView('live');
                                                                  showToast(`Staged: ${txt.title}`); 
                                                               }}
                                                               className="flex-1 text-left bg-black/40 hover:bg-emerald-500/10 px-3 py-2.5 rounded-xl border border-white/5 shadow-inner flex items-center justify-between group/txt transition-all"
                                                            >
                                                               <div className="flex items-center gap-2 min-w-0">
                                                                  <span className="text-[10px] font-black text-emerald-500/50">{sIdx + 1}.</span>
                                                                  <span className="text-xs font-bold text-gray-300 group-hover/txt:text-white transition-colors truncate">{txt.title}</span>
                                                               </div>
                                                               <FileText size={12} className="text-emerald-500 opacity-50 group-hover/txt:opacity-100 transition-opacity" />
                                                            </button>
                                                            <button 
                                                               onClick={() => { const nu = [...servicePlan]; nu[idx].textItems = nu[idx].textItems?.filter((_, i) => i !== sIdx); saveServicePlan(nu); }}
                                                               className="px-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 transition-colors"
                                                            >
                                                               <X size={12} />
                                                            </button>
                                                         </div>
                                                      ))}
                                                   </div>
                                                )}

                                                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2">
                                                   <input 
                                                      type="text" 
                                                      placeholder="Title (e.g. Next Meeting)" 
                                                      value={newTextTitle}
                                                      onChange={(e) => setNewTextTitle(e.target.value)}
                                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white focus:border-emerald-500/50 outline-none"
                                                   />
                                                   <textarea 
                                                      placeholder="Paste or write content here..." 
                                                      value={newTextContent}
                                                      onChange={(e) => setNewTextContent(e.target.value)}
                                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300 focus:border-emerald-500/50 outline-none min-h-[80px] no-scrollbar"
                                                   />
                                                   <button 
                                                      onClick={() => {
                                                         if (!newTextTitle.trim()) return showToast("Title required");
                                                         const nu = [...servicePlan];
                                                         nu[idx].textItems = nu[idx].textItems || [];
                                                         nu[idx].textItems?.push({ id: crypto.randomUUID(), title: newTextTitle, content: newTextContent });
                                                         saveServicePlan(nu);
                                                         setNewTextTitle('');
                                                         setNewTextContent('');
                                                         showToast("Item Added");
                                                      }}
                                                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 rounded-lg text-[10px] uppercase font-black tracking-widest transition-all"
                                                   >
                                                      <Plus size={14} /> Add Text Item
                                                   </button>
                                                </div>
                                             </div>
                                          )}

                                          {itemCount === 0 && !(['announcement', 'note', 'testimony'].includes(item.type)) && (
                                             <div className="mb-8 p-12 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center opacity-40">
                                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                                   <Folder size={32} />
                                                </div>
                                                <p className="text-base font-bold text-gray-300 mb-1">This folder is empty</p>
                                                <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">Add songs, scriptures or media below</p>
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 )}
                              </div>
                           );
                        })}

                        {isEditingPlan && (
                           <button 
                             onClick={() => {
                               const newItem = { id: crypto.randomUUID(), title: 'New Item', type: 'note', songs: [] };
                               saveServicePlan([...servicePlan, newItem]);
                             }}
                             className="w-full py-4 border-2 border-dashed border-white/10 hover:border-emerald-500/50 rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors uppercase font-black text-[10px] tracking-widest"
                           >
                              <Plus size={16} /> Add Item
                           </button>
                        )}
                     </div>

                     {/* Song Picker Overlay (Floating) */}
                     {songPickerBlockId && (
                        <div className="absolute inset-0 z-50 bg-[#0d0d0d]/98 backdrop-blur-xl flex flex-col p-5 animate-in slide-in-from-bottom-8">
                           <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                              <h3 className="text-white font-black text-lg flex items-center gap-2"><Music size={18} className="text-emerald-500" /> SELECT SONG</h3>
                              <button onClick={() => { setSongPickerBlockId(null); setSongPickerQuery(''); setSongPickerResults([]); }} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"><X size={20} /></button>
                           </div>
                           
                           <div className="relative group mb-4">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
                              <input 
                                 type="text" autoFocus placeholder="Search 10,000+ local songs..." 
                                 value={songPickerQuery}
                                 onChange={async (e) => {
                                    const q = e.target.value; 
                                    setSongPickerQuery(q);
                                    if (q.trim().length > 1) {
                                       try {
                                          const results = await searchLyrics(q, 'All');
                                          setSongPickerResults(results);
                                       } catch(err) {
                                          console.error('Song search failed', err);
                                       }
                                    } else {
                                       setSongPickerResults([]);
                                    }
                                 }}
                                 className="w-full bg-[#1c1c1f] border border-white/5 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-white shadow-inner focus:border-emerald-500/50 outline-none transition-all"
                              />
                           </div>
                           
                           <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-10">
                              {songPickerResults.length === 0 ? (
                                 <div className="flex flex-col items-center justify-center p-10 opacity-30">
                                    <Music size={48} className="text-gray-500 mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 text-center">Type a song title or lyrics<br/>to attach it to the playlist</p>
                                 </div>
                              ) : songPickerResults.map(s => (
                                 <button 
                                    key={s.id}
                                    onClick={() => {
                                       const nu = [...servicePlan];
                                       const blk = nu.find(b => b.id === songPickerBlockId);
                                       if (blk) {
                                          blk.songs = blk.songs || [];
                                          if (blk.songs.length < 10) blk.songs.push(s);
                                       }
                                       saveServicePlan(nu);
                                       setSongPickerBlockId(null);
                                       setSongPickerQuery('');
                                       setSongPickerResults([]);
                                    }}
                                    className="w-full bg-white/5 hover:bg-white/10 hover:border-emerald-500/50 border border-white/5 p-4 rounded-xl flex items-center justify-between text-left transition-all group"
                                 >
                                    <div className="flex flex-col gap-1 min-w-0 pr-4">
                                       <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{s.title}</span>
                                       <span className="text-[10px] uppercase tracking-widest font-black text-gray-500">{s.artist || 'Traditional'}</span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-black transition-colors shrink-0">
                                       <Plus size={16} />
                                    </div>
                                 </button>
                              ))}
                           </div>
                        </div>
                     )}

                     {/* Scripture Picker Overlay (Floating) */}
                     {scripturePickerBlockId && (
                        <div className="absolute inset-0 z-50 bg-[#0d0d0d]/98 backdrop-blur-xl flex flex-col p-5 animate-in slide-in-from-bottom-8">
                           <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                              <h3 className="text-white font-black text-lg flex items-center gap-2"><BookOpen size={18} className="text-emerald-500" /> SELECT SCRIPTURE</h3>
                              <button onClick={() => setScripturePickerBlockId(null)} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"><X size={20} /></button>
                           </div>
                           
                           <div className="grid grid-cols-1 gap-4">
                              <div className="space-y-1.5">
                                 <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Book of the Bible</label>
                                 <select 
                                    className="w-full bg-[#1c1c1f] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none"
                                    value={pickerSelectedBook}
                                    onChange={(e) => {
                                       setPickerSelectedBook(e.target.value);
                                       setPickerSelectedChapter(1);
                                    }}
                                 >
                                    {bibleBooks.map(b => <option key={b} value={b}>{b}</option>)}
                                 </select>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                 <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Chapter</label>
                                    <input 
                                       type="number" 
                                       min={1}
                                       max={BIBLE_CHAPTER_COUNTS[pickerSelectedBook] || 150}
                                       className="w-full bg-[#1c1c1f] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none"
                                       value={pickerSelectedChapter}
                                       onChange={(e) => setPickerSelectedChapter(Number(e.target.value))}
                                    />
                                 </div>
                                 <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Start Verse</label>
                                    <input 
                                       type="number" 
                                       min={1}
                                       className="w-full bg-[#1c1c1f] border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none"
                                       value={pickerSelectedVerse}
                                       onChange={(e) => setPickerSelectedVerse(Number(e.target.value))}
                                    />
                                 </div>
                              </div>

                              <button 
                                 onClick={() => {
                                    const nu = [...servicePlan];
                                    const blk = nu.find(b => b.id === scripturePickerBlockId);
                                    if (blk) {
                                       blk.scriptures = blk.scriptures || [];
                                       blk.scriptures.push({
                                          book: pickerSelectedBook,
                                          chapter: pickerSelectedChapter,
                                          verse_start: pickerSelectedVerse,
                                          reference: `${pickerSelectedBook} ${pickerSelectedChapter}:${pickerSelectedVerse}`
                                       });
                                    }
                                    saveServicePlan(nu);
                                    setScripturePickerBlockId(null);
                                 }}
                                 className="w-full py-4 mt-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                              >
                                 Attach to Schedule
                              </button>
                           </div>
                        </div>
                     )}
                  </div>
                )}

                {/* Sermon Archive Tab */}
                {rightPanelTab === 'archive' && (
                   <div className="flex flex-col h-full overflow-hidden space-y-4 animate-in slide-in-from-right-4">
                      <div className="shrink-0 flex items-center justify-between pb-3 border-b border-white/5">
                         <h3 className="text-white font-bold text-base flex items-center gap-2">
                            <Radio size={16} className={recorderStatus.isRecording ? 'text-red-500 animate-pulse' : 'text-gray-500'} /> 
                            Sermon Recorder
                         </h3>
                      </div>

                      <div className="bg-black/40 border border-white/5 rounded-xl p-3.5 space-y-3.5 shadow-inner">
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Live Input Level</span>
                            <span className={`text-[10px] font-mono font-bold ${recorderStatus.isRecording ? 'text-red-400' : 'text-gray-500'}`}>
                               {recorderStatus.isRecording 
                                  ? new Date(recorderStatus.duration * 1000).toISOString().substr(14, 5) 
                                  : '00:00'}
                            </span>
                         </div>
                         
                         {/* VU METER SLIM */}
                         <div className="flex items-end gap-[1.5px] h-10 px-1">
                            {Array.from({ length: 40 }).map((_, i) => (
                               <div 
                                  key={i} 
                                  className="flex-1 rounded-t-full transition-all duration-75"
                                  style={{ 
                                     height: `${Math.max(10, Math.min(100, (vuLevel / 255) * 100 * (0.5 + Math.random() * 0.5)))}%`,
                                     backgroundColor: i > 30 ? 'rgb(239, 68, 68)' : (i > 20 ? 'rgb(245, 158, 11)' : 'rgb(16, 185, 129)'),
                                     opacity: (vuLevel / 255) > (i / 40) ? 1 : 0.15
                                  }}
                               />
                            ))}
                         </div>

                         <div className="flex flex-col gap-2">
                            {recorderStatus.isRecording ? (
                               <div className="flex items-center gap-2">
                                  <button 
                                     onClick={() => recorderStatus.isPaused ? recorderService.resume() : recorderService.pause()}
                                     className={`flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg border ${
                                        recorderStatus.isPaused 
                                           ? 'bg-blue-500/10 text-blue-500 border-blue-500/30 hover:bg-blue-500 hover:text-white' 
                                           : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500 hover:text-white'}`}
                                  >
                                     {recorderStatus.isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                                     {recorderStatus.isPaused ? 'Resume' : 'Pause'}
                                  </button>
                                  <button 
                                     onClick={stopRecording}
                                     className="flex-1 py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white"
                                  >
                                     <Square size={12} fill="currentColor" />
                                     Stop & Save
                                  </button>
                               </div>
                            ) : (
                               <button 
                                  onClick={startRecording}
                                  className="w-full py-2.5 rounded-lg font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg bg-emerald-500 text-black border border-emerald-400/50 hover:bg-emerald-400"
                               >
                                  <Mic size={14} />
                                  Start Recording
                               </button>
                            )}

                            {recorderStatus.isRecording && (
                               <p className={`text-[8px] text-center font-medium uppercase tracking-widest ${recorderStatus.isPaused ? 'text-amber-500/60' : 'text-red-500/60 animate-pulse'}`}>
                                  {recorderStatus.isPaused ? 'Recording Paused' : 'Recording High-Fidelity Opus @ 128kbps'}
                                </p>
                            )}
                         </div>
                      </div>

                      {/* STATUS INFO */}
                      <div className="mt-1 space-y-2">
                         <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg flex items-center gap-3">
                            <Save size={16} className="text-emerald-500/50" />
                            <div className="flex-1">
                               <h4 className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Safety Backup</h4>
                               <p className="text-[8px] text-gray-500 font-medium leading-none">Auto-saving chunks every 5s</p>
                            </div>
                         </div>
                         <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg flex items-center gap-3">
                            <RefreshCw size={16} className="text-blue-500/50" />
                            <div className="flex-1">
                               <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Local Export</h4>
                               <p className="text-[8px] text-gray-500 font-medium leading-none">Direct Download to PC</p>
                            </div>
                         </div>
                      </div>
                   </div>
                )}

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
                         onChange={(e) => setLiveState((s: any) => ({ ...s, ticker_enabled: e.target.checked, updated_at: new Date().toISOString() }))}
                         className="accent-emerald-500 h-5 w-5 bg-black cursor-pointer"
                       />
                     </div>

                     <div className="bg-[#1e1e1e] p-4 rounded-xl border border-white/5 space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Add Scrolling Headline</label>
                        <input 
                          type="text" 
                          placeholder="Type news..."
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                          onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                                const msg = (e.target as HTMLInputElement).value;
                                if (msg) {
                                   setLiveState((s: any) => ({ ...s, ticker_items: [...(s.ticker_items || []), msg], updated_at: new Date().toISOString() }));
                                   (e.target as HTMLInputElement).value = '';
                                }
                             }
                          }}
                        />
                     </div>

                     <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                           <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Queue</span>
                           <button 
                             onClick={() => setLiveState((s: any) => ({ ...s, ticker_items: [], updated_at: new Date().toISOString() }))}
                             className="text-[9px] uppercase text-red-500 hover:text-red-400 font-black"
                           >
                             Clear
                           </button>
                        </div>
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar pb-6">
                           {liveState.ticker_items?.map((item: string, i: number) => (
                             <div key={i} className="group relative bg-[#1c1c1f] hover:bg-[#252525] p-2.5 rounded-lg border border-white/5 transition-all">
                                <p className="text-xs text-gray-200 pr-8 leading-tight">{item}</p>
                                <button 
                                  onClick={() => setLiveState((s: any) => ({ ...s, ticker_items: s.ticker_items?.filter((_: any, idx: number) => idx !== i), updated_at: new Date().toISOString() }))}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-red-500 font-black text-[9px] opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  DEL
                                </button>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
                )}


                {/* Scriptures Tab */}
                {rightPanelTab === 'scriptures' && (
                  <div className="flex flex-col h-full overflow-hidden space-y-3">
                    {/* TOP CONTROLS: QUICK-FIRE & FILTERS */}
                    <div className="shrink-0 flex flex-col gap-1.5 mt-1">
                       <div className="relative group flex items-center">
                          <Activity size={10} className="absolute left-2 text-emerald-500 animate-pulse" />
                          <input 
                            type="text"
                            placeholder="Quick Verse (e.g. Gen 1:1)"
                            className="w-full bg-[#1c1c1f] border border-emerald-500/20 rounded pl-7 pr-12 py-1 text-[11px] text-white focus:border-emerald-500 outline-none transition-all font-mono"
                            onKeyDown={(e) => {
                               if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.trim();
                                  const match = val.match(/^(\d?\s?[A-Za-z]+)\s+(\d+)[:\s](\d+)/);
                                  if (match) {
                                     const rawBook = match[1].toLowerCase().replace(/\s/g, '');
                                     const chapter = parseInt(match[2], 10);
                                     const verseNum = parseInt(match[3], 10);
                                     
                                     const matchedBook = bibleBooks.find(b => b.toLowerCase().replace(/\s/g, '').startsWith(rawBook));
                                     if (matchedBook) {
                                        setSelectedBook(matchedBook);
                                        setSelectedChapter(chapter);
                                        
                                        setTimeout(() => {
                                           setPreviewVerse({ book: matchedBook, chapter: chapter, verse_start: verseNum, verse_end: verseNum });
                                           (e.target as HTMLInputElement).value = '';
                                        }, 400);
                                     }
                                  }
                               }
                            }}
                          />
                          <div className="absolute right-1 text-[8px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-1 py-0.5 rounded">ENTER</div>
                       </div>

                       <div className="flex items-center gap-1.5">
                          <select
                            value={settings.bibleVersion}
                            onChange={(e) => setSettings(prev => ({ ...prev, bibleVersion: e.target.value }))}
                            className="w-14 bg-[#1e1e1e] border border-white/10 rounded px-1 shrink-0 py-1 text-[10px] text-gray-300 outline-none cursor-pointer"
                          >
                            {bibleVersions.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>

                          <select
                            value={selectedBook}
                            onChange={(e) => { setSelectedBook(e.target.value); setSelectedChapter(1); }}
                            className="flex-1 min-w-0 bg-[#1e1e1e] border border-white/10 rounded px-1 py-1 text-[10px] text-white font-bold tracking-wide outline-none cursor-pointer"
                          >
                            {bibleBooks.map((book) => <option key={book} value={book}>{book}</option>)}
                          </select>

                          <div className="flex items-center bg-white/5 border border-white/5 rounded px-0.5 shrink-0">
                            <button onClick={handlePrevChapter} className="p-1 hover:text-white text-gray-500 transition-colors"><ChevronLeft size={10} /></button>
                            <input
                              type="number"
                              min={1}
                              value={selectedChapter}
                              onChange={(e) => setSelectedChapter(Math.max(1, Math.min(150, Number(e.target.value) || 1)))}
                              className="w-6 bg-transparent text-center py-1 text-[10px] text-white focus:outline-none font-bold placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button onClick={handleNextChapter} className="p-1 hover:text-white text-gray-500 transition-colors"><ChevronRight size={10} /></button>
                          </div>

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
                            className="px-2 shrink-0 py-1 bg-emerald-500 text-black rounded font-black text-[9px] uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95"
                          >
                            Fetch
                          </button>
                       </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <div className="shrink-0 flex items-center justify-between px-1">
                         <h3 className="text-(--accent-color) font-black text-[10px] uppercase tracking-[0.2em]">{selectedBook} {selectedChapter}</h3>
                         <span className="text-[8px] font-bold text-gray-500 uppercase">({settings.bibleVersion})</span>
                      </div>
                      
                      <div 
                        ref={bibleScrollRef}
                        className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar pb-6 pr-1"
                      >
                        {isBibleLoading ? (
                           <div className="flex flex-col items-center justify-center py-10 space-y-2">
                              <RefreshCw size={24} className="text-emerald-500 animate-spin" />
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Retrieving Revelation...</p>
                           </div>
                        ) : chapterVerses.length > 0 ? (
                          chapterVerses.map((v: any) => {
                            const isLive = liveState.current_verse?.book === selectedBook && 
                                           liveState.current_verse?.chapter === selectedChapter && 
                                           liveState.current_verse?.verse_start === v.verse;
                            const isPreview = liveState.preview_verse?.book === selectedBook && 
                                              liveState.preview_verse?.chapter === selectedChapter && 
                                              v.verse >= (liveState.preview_verse?.verse_start || 0) && 
                                              v.verse <= (liveState.preview_verse?.verse_end || liveState.preview_verse?.verse_start || 0);

                            return (
                              <button 
                                key={v.verse}
                                data-active={isPreview || isLive}
                                onClick={(e) => {
                                  if (e.shiftKey && selectionStart !== null) {
                                    const min = Math.min(selectionStart, v.verse);
                                    const max = Math.max(selectionStart, v.verse);
                                    setPreviewVerse({ book: selectedBook, chapter: selectedChapter, verse_start: min, verse_end: max });
                                  } else {
                                    setSelectionStart(v.verse);
                                    setPreviewVerse({
                                      book: selectedBook, chapter: selectedChapter, verse_start: v.verse,
                                      verse_end: 0
                                    });
                                  }
                                }}
                                onDoubleClick={() => {
                                  if (selectionStart === v.verse) {
                                     goLive();
                                  }
                                }}
                                className={`w-full text-left px-2 py-1 rounded border-l-2 transition-all duration-75 min-h-[32px] group
                                  ${isLive 
                                    ? 'bg-(--accent-color)/15 border-(--accent-color)' 
                                    : isPreview 
                                      ? 'bg-white/5 border-(--accent-color)/40' 
                                      : 'bg-transparent border-transparent hover:bg-white/5'}`}
                              >
                                <div className="flex items-start gap-1.5">
                                   <span className={`text-[8px] font-black italic shrink-0 mt-0.5 w-3 text-right ${isLive ? 'text-(--accent-color)' : 'text-gray-500'}`}>{v.verse}</span>
                                   <p className={`text-[11px] leading-snug transition-colors ${isLive ? 'text-white font-medium' : 'text-gray-400 group-hover:text-gray-200'}`}>{v.text}</p>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 bg-white/1 rounded-xl border border-dashed border-white/5">
                            <RefreshCw size={18} className="mx-auto text-gray-600 opacity-20 mb-1 animate-spin-slow" />
                            <p className="text-gray-500 text-[8px] uppercase tracking-widest italic">Verse data unavailable</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {displayVersePreview && settings.detectVerses ? (
                      <div className="shrink-0 bg-[#121212] px-3 py-2 border-t border-(--border-color) shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 absolute bottom-0 left-0 right-0 z-20">
                         <div className="flex-1 min-w-0 pr-2">
                            <h3 className="text-(--accent-color) font-bold text-[11px] tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-0.5">
                               {displayVersePreview.reference} <span className="text-gray-500 font-normal text-[9px] ml-1">({displayVersePreview.translation || settings.bibleVersion})</span>
                            </h3>
                            <p className="text-gray-300 font-serif text-[11px] whitespace-nowrap overflow-hidden text-ellipsis leading-none">{displayVersePreview.text}</p>
                         </div>
                         <button 
                           onClick={goLive}
                           className="px-4 py-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] shadow-[0_0_10px_rgba(16,185,129,0.3)] uppercase tracking-widest rounded transition-all active:scale-95"
                         >
                           AIR
                         </button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {liveState.history.slice(-10).reverse().map((item: any, idx: number) => (
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
                              liveState.history.map((h: any) => `[${new Date(h.timestamp).toLocaleTimeString()}] ${h.type.toUpperCase()}: ${h.reference || ''} ${h.content}`).join('\n');
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
                    <h3 className="text-white font-bold text-base mb-1">Session Notes</h3>
                    {notes.length === 0 ? (
                       <p className="text-gray-500 text-[11px] italic">No snippets captured yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {Array.from(new Map(notes.map(n => [n.id, n])).values()).map((n: any) => (
                          <div key={n.id} className="bg-[#1e1e1e] p-3 rounded-lg border border-white/5 shadow-sm text-[11px] text-gray-300 leading-normal animate-in fade-in slide-in-from-bottom-2">
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
                         onClick={() => { setPasteTitle(''); setPasteLyrics(''); setShowPasteModal(true); }}
                         className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 px-2 py-1 rounded-md"
                       >
                         Live Paste
                       </button>
                    </div>

                     {/* Live Paste Modal */}
                     {showPasteModal && (
                       <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                         <div className="bg-[#131313] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden">
                           <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                             <h3 className="text-white font-black text-base flex items-center gap-2"><Music size={16} className="text-emerald-400" /> Live Paste Lyrics</h3>
                             <button onClick={() => setShowPasteModal(false)} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
                           </div>
                           <div className="p-6 flex flex-col gap-4">
                             <div className="flex flex-col gap-1.5">
                               <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Song Title</label>
                               <input
                                 autoFocus
                                 type="text"
                                 value={pasteTitle}
                                 onChange={e => setPasteTitle(e.target.value)}
                                 placeholder="e.g. Amazing Grace"
                                 className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none transition-all"
                               />
                             </div>
                             <div className="flex flex-col gap-1.5">
                               <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Lyrics — one line per slide</label>
                               <textarea
                                 value={pasteLyrics}
                                 onChange={e => setPasteLyrics(e.target.value)}
                                 placeholder={`Amazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found`}
                                 rows={10}
                                 className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500/50 outline-none transition-all resize-none font-mono leading-relaxed"
                               />
                             </div>
                           </div>
                           <div className="flex gap-3 px-6 pb-6">
                             <button
                               onClick={() => setShowPasteModal(false)}
                               className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 font-black text-[11px] uppercase tracking-widest transition-all"
                             >
                               Cancel
                             </button>
                             <button
                               onClick={() => {
                                 const title = pasteTitle.trim();
                                 const lyrics = pasteLyrics.trim();
                                 if (!title || !lyrics) return;
                                 const lines = lyrics.split('\n').filter(l => l.trim().length > 0);
                                 const newId = `pasted-${Date.now()}`;
                                 const newSong = {
                                   id: newId,
                                   title,
                                   artist: 'Operator',
                                   lyrics: lines.map((l, i) => ({ order: i, line: l.trim() }))
                                 };
                                 addPastedSong(newSong);
                                 savePastedSong(newSong);
                                 setLyricSearchResults(prev => [newSong, ...prev]);
                                 loadSong(newSong);
                                 setShowPasteModal(false);
                                 setPasteTitle('');
                                 setPasteLyrics('');
                                 showToast(`"${title}" loaded & ready!`);
                               }}
                               className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 disabled:pointer-events-none"
                               disabled={!pasteTitle.trim() || !pasteLyrics.trim()}
                             >
                               Load Song
                             </button>
                           </div>
                         </div>
                       </div>
                     )}

                    {/* SEARCH BAR */}
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors" size={14} />
                      <input 
                        type="text"
                        placeholder="Search songs..."
                        value={lyricSearchQuery}
                        onChange={async (e) => {
                           const q = e.target.value;
                           setLyricSearchQuery(q);
                           const results = await searchLyrics(q, selectedLyricCategory);
                           setLyricSearchResults(results);
                        }}
                        className="w-full bg-[#1c1c1f] border border-white/5 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:border-emerald-500/50 outline-none transition-all shadow-inner"
                      />
                    </div>

                    {/* CATEGORY CHIPS */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                       {['All', 'African Praise', 'Contemporary Praise', 'Worship Essentials', 'Pasted'].map(cat => {
                         return (
                           <button
                             key={cat}
                             onClick={async () => {
                               setSelectedLyricCategory(cat);
                               const results = await searchLyrics(lyricSearchQuery, cat === 'Pasted' ? undefined : (cat === 'All' ? undefined : cat));
                               setLyricSearchResults(results);
                             }}
                             className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5
                               ${selectedLyricCategory === cat 
                                 ? 'bg-emerald-500 text-black shadow-emerald-500/20' 
                                 : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white border border-white/5'}`}
                           >
                             {cat}
                           </button>
                         );
                       })}
                    </div>
                    
                    {!currentSong || !settings.detectSongs ? (
                       <div className="space-y-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 px-1">Discover / Selection</p>
                          <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto no-scrollbar pb-10">
                             {lyricSearchResults.map((song: any) => (
                                <button 
                                  key={song.id}
                                  onClick={() => {
                                    loadSong(song);
                                    showToast(`Loaded: ${song.title}`);
                                  }}
                                  className="flex flex-col items-start p-3 bg-white/3 hover:bg-white/8 border border-white/5 rounded-lg transition-all group relative overflow-hidden text-left"
                                >
                                   <div className="flex items-center justify-between w-full mb-0.5">
                                      <span className="text-white font-bold text-xs group-hover:text-emerald-400 transition-colors truncate pr-2">{song.title}</span>
                                      <Music className="text-white/20 group-hover:text-emerald-400/50 transition-colors shrink-0" size={12} />
                                   </div>
                                   <div className="flex items-center justify-between w-full">
                                     <span className="text-gray-500 text-[9px] uppercase tracking-wider font-medium">{song.artist || 'Traditional'}</span>
                                     <div className="flex gap-1">
                                       {song.tags?.slice(0, 2).map((t: string) => (
                                         <span key={t} className="bg-emerald-500/5 text-emerald-400/60 text-[7px] px-1 py-0.5 rounded border border-emerald-500/10 uppercase font-black">{t}</span>
                                       ))}
                                     </div>
                                   </div>
                                   <div className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500 transform translate-y-full group-hover:translate-y-0 transition-transform"></div>
                                </button>
                             ))}
                            {lyricSearchResults.length === 0 && (
                               <div className="text-center py-12 bg-white/1 rounded-2xl border border-dashed border-white/5">
                                  <Search size={32} className="mx-auto text-gray-600 opacity-10 mb-2" />
                                  <p className="text-gray-500 text-xs italic">No songs found. Try a different search term.</p>
                               </div>
                            )}
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 mb-2">
                           <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Now Active</p>
                           <button 
                             onClick={() => loadSong(null)}
                             className="text-[10px] font-black uppercase text-red-500 hover:text-red-400"
                           >
                             Close Song
                           </button>
                        </div>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar pr-1 pb-10">
                         {currentSong?.lyrics?.map((lyricLine: any) => {
                            const isLive = lyricLine.order === liveState.current_lyric_index;
                            const isPreview = lyricLine.order === liveState.preview_lyric_index;
                            return (
                             <div 
                                key={lyricLine.order}
                                className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 group
                                  ${isLive ? 'bg-(--bg-secondary) border-(--accent-color) shadow-lg' 
                                  : isPreview ? 'bg-emerald-500/5 border-emerald-500/30' 
                                  : 'bg-transparent border-(--border-color) opacity-60 hover:opacity-100 hover:border-white/20'}`}
                             >
                               <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className={`text-[10px] font-bold shrink-0 w-5 text-right
                                    ${isLive ? 'text-(--accent-color)' : isPreview ? 'text-emerald-400/70' : 'text-gray-600'}`}>
                                    {lyricLine.order + 1}
                                  </span>
                                  <span className={`text-sm font-medium truncate ${isLive ? 'text-white font-bold' : isPreview ? 'text-gray-200' : 'text-gray-400'}`}>
                                    {lyricLine.line}
                                  </span>
                               </div>
                               <button
                                  onClick={() => airLyricLine(currentSong, lyricLine.order)}
                                  className={`shrink-0 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                                    ${isLive 
                                      ? 'bg-(--accent-color) text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]' 
                                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/20'}`}
                               >
                                 {isLive ? '● Live' : 'AIR'}
                               </button>
                             </div>
                            );
                         })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {rightPanelTab === 'notes' && (
                <div className="p-3 border-t border-white/5 bg-[#161616]">
                  <input 
                    type="text" 
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveNote()}
                    placeholder="Add a note..." 
                    className="w-full bg-[#1c1c1f] text-xs text-white placeholder-gray-500 rounded-lg px-3 py-2 outline-none border border-white/5 focus:border-emerald-500/50 transition-colors shadow-inner"
                  />
                </div>
              )}
            </aside>
          )}
          
        </div>
      </main>

      {/* Full Screen Projector Mode (Redesigned for Premium Cinematic Experience) */}
      {isProjector && (
        <div className={`fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden transition-all duration-700 opacity-100 z-100 pointer-events-auto`}>
          
          {/* ATMOSPHERIC BACKGROUND OVERLAY */}
          <div 
             className="absolute inset-0 bg-cover bg-center brightness-[0.25] saturate-[0.8] transition-all duration-1000 scale-105"
             style={{ 
               backgroundImage: `url('${settings.projectorBg}')`,
               filter: 'blur(5px) contrast(1.1)' 
             }} 
          />
          <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-black opacity-30"></div>

          {/* MEDIA OVERLAY (Offering Images, Slide Decks, Videos) */}
          {liveState.current_media && (
             <div className="absolute inset-0 z-50 flex items-center justify-center animate-in zoom-in-95 duration-1000 bg-black">
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
                        ref={projectorVideoRef}
                        onLoadedMetadata={(e) => {
                           // Heavy-handed re-sync once the file is loaded
                           const el = e.currentTarget;
                           el.muted = liveState.media_muted ?? true;
                           el.volume = liveState.media_volume ?? 1.0;
                        }}
                      />
                   ) : liveState.current_media.match(/\.(pdf|doc|docx|ppt|pptx)/i) || liveState.current_media.includes('#doc') ? (
                      <iframe 
                        src={liveState.current_media} 
                        className="w-full h-full border-0 bg-white" 
                        title="Broadcast Document"
                      />
                   ) : (
                      <img 
                        src={liveState.current_media} 
                        alt="Current Broadcast Media" 
                        className="w-full h-full object-contain"
                      />
                   )}
                   {/* Cinematic Gradient Overlays for Media */}
                   <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent opacity-30"></div>
                </div>

                {/* AUDIO RESCUE OVERLAY (Only shows if browser blocks unmuted play) */}
                {audioBlocked && !liveState.media_muted && (
                   <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
                      <button 
                        onClick={handleBroadcastActivation}
                        className="group flex flex-col items-center gap-6 p-12 bg-emerald-500 hover:bg-emerald-400 text-black rounded-[48px] shadow-[0_30px_60px_rgba(16,185,129,0.3)] transition-all active:scale-95"
                      >
                         <div className="p-6 bg-black/10 rounded-full group-hover:scale-110 transition-transform">
                            <Volume2 size={64} strokeWidth={2.5} />
                         </div>
                         <div className="text-center">
                            <h3 className="text-4xl font-black uppercase tracking-[0.2em] mb-2">Enable Audio</h3>
                            <p className="text-sm font-bold uppercase tracking-widest opacity-60">Tap to start congregation broadcast</p>
                         </div>
                      </button>
                   </div>
                )}
             </div>
          )}

          {/* ESCAPE BUTTON & ROLE SWITCHER */}
          <div className="absolute top-8 right-8 flex items-center gap-4 z-150">
            <div className="flex bg-black/40 rounded-full p-1 border border-white/5 opacity-0 hover:opacity-100 transition-opacity">
               <button 
                 onClick={() => setProjectionRole('audience')}
                 className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${projectionRole === 'audience' ? 'bg-emerald-500 text-black' : 'text-gray-500 hover:text-white'}`}
               >
                 Audience
               </button>
               <button 
                 onClick={() => setProjectionRole('stage')}
                 className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${projectionRole === 'stage' ? 'bg-blue-500 text-black' : 'text-gray-500 hover:text-white'}`}
               >
                 Stage
               </button>
            </div>
            
            <button 
              onClick={() => setProjector(false)}
              className="text-white/5 hover:text-white/40 p-2 transition-all border border-white/5 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className={`w-full max-w-[96vw] relative mx-auto ${liveState.ticker_enabled ? 'h-[70vh] mb-24' : 'h-[80vh]'} flex flex-col items-center justify-center text-center z-10 transition-all duration-700 p-8`}>
            
            {/* LYRICS OVERLAY (Auto Karaoke Mode — only when no song manually loaded) */}
            {settings.showLyrics && settings.detectSongs && mainLyric && !liveState.current_song_id && (
              <div className="w-full absolute bottom-12 flex flex-col items-center animate-in slide-in-from-bottom-8 duration-500">
                <KaraokeLine 
                  lyric={mainLyric} 
                  spokenText={fullTranscript} 
                  colorClass="text-(--accent-color)" 
                  animationClass={settings.highlightAnimation} 
                  sizeClass="text-[88px] font-black tracking-tight leading-tight"
                />
                {nextLyric && <p className="text-[44px] text-gray-400/80 font-medium italic mt-10 tracking-wide font-serif">{nextLyric}</p>}
              </div>
            )}

            {/* SCRIPTURE OVERLAY (Floating High-Contrast Card) */}
            {settings.showVerse && settings.detectVerses && displayVerseLive && (!mainLyric || !settings.showLyrics) && (
              <div className="w-full max-w-[95%] mx-auto flex flex-col items-center justify-center animate-in zoom-in-95 duration-700">
                 {/* PRIMARY BIBLE CARD */}
                 <div className={`glass-panel w-full ${projectionRole === 'stage' ? 'p-10' : 'p-16'} bg-white/3 backdrop-blur-3xl border border-white/10 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group w-full`}>
                   <div className="absolute inset-0 bg-linear-to-br from-white/10 via-transparent to-transparent opacity-30" />
                   
                   <div className={`relative ${projectionRole === 'stage' ? 'space-y-8' : 'space-y-12'}`}>
                      <div className="flex flex-col items-center gap-4">
                         <h2 className={`${projectionRole === 'stage' ? 'text-4xl' : 'text-5xl'} text-(--accent-color) font-black tracking-widest uppercase drop-shadow-glow`}>
                            {displayVerseLive.reference} 
                            <span className="opacity-40 text-2xl font-light ml-4 tracking-normal">({settings.bibleVersion})</span>
                         </h2>
                         <div className="h-1.5 w-24 rounded-full bg-(--accent-color) opacity-60"></div>
                      </div>

                      <p className={`text-white ${projectionRole === 'stage' ? 'text-5xl' : 'text-6xl'} leading-[1.1] font-serif font-bold tracking-tight mx-auto drop-shadow-2xl selection:bg-emerald-500/30 overflow-y-auto max-h-[60vh] no-scrollbar w-full`}>
                         "{displayVerseLive.text}"
                      </p>

                      {/* STAGE-ONLY NOTES */}
                      {projectionRole === 'stage' && notes.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-white/10 text-left">
                           <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Pastor's Private Notes</h4>
                           <div className="grid grid-cols-2 gap-4">
                              {notes.slice(-2).map((n, i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-2xl border border-white/5 text-sm text-gray-300 italic">
                                   {n.content}
                                </div>
                              ))}
                           </div>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            )}

            {/* MANUAL LYRIC OVERLAY (when a song is loaded and a line is aired via AIR button) */}
            {liveState.current_lyric_line && !displayVerseLive && (
               <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center animate-in zoom-in-95 duration-700">
                  <p className="text-[14px] text-emerald-400/60 font-black tracking-[0.4em] uppercase mb-6">{currentSong?.title}</p>
                  <p className={`text-white ${projectionRole === 'stage' ? 'text-6xl max-w-5xl' : 'text-7xl max-w-7xl'} leading-[1.1] font-serif font-bold tracking-tight mx-auto drop-shadow-2xl text-center`}>
                     "{liveState.current_lyric_line}"
                  </p>
                  {liveState.preview_lyric_line && (
                     <p className="text-white/30 text-3xl font-serif italic mt-8 tracking-wide">{liveState.preview_lyric_line}</p>
                  )}
               </div>
            )}

            {/* SERMON POINT OVERLAY (Aired Content Elevation) */}
            {liveState.is_point && liveState.current_text && !displayVerseLive && !liveState.current_lyric_line && (
               <div className="w-full max-w-[95%] mx-auto flex flex-col items-center justify-center animate-in slide-in-from-bottom-12 duration-1000">
                  <div className="glass-panel w-full p-16 bg-white/3 backdrop-blur-3xl border-2 border-amber-500/20 rounded-[64px] shadow-[0_40px_120px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.05),transparent)]" />
                     <div className="relative space-y-10">
                        <div className="flex flex-col items-center gap-4">
                           <div className="px-6 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full">
                              <h2 className="text-2xl text-amber-500 font-black tracking-[0.5em] uppercase">Sermon Point</h2>
                           </div>
                           <div className="h-1 w-32 rounded-full bg-amber-500/40"></div>
                        </div>
                        <p className="text-white text-7xl font-black tracking-tight mx-auto leading-[1.1] drop-shadow-2xl font-serif italic text-center w-full">
                           "{liveState.current_text}"
                        </p>
                     </div>
                  </div>
               </div>
            )}

            {/* FALLBACK: CONTINUOUS TRANSCRIPTION (Atmospheric) */}
            {/* FALLBACK: Projector remains clean when nothing is aired. Live transcription is dashboard-only as requested. */}
            {!liveState.is_point && !displayVerseLive && !liveState.current_lyric_line && (!mainLyric || !settings.showLyrics || liveState.current_song_id) && settings.showTranscript && isListening && (
              <div className="px-12 animate-in fade-in duration-1000 max-w-7xl">
                 <div className="flex items-center justify-center gap-4 opacity-10">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/50 italic">Live Session Active</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150"></div>
                 </div>
              </div>
            )}


            {/* STAGE ONLY ELEMENTS (Timer, Metadata) */}
            {projectionRole === 'stage' && (
              <>
                 {settings.autoShowTimer && (
                  <div className="absolute top-32 right-0 glass-panel px-10 py-5 bg-black/60 border border-white/10 rounded-l-3xl flex items-center gap-6 animate-in fade-in slide-in-from-right-8 duration-700 shadow-2xl z-120">
                     <Activity size={32} className="text-emerald-400 animate-pulse" />
                     <span className="text-white text-6xl font-mono font-black tracking-tighter tabular-nums drop-shadow-glow">
                        {Math.floor(timerSession.remaining / 60)}:{String(timerSession.remaining % 60).padStart(2, '0')}
                     </span>
                  </div>
                )}
                
                {/* NEXT VERSE PREVIEW (Stage Only) */}
                {liveState.preview_verse && (
                   <div className="absolute top-32 left-10 text-left space-y-2 animate-in fade-in slide-in-from-left-8 duration-700">
                      <span className="text-[10px] font-black uppercase text-gray-500 tracking-[0.4em]">Staged Next</span>
                      <h4 className="text-emerald-500 text-3xl font-bold font-serif italic">
                         {liveState.preview_verse.book} {liveState.preview_verse.chapter}:{liveState.preview_verse.verse_start}
                      </h4>
                   </div>
                )}
              </>
            )}
          </div>
          
          {/* THEME OVERLAY (Hides text/media, shows atmospheric logo state) */}

           {liveState.is_logo && (
              <div className="absolute inset-0 z-1000 flex animate-in fade-in flex-col items-center justify-center bg-black">
                 {settings.churchLogo ? (
                    <img src={settings.churchLogo} alt="Theme" className="w-full h-full object-contain" />
                 ) : (
                    <div className="relative flex flex-col items-center justify-center">
                       <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150"></div>
                       <div className="text-white/80 p-16 bg-black/40 backdrop-blur-md shadow-[0_0_100px_rgba(0,0,0,0.5)] rounded-full border border-white/10 flex flex-col items-center">
                          <Monitor size={100} className="mb-8 text-emerald-500/70" />
                          <h2 className="text-4xl font-black tracking-[0.4em] uppercase text-white/50 text-center">
                             Worship Live
                          </h2>
                       </div>
                    </div>
                 )}
              </div>
          )}


          {/* BLANK OVERLAY (Absolute Blackout) */}
          {liveState.is_blank && (
             <div className="absolute inset-0 z-300 bg-black pointer-events-none transition-all duration-700"></div>
          )}
          
          {/* PROJECTOR NEWS TICKER (Broadcast Mode) - Pinned to absolute bottom with maximum z-index layer */}
          {liveState.ticker_enabled && (liveState.ticker_items?.length ?? 0) > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-red-600 border-t-8 border-red-800 flex items-center overflow-hidden z-250 shadow-[0_-20px_50px_rgba(220,38,38,0.4)]">
               {/* BRAND LABEL (High Urgency) */}
               <div className="h-full bg-black px-14 flex items-center justify-center shadow-2xl z-260 shrink-0 border-r-4 border-red-800">
                  <span className="text-white text-5xl font-black uppercase tracking-[0.2em] animate-pulse">LIVE</span>
               </div>
               
               {/* INFINITE SCROLLING CORE */}
               <div className="flex-1 overflow-hidden h-full">
                  <div className="animate-marquee h-full flex items-center whitespace-nowrap">
                     <div className="flex shrink-0">
                        {(liveState.ticker_items || []).map((item, i) => (
                          <span key={i} className="inline-flex items-center text-white text-[72px] leading-none font-black uppercase tracking-tighter px-24 whitespace-nowrap drop-shadow-2xl">
                             {item}
                             <span className="mx-24 text-white/30 text-8xl font-thin">•</span>
                          </span>
                        ))}
                     </div>
                     <div className="flex shrink-0">
                        {(liveState.ticker_items || []).map((item, i) => (
                          <span key={`dup-${i}`} className="inline-flex items-center text-white text-[72px] leading-none font-black uppercase tracking-tighter px-24 whitespace-nowrap drop-shadow-2xl">
                             {item}
                             <span className="mx-24 text-white/30 text-8xl font-thin">•</span>
                          </span>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
