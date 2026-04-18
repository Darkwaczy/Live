import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveState, BibleVerse } from '../models/liveState';
import { detectBibleVerse, detectBibleVerseAI, detectBibleVerseWithStories, classifyContent } from '../services/bibleParser';
import { searchBibleQuotes } from '../services/dbService';
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
    transcription_text: '',
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
  const isListeningRef = useRef(false);
  const hasStartedHardwareRef = useRef(false);
  const preRollBufferRef = useRef<{chunk: string, timestamp: number}[]>([]);

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
        if (!isListeningRef.current) {
          if (isFinal) {
             const now = Date.now();
             preRollBufferRef.current.push({ chunk, timestamp: now });
             // Keep only the last 3000ms in the hot standby buffer so we don't leak memory or pull too much context
             preRollBufferRef.current = preRollBufferRef.current.filter(b => now - b.timestamp <= 3000);
          }
          return;
        }

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

          // Build the growing transcription buffer for context
          // Use transcription_text (the dedicated private feed) so the rolling window
          // always has the last 60+ words of everything spoken — crucial for detection.
          const updatedTranscription = prev.transcription_text
            ? `${prev.transcription_text.trim()} ${cleanChunk}`
            : cleanChunk;

          // Rolling window: last 80 words gives much richer context for verse patterns
          const rollingWindow = updatedTranscription.split(' ').slice(-80).join(' ');
          const localVerses = detectBibleVerse(rollingWindow);
          const song = findSongByWords(cleanChunk);
          const contentClassification = classifyContent(cleanChunk);

          const newLine = song ? locateCurrentLine(song, updatedTranscription) : prev.current_line;
          const currentAi = aiConfigRef.current;
          let newDetections = [...prev.detection_history];

          // LOCKOUT: 30 seconds for the exact same verse (was 3 minutes — too long).
          // This allows the pastor to re-reference a verse later in the same sermon.
          const LOCKOUT_MS = 30_000;

          const isDuplicate = (v: BibleVerse) => {
            return newDetections.some(d =>
              d.verse.book === v.book &&
              d.verse.chapter === v.chapter &&
              d.verse.verse_start === v.verse_start &&
              (Date.now() - new Date(d.timestamp).getTime() < LOCKOUT_MS)
            );
          };

          // Only block it if that exact verse is CURRENTLY staged in preview
          const isCurrentlyShowing = (v: BibleVerse) => {
            return prev.preview_verse &&
                   prev.preview_verse.book === v.book &&
                   prev.preview_verse.chapter === v.chapter &&
                   prev.preview_verse.verse_start === v.verse_start;
          };

          const addDetection = (v: BibleVerse, isPara = false) => {
            if (!isDuplicate(v) && !isCurrentlyShowing(v)) {
              // Cap at 50 — enough history for a full sermon without blocking detection
              newDetections = [{
                id: `det-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
                verse: v,
                timestamp: new Date().toISOString(),
                is_paraphrase: isPara
              }, ...newDetections].slice(0, 50);
              return true;
            }
            return false;
          };

          let nextState = {
            ...prev,
            transcription_text: updatedTranscription,
            current_text: cleanChunk,
            updated_at: new Date().toISOString(),
            detection_history: newDetections
          };
          
          let pushedToPreview = false;

          if (localVerses && localVerses.length > 0) {
            for (const verse of localVerses) {
              const added = addDetection(verse, false);
              // Always stage the very first verse detected in a batch to Preview
              if (added && !pushedToPreview) {
                setCurrentVerse(verse);
                nextState = { ...nextState, preview_verse: verse, is_live_dirty: true, detection_history: newDetections };
                pushedToPreview = true;
                console.log(`[useLiveState] Auto-Staging Local Verse: ${verse.book} ${verse.chapter}:${verse.verse_start}`);
              } else if (added) {
                nextState.detection_history = newDetections;
              }
            }
          }

          // If local regex didn't intercept anything with high confidence, run story/DB/AI checks
          if (!localVerses || localVerses.length === 0) {
            
            const chunkWordCount = cleanChunk.split(' ').length;
            
            // ASYNC DETECTION: Moved outside state updater to prevent React errors
            // Use rolling window for story detection to catch phrases spanning sentences
            (async () => {
              try {
                const storyVerses = await detectBibleVerseWithStories(rollingWindow);
                
                if (storyVerses && storyVerses.length > 0) {
                  // Found via story detection!
                  setLiveState(s => {
                    let finalDetections = [...s.detection_history];
                    let firstStoryVerse: BibleVerse | null = null;
                    
                    for (const verse of storyVerses) {
                      const alreadyExists = finalDetections.some(d =>
                        d.verse.book === verse.book &&
                        d.verse.chapter === verse.chapter &&
                        d.verse.verse_start === verse.verse_start &&
                        (Date.now() - new Date(d.timestamp).getTime()) < LOCKOUT_MS
                      );

                      const currentlyShowing = s.preview_verse &&
                        s.preview_verse.book === verse.book &&
                        s.preview_verse.chapter === verse.chapter &&
                        s.preview_verse.verse_start === verse.verse_start;

                      if (!alreadyExists && !currentlyShowing) {
                        finalDetections = [{
                          id: `det-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
                          verse: verse,
                          timestamp: new Date().toISOString(),
                          is_paraphrase: false
                        }, ...finalDetections].slice(0, 50);
                        
                        if (!firstStoryVerse) {
                          firstStoryVerse = verse;
                          setCurrentVerse(verse);
                        }
                      }
                    }
                    
                    if (firstStoryVerse) {
                      console.log(`[useLiveState] Story Detection: ${firstStoryVerse.book} ${firstStoryVerse.chapter}:${firstStoryVerse.verse_start}`);
                      return {
                        ...s,
                        preview_verse: firstStoryVerse,
                        is_live_dirty: true,
                        detection_history: finalDetections
                      };
                    }
                    return { ...s, detection_history: finalDetections };
                  });
                  return; // Story found, stop here
                }
                
                // No story found, continue with FTS5/AI checks
                performDbAndAiChecks();
              } catch (error) {
                console.warn('Story detection error:', error);
                performDbAndAiChecks();
              }
            })();
            
            function performDbAndAiChecks() {
              // Limit fast exact DB quote check to statements with at least 5 words to avoid false positive short phrases
              if (!prev.is_analyzing && chunkWordCount >= 5) {
                setLiveState(s => ({ ...s, is_analyzing: true }));
                
                // 1. LOCAL FTS5 REVERSE MATCH (Instant, Exact Quotes)
                searchBibleQuotes(cleanChunk, 1).then((ftsVerses: any[]) => {
                  if (ftsVerses && ftsVerses.length > 0) {
                    const matchedDbVerse = ftsVerses[0];
                    const newVerse: BibleVerse = {
                      book: matchedDbVerse.book,
                      chapter: matchedDbVerse.chapter,
                      verse_start: matchedDbVerse.verse,
                      verse_end: matchedDbVerse.verse
                    };

                    setLiveState(s => {
                      let finalDetections = [...s.detection_history];
                      const alreadyExists = finalDetections.some(d =>
                        d.verse.book === newVerse.book &&
                        d.verse.chapter === newVerse.chapter &&
                        d.verse.verse_start === newVerse.verse_start &&
                        (Date.now() - new Date(d.timestamp).getTime()) < LOCKOUT_MS
                      );

                      const currentlyShowing = s.preview_verse &&
                        s.preview_verse.book === newVerse.book &&
                        s.preview_verse.chapter === newVerse.chapter &&
                        s.preview_verse.verse_start === newVerse.verse_start;

                      if (!alreadyExists && !currentlyShowing) {
                        finalDetections = [{
                          id: `det-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
                          verse: newVerse,
                          timestamp: new Date().toISOString(),
                          is_paraphrase: false
                        }, ...finalDetections].slice(0, 50);
                        
                        setCurrentVerse(newVerse);
                        console.log(`[useLiveState] FTS5 Reverse Match: ${newVerse.book} ${newVerse.chapter}:${newVerse.verse_start}`);
                        
                        return {
                          ...s,
                          preview_verse: newVerse,
                          is_live_dirty: true,
                          is_analyzing: false,
                          detection_history: finalDetections
                        };
                      }
                      return { ...s, is_analyzing: false, detection_history: finalDetections };
                    });

                  } else if (currentAi.enabled && chunkWordCount >= 10) {
                    // 2. GROQ AI FALLBACK (Paraphrasing & Deep semantics)
                    // Use rolling window for better context understanding
                    const storyContext = updatedTranscription.split(' ').slice(-35).join(' ');
                    detectBibleVerseAI(storyContext, currentAi.endpointUrl, currentAi.apiKey, currentAi.modelName)
                      .then((aiVerses) => {
                        if (aiVerses && aiVerses.length > 0) {
                          setLiveState(s => {
                            let finalDetections = [...s.detection_history];
                            let firstNewAiVerse: BibleVerse | null = null;
                            for (const aiVerse of aiVerses) {
                              const alreadyExists = finalDetections.some(d =>
                                d.verse.book === aiVerse.book && d.verse.chapter === aiVerse.chapter &&
                                d.verse.verse_start === aiVerse.verse_start &&
                                (Date.now() - new Date(d.timestamp).getTime()) < LOCKOUT_MS
                              );
                              const currentlyShowing = s.preview_verse && s.preview_verse.book === aiVerse.book &&
                                s.preview_verse.chapter === aiVerse.chapter && s.preview_verse.verse_start === aiVerse.verse_start;

                              if (!alreadyExists && !currentlyShowing) {
                                finalDetections = [{
                                  id: `det-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
                                  verse: aiVerse,
                                  timestamp: new Date().toISOString(),
                                  is_paraphrase: true
                                }, ...finalDetections].slice(0, 50);
                                if (!firstNewAiVerse) firstNewAiVerse = aiVerse;
                              }
                            }
                            if (firstNewAiVerse) {
                              setCurrentVerse(firstNewAiVerse);
                              console.log(`[useLiveState] AI Strategy Hit: ${firstNewAiVerse.book} ${firstNewAiVerse.chapter}:${firstNewAiVerse.verse_start}`);
                              return { ...s, preview_verse: firstNewAiVerse, is_live_dirty: true, is_analyzing: false, detection_history: finalDetections };
                            } else {
                              return { ...s, is_analyzing: false, detection_history: finalDetections };
                            }
                          });
                        } else {
                          setLiveState(s => ({ ...s, is_analyzing: false }));
                        }
                      }).catch(() => setLiveState(s => ({ ...s, is_analyzing: false })));
                  } else {
                    setLiveState(s => ({ ...s, is_analyzing: false }));
                  }
                }).catch(() => setLiveState(s => ({ ...s, is_analyzing: false })));
              }
            };
          } // Close if (!localVerses || localVerses.length === 0)

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

          return nextState;
        });
      },
      onError: (err) => {
        console.error('AudioService error', err);
        setError(err.message || 'Speech recognition error');
        setInterimText('');
        setIsListening(false);
        isListeningRef.current = false;
        hasStartedHardwareRef.current = false;
      }
    });

    audioServiceRef.current = audioService;

    return () => {
      audioService.stop();
    };
  }, [sessionId, provider, whisperConfig.audioInput, whisperConfig.apiKey, whisperConfig.endpoint]);

  // Feed context back to AudioService for Whisper "Memory" (using history for context)
  useEffect(() => {
    if (audioServiceRef.current && liveState.history?.length > 0) {
      // Send the last few notes as context to prime the next chunk
      const fullHistory = liveState.history.map((h: any) => h.content).join(' ');
      const context = fullHistory.slice(-500);
      audioServiceRef.current.setConfig({ previousContext: context });
    }
  }, [liveState.history]);

  const start = async () => {
    setError(null);
    if (!hasStartedHardwareRef.current && audioServiceRef.current) {
      await audioServiceRef.current.start();
      hasStartedHardwareRef.current = true;
    }
    setIsListening(true);
    isListeningRef.current = true;
    
    // Inject pre-roll buffer when starting to catch the very first syllable
    if (preRollBufferRef.current.length > 0) {
      const combinedChunks = preRollBufferRef.current.map(b => b.chunk).join(' ');
      setLiveState(prev => {
         const updatedTranscription = prev.transcription_text 
            ? `${prev.transcription_text.trim()} ${combinedChunks}`
            : combinedChunks;
         return {
            ...prev,
            transcription_text: updatedTranscription,
         } as any;
      });
      preRollBufferRef.current = [];
    }
  };

  const stop = useCallback(() => {
    setIsListening(false);
    isListeningRef.current = false;
    // HOT STANDBY: We intentionally do NOT call audioServiceRef.current.stop() here.
    // The microphone hardware stays alive in the background feeding the preRollBufferRef silently.
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
