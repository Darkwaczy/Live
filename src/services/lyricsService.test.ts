import { findSongByWords, locateCurrentLine } from './lyricsService';

describe('Lyrics service', () => {
  test('finds song by title', () => {
    const song = findSongByWords('Now we sing Amazing Grace right now');
    expect(song).not.toBeNull();
    expect(song?.title).toBe('Amazing Grace');
  });

  test('finds song by first lyric part', () => {
    const song = findSongByWords('Bless the Lord O my soul, oh');
    expect(song).not.toBeNull();
    expect(song?.title).toBe('10,000 Reasons');
  });

  test('locates current lyric line', () => {
    const song = findSongByWords('Amazing grace how sweet');
    expect(song).not.toBeNull();
    const idx = locateCurrentLine(song!, 'Amazing grace how sweet the sound');
    expect(idx).toBe(0);
  });
});