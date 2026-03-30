import { describe, it, expect } from 'vitest';
import { detectBibleVerse } from '../services/bibleParser';

describe('Bible Parser - Nigerian Church Context', () => {
  it('should detect Genesis 5:18 (compound numbers)', () => {
    const result = detectBibleVerse("Genesis five eighteen");
    expect(result).not.toBeNull();
    expect(result?.book).toBe('Genesis');
    expect(result?.chapter).toBe(5);
    expect(result?.verse_start).toBe(18);
  });

  it('should detect Luke 5:5 (repeated single digits)', () => {
    const result = detectBibleVerse("Luke five five");
    expect(result).not.toBeNull();
    expect(result?.book).toBe('Luke');
    expect(result?.chapter).toBe(5);
    expect(result?.verse_start).toBe(5);
  });

  it('should handle "Oluwa" and Pidgin prefixes', () => {
    const result = detectBibleVerse("Oluwa says open to John one one");
    expect(result).not.toBeNull();
    expect(result?.book).toBe('John');
    expect(result?.chapter).toBe(1);
    expect(result?.verse_start).toBe(1);
  });

  it('should detect Psalms 23:1 with filler words', () => {
    const result = detectBibleVerse("Let us look at Psalm twenty three verse one");
    expect(result).not.toBeNull();
    expect(result?.book).toBe('Psalms');
    expect(result?.chapter).toBe(23);
    expect(result?.verse_start).toBe(1);
  });

  it('should handle "and" separator (Luke sixteen and one)', () => {
    const result = detectBibleVerse("Luke sixteen and one");
    expect(result).not.toBeNull();
    expect(result?.book).toBe('Luke');
    expect(result?.chapter).toBe(16);
    expect(result?.verse_start).toBe(1);
  });

  it('should work for Revelation 22:21', () => {
    const result = detectBibleVerse("Revelation twenty two twenty one");
    expect(result).not.toBeNull();
    expect(result?.book).toBe('Revelation');
    expect(result?.chapter).toBe(22);
    expect(result?.verse_start).toBe(21);
  });

  it('should resolve fuzzy book names (mishearings)', () => {
    // "Genests" -> "Genesis"
    const result = detectBibleVerse("Look at Genests one one");
    expect(result).not.toBeNull();
    expect(result?.book).toBe('Genesis');
  });

  it('should handle mixed digits and words', () => {
    const result = detectBibleVerse("Matthew 24 verse seven");
    expect(result).not.toBeNull();
    expect(result?.book).toBe('Matthew');
    expect(result?.chapter).toBe(24);
    expect(result?.verse_start).toBe(7);
  });
});
