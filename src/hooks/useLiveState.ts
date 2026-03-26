import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveState, BibleVerse } from '../models/liveState';
import { detectBibleVerse } from '../services/bibleParser';
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
  provider: 'web' | 'worker' | 'whisper',
  whisperConfig: { apiKey?: string; endpoint?: string },
  aiConfig: { enabled: boolean; endpointUrl: string; apiKey: string; modelName: string }
) {
  const [liveState, setLiveState] = useState<LiveState>({
    session_id: sessionId,
    current_text: '',
    current_verse: null,
    current_song: undefined,
    current_line: undefined,
    updated_at: new Date().toISOString()
  });

  const [currentVerse, setCurrentVerse] = useState<BibleVerse | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [songLineIndex, setSongLineIndex] = useState<number | undefined>(undefined);
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
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

          return {
            session_id: sessionId,
            current_text: updatedText,
            current_verse: verse ?? prev.current_verse,
            current_song: song?.title ?? prev.current_song,
            current_line: song ? newLine : prev.current_line,
            updated_at: new Date(timestamp).toISOString()
          };
        });
      },
      onError: (err) => console.error('AudioService error', err)
    });

    audioServiceRef.current = audioService;

    return () => {
      audioService.stop();
    };
  }, [sessionId, provider, whisperConfig.apiKey, whisperConfig.endpoint]);

  const start = async () => {
    if (audioServiceRef.current) {
      await audioServiceRef.current.start();
      setIsListening(true);
    }
  };

  const stop = () => {
    if (audioServiceRef.current) {
      audioServiceRef.current.stop();
      setIsListening(false);
    }
  };

  const applyLiveState = (updatedState: LiveState) => {
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
  };

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

  const clearText = () => {
    setInterimText('');
    setLiveState(prev => ({ ...prev, current_text: '', updated_at: new Date().toISOString() }));
  };

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
    speechStats,
    wordRate
  };
}

