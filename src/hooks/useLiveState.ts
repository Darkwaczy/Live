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
          const cleanChunk = chunk.trim();
          if (!cleanChunk) return prev;

          // WHISPER HALLUCINATION FILTER (Kills ghost words during silence)
          const lowerChunk = cleanChunk.toLowerCase();
          const hallucinations = [
            'thank you for watching',
            'thanks for watching',
            'okay, thank you',
            'subscribe to the channel',
            'please like and subscribe',
            'thank you for the gift',
            'unintelligible',
            'okay! thank you'
          ];
          
          if (hallucinations.some(h => lowerChunk === h || lowerChunk.startsWith(h))) {
            console.log(`[useLiveState] Hallucination detected: "${cleanChunk}". Filtered.`);
            return prev;
          }

          // Append with proper punctuation spacing
          const updatedText = prev.preview_text ? `${prev.preview_text.trim()} ${cleanChunk}` : cleanChunk;
          
          // Use a larger window for semantic context
          const rollingWindow = updatedText.split(' ').slice(-60).join(' ');
          const verse = detectBibleVerse(rollingWindow);
          const song = findSongByWords(cleanChunk);
          const contentClassification = classifyContent(cleanChunk);

          const newLine = song ? locateCurrentLine(song, updatedText) : prev.current_line;
          const currentAi = aiConfigRef.current;
          let newDetections = [...prev.detection_history];

          // Utility to prevent duplicates in history (within last 30 seconds or matching verse)
          const isDuplicate = (v: BibleVerse) => {
            return newDetections.some(d => 
              d.verse.book === v.book && 
              d.verse.chapter === v.chapter && 
              d.verse.verse_start === v.verse_start &&
              (Date.now() - new Date(d.timestamp).getTime() < 180000) // 3-minute lockout for exact same verse
            );
          };

          const isCurrentlyShowing = (v: BibleVerse) => {
            return prev.preview_verse && 
                   prev.preview_verse.book === v.book && 
                   prev.preview_verse.chapter === v.chapter && 
                   prev.preview_verse.verse_start === v.verse_start;
          };

          const addDetection = (v: BibleVerse, isPara = false) => {
            if (!isDuplicate(v) && !isCurrentlyShowing(v)) {
              newDetections = [{
                id: `det-${Date.now()}`,
                verse: v,
                timestamp: new Date().toISOString(),
                is_paraphrase: isPara
              }, ...newDetections].slice(0, 15);
              return true;
            }
            return false;
          };

          let nextState = {
            ...prev,
            preview_text: updatedText,
            updated_at: new Date().toISOString(),
            detection_history: newDetections
          };

          if (verse) {
             const added = addDetection(verse, false);
             if (added) {
                setCurrentVerse(verse);
                nextState = { ...nextState, preview_verse: verse, is_live_dirty: true, detection_history: newDetections };
             }
          } else if (currentAi.enabled && rollingWindow.split(' ').length > 8 && !prev.is_analyzing) {
             // AI trigger (async)
             setTimeout(() => {
               setLiveState(s => ({ ...s, is_analyzing: true }));
               detectBibleVerseAI(rollingWindow, currentAi.endpointUrl, currentAi.apiKey, currentAi.modelName).then((aiVerse: BibleVerse | null) => {
                  if (aiVerse) {
                     setLiveState(s => {
                        // Re-check duplicate inside the async callback (3-minute lockout)
                        const alreadyExists = s.detection_history.some(d => 
                          d.verse.book === aiVerse.book && 
                          d.verse.chapter === aiVerse.chapter && 
                          d.verse.verse_start === aiVerse.verse_start && 
                          ((Date.now() - new Date(d.timestamp).getTime()) < 180000)
                        );
                        
                        const isCurrent = s.preview_verse && 
                                         s.preview_verse.book === aiVerse.book && 
                                         s.preview_verse.chapter === aiVerse.chapter && 
                                         s.preview_verse.verse_start === aiVerse.verse_start;

                        if (alreadyExists || isCurrent) return { ...s, is_analyzing: false };

                        const freshDets = [{
                          id: `det-${Date.now()}`,
                          verse: aiVerse,
                          timestamp: new Date().toISOString(),
                          is_paraphrase: true
                        }, ...s.detection_history].slice(0, 15);
                        
                        setCurrentVerse(aiVerse);
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

  // Feed context back to AudioService for Whisper "Memory"
  useEffect(() => {
    if (audioServiceRef.current && liveState.preview_text) {
      // Send the last 500 characters as context to prime the next chunk
      const context = liveState.preview_text.slice(-500);
      audioServiceRef.current.setConfig({ previousContext: context });
    }
  }, [liveState.preview_text]);

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
    setLiveState,
    speechStats,
    wordRate,
    error,
    setError
  };
}
