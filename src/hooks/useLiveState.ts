import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveState, BibleVerse } from '../models/liveState';
import { detectBibleVerse, detectBibleVerseAI, classifyContent } from '../services/bibleParser';
import { findSongByWords, locateCurrentLine } from '../services/lyricsService';
import { Song } from '../models/song';
import { AudioService } from '../services/audioService';

interface SpeechStats {
  timestamp: number;
  words: number;
  confidence?: number;
}

export function useLiveState(
  sessionId: string,
  provider: 'web' | 'worker' | 'whisper' | 'groq' | 'deepgram',
  whisperConfig: { apiKey?: string; endpoint?: string; audioInput?: 'live' | 'system' },
  aiConfig: { enabled: boolean; endpointUrl: string; apiKey: string; modelName: string }
) {
  const [liveState, setLiveState] = useState<LiveState>({
    session_id: sessionId,
    current_text: '',
    current_verse: null,
    current_song: undefined,
    current_line: undefined,
    preview_text: '',
    preview_verse: null,
    is_live_dirty: false,
    is_analyzing: false,
    detection_history: [],
    history: [],
    updated_at: new Date().toISOString()
  });

  const [currentVerse, setCurrentVerse] = useState<BibleVerse | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [songLineIndex, setSongLineIndex] = useState<number | undefined>(undefined);
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechStats, setSpeechStats] = useState<SpeechStats[]>([]);
  const audioServiceRef = useRef<AudioService | null>(null);

  const aiConfigRef = useRef(aiConfig);
  useEffect(() => {
    aiConfigRef.current = aiConfig;
  }, [aiConfig]);

  useEffect(() => {
    const audioService = new AudioService({
      locale: 'en-NG',
      provider,
      audioInput: whisperConfig.audioInput,
      apiKey: whisperConfig.apiKey,
      onTranscript: (chunk, isFinal, timestamp, confidence) => {
        if (!isFinal) {
          setInterimText(chunk);
          return;
        }

        setInterimText('');
        setLiveState((prev) => {
          const updatedText = `${prev.preview_text} ${chunk}`.trim();
          const rollingWindow = updatedText.split(' ').slice(-30).join(' ');
          const verse = detectBibleVerse(rollingWindow);
          const song = findSongByWords(chunk);
          const contentClassification = classifyContent(chunk);

          const newLine = song ? locateCurrentLine(song, updatedText) : prev.current_line;

          const currentAi = aiConfigRef.current;
          let newDetections = prev.detection_history;

          const addDetection = (v: BibleVerse, isPara = false) => {
            const last = newDetections[0];
            if (!last || last.verse.book !== v.book || last.verse.chapter !== v.chapter || last.verse.verse_start !== v.verse_start) {
              newDetections = [{
                id: `det-${Date.now()}`,
                verse: v,
                timestamp: new Date().toISOString(),
                is_paraphrase: isPara
              }, ...newDetections].slice(0, 15);
            }
          };

          let nextState = {
            ...prev,
            preview_text: updatedText,
            updated_at: new Date().toISOString()
          };

          if (verse) {
             setCurrentVerse(verse);
             addDetection(verse, false);
             nextState = { ...nextState, preview_verse: verse, is_live_dirty: true, detection_history: newDetections };
          } else if (currentAi.enabled && rollingWindow.split(' ').length > 6 && !prev.is_analyzing) {
             // AI trigger (async)
             setTimeout(() => {
               setLiveState(s => ({ ...s, is_analyzing: true }));
               detectBibleVerseAI(rollingWindow, currentAi.endpointUrl, currentAi.apiKey, currentAi.modelName).then((aiVerse: BibleVerse | null) => {
                  if (aiVerse) {
                     setCurrentVerse(aiVerse);
                     setLiveState(s => {
                       const freshDets = [{
                         id: `det-${Date.now()}`,
                         verse: aiVerse,
                         timestamp: new Date().toISOString(),
                         is_paraphrase: true
                       }, ...s.detection_history].slice(0, 15);
                       return { ...s, preview_verse: aiVerse, is_live_dirty: true, is_analyzing: false, detection_history: freshDets };
                     });
                  } else {
                     setLiveState(s => ({ ...s, is_analyzing: false }));
                  }
               }).catch(() => setLiveState(s => ({ ...s, is_analyzing: false })));
             }, 0);
          }

          if (song) {
            setCurrentSong(song);
            setSongLineIndex(newLine);
          }

          const words = chunk.trim().split(/\s+/).filter(Boolean).length;
          setSpeechStats((prevStats) => {
            const now = Date.now();
            const filtered = prevStats.filter((entry) => now - entry.timestamp <= 30000);
            return [...filtered, { timestamp, words, confidence }];
          });

          return {
            ...nextState,
            session_id: sessionId,
            content_type: contentClassification.type,
            updated_at: new Date(timestamp).toISOString()
          };
        });
      },
      onError: (err) => {
        console.error('AudioService error', err);
        setError(err.message || 'Speech recognition error');
        setInterimText('');
        setIsListening(false);
      }
    });

    audioServiceRef.current = audioService;

    return () => {
      audioService.stop();
    };
  }, [sessionId, provider, whisperConfig.audioInput, whisperConfig.apiKey, whisperConfig.endpoint]);

  const start = async () => {
    setError(null);
    if (audioServiceRef.current) {
      await audioServiceRef.current.start();
      setIsListening(true);
    }
  };

  const stop = useCallback(() => {
    if (audioServiceRef.current) {
      audioServiceRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const applyLiveState = useCallback((updatedState: LiveState) => {
    setLiveState(updatedState);
    if (updatedState.current_verse) {
      setCurrentVerse(updatedState.current_verse);
    }
    if (updatedState.current_song) {
      setCurrentSong({
        id: `${sessionId}-${updatedState.current_song}`,
        title: updatedState.current_song,
        lyrics: []
      });
    }
    setSongLineIndex(updatedState.current_line);
  }, [sessionId]);

  const wordRate = useMemo(() => {
    const now = Date.now();
    const windowed = speechStats.filter((s) => now - s.timestamp <= 30000);
    const perSecond: { second: number; words: number }[] = [];

    windowed.forEach((entry) => {
      const sec = Math.floor(entry.timestamp / 1000);
      const found = perSecond.find((item) => item.second === sec);
      if (found) {
        found.words += entry.words;
      } else {
        perSecond.push({ second: sec, words: entry.words });
      }
    });

    return perSecond;
  }, [speechStats]);

  const clearText = useCallback(() => {
    setInterimText('');
    setLiveState(prev => ({ 
      ...prev, 
      current_text: '', 
      preview_text: '',
      preview_verse: null,
      is_live_dirty: false,
      updated_at: new Date().toISOString() 
    }));
  }, []);

  const goLive = useCallback(() => {
    setLiveState(prev => {
      const newHistory = [...(prev.history || [])];
      if (prev.preview_verse) {
        newHistory.push({
          type: 'scripture',
          content: '', 
          reference: `${prev.preview_verse.book} ${prev.preview_verse.chapter}:${prev.preview_verse.verse_start}`,
          timestamp: new Date().toISOString()
        });
      } else if (prev.preview_text && prev.preview_text !== prev.current_text) {
        newHistory.push({
          type: 'note',
          content: prev.preview_text.split(' ').slice(-10).join(' ') + '...',
          timestamp: new Date().toISOString()
        });
      }

      return {
        ...prev,
        current_text: prev.preview_text || '',
        current_verse: prev.preview_verse,
        is_live_dirty: false,
        history: newHistory,
        updated_at: new Date().toISOString()
      };
    });
  }, []);

  const setSecondaryVerse = useCallback((text: string | null) => {
    setLiveState(prev => ({
      ...prev,
      secondary_verse: text,
      updated_at: new Date().toISOString()
    }));
  }, []);

  const setPreviewVerse = useCallback((verse: BibleVerse | null) => {
    setLiveState(prev => ({
      ...prev,
      preview_verse: verse,
      is_live_dirty: true,
      updated_at: new Date().toISOString()
    }));
    if (verse) setCurrentVerse(verse);
  }, []);

  const clearPreview = useCallback(() => {
    setLiveState(prev => ({
      ...prev,
      preview_text: '',
      preview_verse: null,
      is_live_dirty: false,
      updated_at: new Date().toISOString()
    }));
    setInterimText('');
  }, []);

  const removeDetection = useCallback((id: string) => {
    setLiveState(prev => ({
      ...prev,
      detection_history: prev.detection_history.filter(h => h.id !== id),
      updated_at: new Date().toISOString()
    }));
  }, []);

  return {
    liveState,
    interimText,
    currentSong,
    currentLine: songLineIndex,
    currentVerse,
    isListening,
    start,
    stop,
    clearText,
    clearPreview,
    applyLiveState,
    goLive,
    setPreviewVerse,
    setSecondaryVerse,
    removeDetection,
    speechStats,
    wordRate,
    error,
    setError
  };
}
