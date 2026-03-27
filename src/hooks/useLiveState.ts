import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveState, BibleVerse } from '../models/liveState';
import { detectBibleVerse, classifyContent } from '../services/bibleParser';
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
      endpoint: whisperConfig.endpoint,
      onTranscript: (chunk, isFinal, timestamp, confidence) => {
        if (!isFinal) {
          setInterimText(chunk);
          const tempSong = findSongByWords(chunk);
          if (tempSong) {
            setCurrentSong(tempSong);
            setLiveState((curr) => {
               setSongLineIndex(locateCurrentLine(tempSong, curr.current_text + ' ' + chunk));
               return curr;
            });
          }
          return;
        }

        setInterimText('');
        setLiveState((prev) => {
          const updatedText = `${prev.current_text} ${chunk}`.trim();
          const rollingWindow = updatedText.split(' ').slice(-20).join(' ');
          const verse = detectBibleVerse(rollingWindow);
          const song = findSongByWords(chunk);
          const contentClassification = classifyContent(chunk);

          const newLine = song ? locateCurrentLine(song, updatedText) : prev.current_line;

          const currentAi = aiConfigRef.current;
          if (verse) {
             setCurrentVerse(verse);
          } else if (currentAi.enabled && chunk.split(' ').length > 2) {
             import('../services/bibleParser').then(m => {
                m.detectBibleVerseAI(rollingWindow, currentAi.endpointUrl, currentAi.apiKey, currentAi.modelName)
                 .then(aiVerse => {
                   if (aiVerse) {
                     setCurrentVerse(aiVerse);
                     setLiveState(s => ({ ...s, current_verse: aiVerse }));
                   }
                 });
             });
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

          console.log(`📝 [Content Classification] Type: ${contentClassification.type} (${Math.round(contentClassification.confidence * 100)}% confidence)`);

          return {
            ...prev,
            session_id: sessionId,
            preview_text: updatedText,
            preview_verse: verse ?? prev.preview_verse,
            is_live_dirty: true,
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
      const newHistory = [...prev.history];
      if (prev.preview_verse) {
        newHistory.push({
          type: 'scripture',
          content: '', // Text will be filled by App.tsx fetching
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
    applyLiveState,
    goLive,
    setPreviewVerse,
    setSecondaryVerse,
    speechStats,
    wordRate,
    error,
    setError
  };
}

