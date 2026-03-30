import { Song } from '../models/song';

export const sampleSongs: Song[] = [
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    artist: 'John Newton',
    lyrics: [
      { order: 0, line: 'Amazing grace how sweet the sound' },
      { order: 1, line: 'That saved a wretch like me' },
      { order: 2, line: 'I once was lost but now am found' },
      { order: 3, line: 'Was blind but now I see' }
    ]
  },
  {
    id: '10-000-reasons',
    title: '10,000 Reasons',
    artist: 'Matt Redman',
    lyrics: [
      { order: 0, line: 'Bless the Lord O my soul' },
      { order: 1, line: 'O my soul worship His holy name' },
      { order: 2, line: 'Sing like never before' },
      { order: 3, line: 'O my soul' },
      { order: 4, line: 'I worship Your holy name' }
    ]
  },
  {
    id: 'promises',
    title: 'Promises',
    artist: 'Maverick City Music',
    lyrics: [
      { order: 0, line: 'God of Abraham You\'re the God of covenant' },
      { order: 1, line: 'Of faithful promises' },
      { order: 2, line: 'Time and time again You have proven' },
      { order: 3, line: 'You do just what You say' },
      { order: 4, line: 'Though the storms may come and the winds may blow' },
      { order: 5, line: 'I\'ll remain steadfast' },
      { order: 6, line: 'And let my heart learn when You speak a word' },
      { order: 7, line: 'It will come to pass' },
      { order: 8, line: 'Great is Your faithfulness to me' },
      { order: 9, line: 'Great is Your faithfulness to me' },
      { order: 10, line: 'From the rising sun to the setting same' },
      { order: 11, line: 'I will praise Your name' },
      { order: 12, line: 'Great is Your faithfulness to me' },
      { order: 13, line: 'I\'ll never ever let You down' },
      { order: 14, line: 'I\'ll never ever' }
    ]
  },
  {
    id: 'way-maker',
    title: 'Way Maker',
    artist: 'Sinach',
    lyrics: [
      { order: 0, line: 'You are here moving in our midst' },
      { order: 1, line: 'I worship You I worship You' },
      { order: 2, line: 'You are here working in this place' },
      { order: 3, line: 'I worship You I worship You' },
      { order: 4, line: 'Way maker miracle worker promise keeper' },
      { order: 5, line: 'Light in the darkness my God that is who You are' }
    ]
  },
  {
    id: 'alpha-and-omega',
    title: 'Alpha and Omega',
    artist: 'Israel Houghton',
    lyrics: [
      { order: 0, line: 'You are Alpha and Omega' },
      { order: 1, line: 'We worship You our Lord' },
      { order: 2, line: 'You are worthy to be praised' },
      { order: 3, line: 'We give You all the glory' },
      { order: 4, line: 'We worship You our Lord' },
      { order: 5, line: 'You are worthy to be praised' }
    ]
  },
  {
    id: 'goodness-of-god',
    title: 'Goodness of God',
    artist: 'Bethel Music',
    lyrics: [
      { order: 0, line: 'I love You Lord' },
      { order: 1, line: 'Oh Your mercy never fails me' },
      { order: 2, line: 'All my days I\'ve been held in Your hands' },
      { order: 3, line: 'From the moment that I wake up' },
      { order: 4, line: 'Until I lay my head' },
      { order: 5, line: 'I will sing of the goodness of God' }
    ]
  }
];

export const findSongByWords = (text: string): Song | null => {
  const normalized = text.toLowerCase().replace(/[.,!?;:]/g, '');
  const words = normalized.split(/\s+/).slice(-30); // Look at last 30 words
  
  for (const song of sampleSongs) {
    if (normalized.includes(song.title.toLowerCase())) {
      return song;
    }
    
    // Check if any line has significant overlap with the recent transcript
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
  const transcriptWords = normalized.split(/\s+/).slice(-25); // Sliding window
  
  let bestLineIndex = -1;
  let highestScore = 0;

  song.lyrics.forEach((lyricLine, index) => {
    const lineWords = lyricLine.line.toLowerCase().replace(/[.,!?;:]/g, '').split(/\s+/);
    if (lineWords.length === 0) return;

    // Calculate overlap score
    let matchCount = 0;
    lineWords.forEach(w => {
      if (transcriptWords.includes(w)) matchCount++;
    });

    const score = matchCount / lineWords.length;
    
    // Bias towards lines that share at least 3 unique words or 50% of the line
    if (matchCount >= 3 || score > 0.5) {
      if (score > highestScore) {
        highestScore = score;
        bestLineIndex = index;
      }
    }
  });

  return bestLineIndex;
};
