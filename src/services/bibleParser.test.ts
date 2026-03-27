import { detectBibleVerse } from './bibleParser';

describe('Bible parser', () => {
  test('detects full book name', () => {
    const res = detectBibleVerse('In John 3:16 the gospel is clear');
    expect(res).not.toBeNull();
    expect(res?.book).toBe('John');
    expect(res?.chapter).toBe(3);
    expect(res?.verse_start).toBe(16);
    expect(res?.verse_end).toBe(16);
  });

  test('detects abbreviated book name and range', () => {
    const res = detectBibleVerse('Please read 1 Cor 13:4-7 and meditate');
    expect(res).not.toBeNull();
    expect(res?.book).toBe('1 Corinthians');
    expect(res?.chapter).toBe(13);
    expect(res?.verse_start).toBe(4);
    expect(res?.verse_end).toBe(7);
    expect(detectBibleVerse('John 3:16')).toEqual({ book: 'John', chapter: 3, verse_start: 16, verse_end: 16 });
  });

  it('detects spoken formats without colons', () => {
    expect(detectBibleVerse('John 316')).toEqual({ book: 'John', chapter: 3, verse_start: 16, verse_end: 16 });
  });

  it('detects variations like verses keyword', () => {
    expect(detectBibleVerse('John chapter 3 verses 16')).toEqual({ book: 'John', chapter: 3, verse_start: 16, verse_end: 16 });
    expect(detectBibleVerse('John 3 verses 16')).toEqual({ book: 'John', chapter: 3, verse_start: 16, verse_end: 16 });
  });

  test('returns null when not present', () => {
    const res = detectBibleVerse('No verse here');
    expect(res).toBeNull();
  });
});