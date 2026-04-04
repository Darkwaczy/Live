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
    ticker_enabled: true,
    ticker_items: [],
    is_blank: false,
    is_logo: false,
    is_point: false,
    media_muted: true,
    media_playing: true,
    media_volume: 1.0,
    media_epoch: Date.now(),
    preview_media_muted: true,
    preview_media_playing: true,
    preview_media_volume: 1.0,
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
  const lastPhraseRef = useRef<string>('');

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
          // INTERIM: Update immediate UI
          setInterimText(chunk);
          return;
        }

        // FINAL: Process stable sentence
        setInterimText('');
        setLiveState((prev) => {
          const cleanChunk = chunk.trim();
          if (!cleanChunk) return prev;

          // REPETITION FILTER (Prevents duplicate phrases)
          if (cleanChunk === lastPhraseRef.current) {
             console.log("[useLiveState] Skipping duplicate phrase:", cleanChunk);
             return prev;
          }
          lastPhraseRef.current = cleanChunk;

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
          } else {
             const isBibleStoryCandidate = (text: string) => {
                const keywords = ['jesus', 'god', 'lord', 'spirit', 'bible', 'scripture', 'verse', 'man', 'son', 'father', 'king'];
                const low = text.toLowerCase();
                return keywords.some(k => low.includes(k)) && text.split(' ').length > 6;
             };

             if (currentAi.enabled && isBibleStoryCandidate(cleanChunk) && !prev.is_analyzing) {
                // AI trigger (async)
                setTimeout(() => {
                   setLiveState(s => ({ ...s, is_analyzing: true }));
                   detectBibleVerseAI(rollingWindow, currentAi.endpointUrl, currentAi.apiKey, currentAi.modelName).then((aiVerse: BibleVerse | null) => {
                      if (aiVerse) {
                         setLiveState(s => {
                            const alreadyExists = s.detection_history.some(d => 
                               d.verse.book === aiVerse.book && 
                               d.verse.chapter === aiVerse.chapter && 
                               d.verse.verse_start === aiVerse.verse_start && 
                               ((Date.now() - new Date(d.timestamp).getTime()) < 180000)
                            );
                            if (alreadyExists) return { ...s, is_analyzing: false };

                            setCurrentVerse(aiVerse);
                            return { 
                               ...s, 
                               preview_verse: aiVerse, 
                               is_live_dirty: true, 
                               is_analyzing: false,
                               detection_history: [{
                                  id: `det-${Date.now()}`,
                                  verse: aiVerse,
                                  timestamp: new Date().toISOString(),
                                  is_paraphrase: true
                               }, ...s.detection_history].slice(0, 15)
                            };
                         });
                      } else {
                         setLiveState(s => ({ ...s, is_analyzing: false }));
                      }
                   }).catch(() => setLiveState(s => ({ ...s, is_analyzing: false })));
                }, 0);
             }
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
            history: [
               ...(nextState.history || []),
               {
                  id: `note-${Date.now()}`,
                  type: 'note' as const,
                  content: cleanChunk,
                  timestamp: new Date(timestamp).toISOString()
               }
            ].slice(-200), // keep the last 200 notes to prevent memory bloat
            session_id: sessionId,
            content_type: contentClassification.type,
            updated_at: new Date(timestamp).toISOString()
          } as any;
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
    // SANITATION: Ensure history fields are never undefined/null
    const sanitizedState = {
      ...updatedState,
      detection_history: Array.isArray(updatedState.detection_history) ? updatedState.detection_history : [],
      history: Array.isArray(updatedState.history) ? updatedState.history : []
    };
    
    setLiveState(sanitizedState);
    if (sanitizedState.current_verse) {
      setCurrentVerse(sanitizedState.current_verse);
    }
    if (sanitizedState.current_song) {
      setCurrentSong({
        id: `${sessionId}-${sanitizedState.current_song}`,
        title: sanitizedState.current_song,
        lyrics: []
      });
    }
    setSongLineIndex(sanitizedState.current_line);
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
    setCurrentSong(null);
    setSongLineIndex(undefined);
    setLiveState(prev => ({ 
      ...prev, 
      current_text: '', 
      current_verse: null,
      current_song_id: null,
      current_media: null,
      media_playing: false,
      current_lyric_line: null,
      current_lyric_index: undefined,
      preview_lyric_line: null,
      preview_lyric_index: undefined,
      is_live_dirty: !!(prev.preview_text || prev.preview_verse), 
      is_blank: false,
      is_logo: false,
      updated_at: new Date().toISOString() 
    }));
  }, []);

  const goLive = useCallback(() => {
    setLiveState(prev => {
      const newHistory = [...(prev.history || [])];
      
      if (prev.preview_verse) {
        newHistory.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'scripture',
          content: '', 
          reference: `${prev.preview_verse.book} ${prev.preview_verse.chapter}:${prev.preview_verse.verse_start}${prev.preview_verse.verse_end && prev.preview_verse.verse_end !== prev.preview_verse.verse_start ? `-${prev.preview_verse.verse_end}` : ''}`,
          timestamp: new Date().toISOString()
        });
      } else if (prev.preview_media) {
         newHistory.push({
            id: Math.random().toString(36).substring(2, 9),
            type: 'lyrics',
            content: 'Multimedia: ' + (prev.preview_media.split('/').pop() || 'Asset'),
            timestamp: new Date().toISOString()
         });
      } else if (prev.preview_lyric_line) {
        newHistory.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'lyrics',
          content: prev.preview_lyric_line,
          timestamp: new Date().toISOString()
        });
      } else if (prev.preview_text && prev.preview_text !== prev.current_text) {
        newHistory.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'note',
          content: prev.preview_text.split(' ').slice(-10).join(' ') + '...',
          timestamp: new Date().toISOString()
        });
      }

      let nextPreviewVerse = prev.preview_verse;
      if (prev.preview_verse) {
         nextPreviewVerse = {
            ...prev.preview_verse,
            verse_start: prev.preview_verse.verse_start + 1,
            verse_end: prev.preview_verse.verse_start + 1 
         };
      }

      // LYRIC PROMOTION: preview_lyric → current_lyric, next line → preview_lyric
      let nextPreviewLyricLine = prev.preview_lyric_line;
      let nextPreviewLyricIndex = prev.preview_lyric_index;
      let nextCurrentLyricLine = prev.current_lyric_line;
      let nextCurrentLyricIndex = prev.current_lyric_index;
      // We'll handle the actual next-line lookup in App.tsx via a useEffect watching current_lyric_index
      if (prev.preview_lyric_line !== undefined) {
        nextCurrentLyricLine = prev.preview_lyric_line;
        nextCurrentLyricIndex = prev.preview_lyric_index;
        // Signal that preview lyric needs to advance (App.tsx useEffect will fill it in)
        nextPreviewLyricLine = null;
        nextPreviewLyricIndex = (prev.preview_lyric_index ?? 0) + 1; // temp marker — App.tsx fills actual text
      }

      return {
        ...prev,
        // PRIVACY FIX: Raw transcription (preview_text) stays laptop-only. 
        // It should never be promoted to the TV during goLive.
        current_text: prev.is_point ? prev.preview_text : '', 
        current_verse: prev.preview_verse,
        current_verse_text: prev.preview_verse_text, // PROMOTION: staged text → live text
        current_media: prev.preview_media,
        current_lyric_line: nextCurrentLyricLine,
        current_lyric_index: nextCurrentLyricIndex,
        preview_lyric_line: nextPreviewLyricLine,
        preview_lyric_index: nextPreviewLyricIndex,
        is_point: !prev.preview_lyric_line && !!prev.preview_text,
        media_muted: prev.preview_media ? (prev.preview_media_muted ?? true) : prev.media_muted,
        media_playing: prev.preview_media ? (prev.preview_media_playing ?? true) : prev.media_playing,
        media_volume: prev.preview_media ? (prev.preview_media_volume ?? 1.0) : prev.media_volume,
        media_epoch: prev.preview_media ? Date.now() : prev.media_epoch,
        preview_verse: nextPreviewVerse,
        preview_verse_text: null, // Clear staged text after air
        preview_text: '',
        preview_media: null,
        is_live_dirty: true,
        history: newHistory.slice(-200),
        updated_at: new Date().toISOString()
      } as any;
    });
  }, []);

  const directAir = useCallback((data: { type: 'scripture' | 'lyrics' | 'note', content?: string, media?: string, reference?: string }) => {
     setLiveState(prev => {
        const newHistory = [...(prev.history || [])];
        newHistory.push({
           id: Math.random().toString(36).substring(2, 9),
           type: data.type,
           content: data.content || '',
           reference: data.reference,
           timestamp: new Date().toISOString()
        });

        return {
           ...prev,
           current_text: data.content || '',
           current_verse: data.type === 'scripture' && data.reference ? { book: data.reference.split(' ')[0], chapter: 1, verse_start: 1, verse_end: 1 } : null,
           current_verse_text: data.type === 'scripture' ? (data.content || '') : null,
           current_media: data.media || null,
           is_point: data.type === 'note',
           media_muted: data.media ? false : prev.media_muted,
           media_playing: true,
           media_volume: 1.0,
           media_epoch: data.media ? Date.now() : prev.media_epoch,
           is_live_dirty: true,
           history: newHistory.slice(-200),
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
      preview_verse_text: null, // Reset text when reference changes
      is_live_dirty: true,
      updated_at: new Date().toISOString()
    }));
    if (verse) setCurrentVerse(verse);
  }, []);

  const setPreviewVerseText = useCallback((text: string | null) => {
    setLiveState(prev => ({
      ...prev,
      preview_verse_text: text,
      updated_at: new Date().toISOString()
    }));
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

  const setBlank = useCallback((blankValue: boolean) => {
    setLiveState(prev => ({
      ...prev,
      is_blank: blankValue,
      is_logo: blankValue ? false : prev.is_logo,
      updated_at: new Date().toISOString()
    }));
  }, []);

  const setLogo = useCallback((logoValue: boolean) => {
    setLiveState(prev => ({
      ...prev,
      is_logo: logoValue,
      is_blank: logoValue ? false : prev.is_blank,
      updated_at: new Date().toISOString()
    }));
  }, []);

  const loadSong = useCallback((song: Song | null) => {
    setCurrentSong(song);
    setSongLineIndex(song ? 0 : undefined);
    if (!song) {
      setLiveState(prev => ({
        ...prev,
        current_song_id: null,
        preview_lyric_line: null,
        preview_lyric_index: undefined,
        current_lyric_line: null,
        current_lyric_index: undefined,
        updated_at: new Date().toISOString()
      }));
      return;
    }
    const firstLine = song.lyrics?.[0]?.line || '';
    setLiveState(prev => ({
      ...prev,
      current_song_id: song.id,
      preview_lyric_line: firstLine,
      preview_lyric_index: 0,
      current_lyric_line: null,
      current_lyric_index: undefined,
      is_live_dirty: true,
      updated_at: new Date().toISOString()
    }));
  }, []);

  // AIR a specific lyric line directly to Live On Screen; auto-stage next line to Preview
  const airLyricLine = useCallback((song: Song, lineIndex: number) => {
    const lines = song.lyrics || [];
    const liveText = lines[lineIndex]?.line || '';
    const nextLine = lines[lineIndex + 1]?.line || null;
    const nextIndex = lineIndex + 1 < lines.length ? lineIndex + 1 : undefined;
    setLiveState(prev => ({
      ...prev,
      current_lyric_line: liveText,
      current_lyric_index: lineIndex,
      preview_lyric_line: nextLine,
      preview_lyric_index: nextIndex,
      is_live_dirty: true,
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
    directAir,
    setPreviewVerse,
    setSecondaryVerse,
    setPreviewVerseText,
    removeDetection,
    setBlank,
    setLogo,
    loadSong,
    airLyricLine,
    setLiveState,
    speechStats,
    wordRate,
    error,
    setError
  };
}
