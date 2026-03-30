import { Song } from '../models/song';

let cachedSongs: Song[] = [];
let pastedSongs: Song[] = [];

export const loadEssentialLyrics = async (): Promise<Song[]> => {
  if (cachedSongs.length > 0) return cachedSongs;
  try {
    const shards = [
      '/lyrics/african_praise.json',
      '/lyrics/contemporary_praise.json',
      '/lyrics/worship_essentials.json'
    ];
    
    const results = await Promise.all(shards.map(url => fetch(url).then(res => res.json())));
    // Tag songs with their category based on the file they came from
    const categories = ['African Praise', 'Contemporary Praise', 'Worship Essentials'];
    
    const taggedSongs = results.flatMap((songs, i) => 
      songs.map((s: Song) => ({ ...s, tags: [...(s.tags || []), categories[i]] }))
    );

    cachedSongs = taggedSongs;
    return cachedSongs;
  } catch (err) {
    console.warn('Failed to load lyrics shards', err);
    return [];
  }
};

export const setInitialPastedSongs = (songs: Song[]) => {
  pastedSongs = songs.map(s => ({ ...s, tags: [...(s.tags || []), 'Pasted'] }));
};

export const addPastedSong = (song: Song) => {
  const tagged = { ...song, tags: [...(song.tags || []), 'Pasted'] };
  pastedSongs.unshift(tagged);
};

export const searchLyrics = async (query: string, category?: string): Promise<Song[]> => {
  const allLocal = [...pastedSongs, ...cachedSongs];
  let filtered = allLocal;

  if (category && category !== 'All') {
    filtered = filtered.filter(s => s.tags?.includes(category));
  }

  if (query) {
    const normalized = query.toLowerCase();
    filtered = filtered.filter(s => 
      s.title.toLowerCase().includes(normalized) || 
      (s.artist && s.artist.toLowerCase().includes(normalized))
    );
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
