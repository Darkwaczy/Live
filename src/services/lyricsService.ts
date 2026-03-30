import { Song } from '../models/song';

let cachedSongs: Song[] = [];
let pastedSongs: Song[] = [];

export const loadEssentialLyrics = async (): Promise<Song[]> => {
  if (cachedSongs.length > 0) return cachedSongs;
  try {
    const res = await fetch('/lyrics/essential_1k.json');
    if (!res.ok) throw new Error('Essential lyrics not found');
    cachedSongs = await res.json();
    return cachedSongs;
  } catch (err) {
    console.warn('Failed to load essential lyrics', err);
    return [];
  }
};

export const addPastedSong = (song: Song) => {
  pastedSongs.unshift(song);
};

export const searchLyrics = async (query: string): Promise<Song[]> => {
  const allLocal = [...pastedSongs, ...cachedSongs];
  if (!query) return allLocal;

  const normalized = query.toLowerCase();
  const filtered = allLocal.filter(s => 
    s.title.toLowerCase().includes(normalized) || 
    (s.artist && s.artist.toLowerCase().includes(normalized))
  );

  // If local results are low, simulate a Global Search for the "other 9,000"
  if (filtered.length < 3) {
    // Placeholder for API call to Musixmatch/etc.
    console.log('Searching global database for:', query);
  }

  return filtered;
};

export const findSongByWords = (text: string): Song | null => {
  const normalized = text.toLowerCase().replace(/[.,!?;:]/g, '');
  const words = normalized.split(/\s+/).slice(-30);
  const allLocal = [...pastedSongs, ...cachedSongs];
  
  for (const song of allLocal) {
    if (normalized.includes(song.title.toLowerCase())) {
      return song;
    }
    
    for (const lyricLine of song.lyrics) {
      const lineWords = lyricLine.line.toLowerCase().replace(/[.,!?;:]/g, '').split(/\s+/);
      const overlap = lineWords.filter(w => words.includes(w)).length;
      if (overlap >= Math.min(4, lineWords.length)) {
        return song;
      }
    }
  }
  return null;
};

export const locateCurrentLine = (song: Song, transcriptText: string): number => {
  const normalized = transcriptText.toLowerCase().replace(/[.,!?;:]/g, '');
  const transcriptWords = normalized.split(/\s+/).slice(-25); 
  
  let bestLineIndex = -1;
  let highestScore = 0;

  song.lyrics.forEach((lyricLine, index) => {
    const lineWords = lyricLine.line.toLowerCase().replace(/[.,!?;:]/g, '').split(/\s+/);
    if (lineWords.length === 0) return;

    let matchCount = 0;
    lineWords.forEach(w => {
      if (transcriptWords.includes(w)) matchCount++;
    });

    const score = matchCount / lineWords.length;
    
    if (matchCount >= 3 || score > 0.5) {
      if (score > highestScore) {
        highestScore = score;
        bestLineIndex = index;
      }
    }
  });

  return bestLineIndex;
};
