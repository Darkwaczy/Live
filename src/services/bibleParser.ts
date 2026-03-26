import { BibleVerse } from '../models/liveState';

const bookNames = [
  { name: 'Genesis', aliases: ['Gen'] },
  { name: 'Exodus', aliases: ['Exod', 'Ex'] },
  { name: 'Leviticus', aliases: ['Lev'] },
  { name: 'Numbers', aliases: ['Num', 'Nu'] },
  { name: 'Deuteronomy', aliases: ['Deut', 'Dt'] },
  { name: 'Joshua', aliases: ['Josh', 'Jos'] },
  { name: 'Judges', aliases: ['Judg', 'Jdg'] },
  { name: 'Ruth', aliases: ['Ru'] },
  { name: '1 Samuel', aliases: ['1 Sam', '1Sa', 'I Samuel'] },
  { name: '2 Samuel', aliases: ['2 Sam', '2Sa', 'II Samuel'] },
  { name: '1 Kings', aliases: ['1 Kgs', '1Ki', 'I Kings'] },
  { name: '2 Kings', aliases: ['2 Kgs', '2Ki', 'II Kings'] },
  { name: '1 Chronicles', aliases: ['1 Chron', '1Ch', 'I Chronicles'] },
  { name: '2 Chronicles', aliases: ['2 Chron', '2Ch', 'II Chronicles'] },
  { name: 'Ezra', aliases: ['Ezr'] },
  { name: 'Nehemiah', aliases: ['Neh'] },
  { name: 'Esther', aliases: ['Est'] },
  { name: 'Job', aliases: [] },
  { name: 'Psalms', aliases: ['Psalm', 'Ps', 'Pslm'] },
  { name: 'Proverbs', aliases: ['Prov', 'Prv'] },
  { name: 'Ecclesiastes', aliases: ['Eccl', 'Ecc'] },
  { name: 'Song of Solomon', aliases: ['Song', 'So', 'Canticles'] },
  { name: 'Isaiah', aliases: ['Isa'] },
  { name: 'Jeremiah', aliases: ['Jer'] },
  { name: 'Lamentations', aliases: ['Lam'] },
  { name: 'Ezekiel', aliases: ['Ezek', 'Eze'] },
  { name: 'Daniel', aliases: ['Dan'] },
  { name: 'Hosea', aliases: ['Hos'] },
  { name: 'Joel', aliases: ['Joe'] },
  { name: 'Amos', aliases: ['Am'] },
  { name: 'Obadiah', aliases: ['Oba'] },
  { name: 'Jonah', aliases: ['Jon'] },
  { name: 'Micah', aliases: ['Mic'] },
  { name: 'Nahum', aliases: ['Nah'] },
  { name: 'Habakkuk', aliases: ['Hab'] },
  { name: 'Zephaniah', aliases: ['Zeph'] },
  { name: 'Haggai', aliases: ['Hag'] },
  { name: 'Zechariah', aliases: ['Zech'] },
  { name: 'Malachi', aliases: ['Mal'] },
  { name: 'Matthew', aliases: ['Matt', 'Mt'] },
  { name: 'Mark', aliases: ['Mrk', 'Mk'] },
  { name: 'Luke', aliases: ['Luk'] },
  { name: 'John', aliases: ['Jn'] },
  { name: 'Acts', aliases: ['Ac'] },
  { name: 'Romans', aliases: ['Rom', 'Ro'] },
  { name: '1 Corinthians', aliases: ['1 Cor', '1Co', 'I Corinthians'] },
  { name: '2 Corinthians', aliases: ['2 Cor', '2Co', 'II Corinthians'] },
  { name: 'Galatians', aliases: ['Gal'] },
  { name: 'Ephesians', aliases: ['Eph'] },
  { name: 'Philippians', aliases: ['Phil'] },
  { name: 'Colossians', aliases: ['Col'] },
  { name: '1 Thessalonians', aliases: ['1 Thes', '1Th'] },
  { name: '2 Thessalonians', aliases: ['2 Thes', '2Th'] },
  { name: '1 Timothy', aliases: ['1 Tim', '1Ti'] },
  { name: '2 Timothy', aliases: ['2 Tim', '2Ti'] },
  { name: 'Titus', aliases: ['Tit'] },
  { name: 'Philemon', aliases: ['Phm'] },
  { name: 'Hebrews', aliases: ['Heb'] },
  { name: 'James', aliases: ['Jas'] },
  { name: '1 Peter', aliases: ['1 Pet', '1Pe'] },
  { name: '2 Peter', aliases: ['2 Pet', '2Pe'] },
  { name: '1 John', aliases: ['1 Jn'] },
  { name: '2 John', aliases: ['2 Jn'] },
  { name: '3 John', aliases: ['3 Jn'] },
  { name: 'Jude', aliases: [] },
  { name: 'Revelation', aliases: ['Rev', 'Re'] }
];

const bookRegex = bookNames
  .map((book) => [book.name, ...book.aliases].join('|'))
  .join('|');

const biblePattern = new RegExp(`\\b(${bookRegex})\\s+(\\d{1,3}):(\\d{1,3})(?:-(\\d{1,3}))?\\b`, 'i');

export function detectBibleVerse(text: string): BibleVerse | null {
  // Normalize spoken structures from speech-to-text engines
  const normalizedText = text
    .replace(/chapter\s+(\d+)(?:\s*,?\s*|\s+verse\s+|\s+)(\d+)/gi, '$1:$2')
    .replace(/(\d+)\s*,\s*(\d+)/g, '$1:$2') // "John 3, 16" -> "John 3:16"
    .replace(/verse\s+(\d+)/gi, ':$1');

  const match = biblePattern.exec(normalizedText);
  if (!match) return null;

  const rawBook = match[1];
  const chapter = parseInt(match[2], 10);
  const verse_start = parseInt(match[3], 10);
  const verse_end = match[4] ? parseInt(match[4], 10) : verse_start;

  const normalizedBook = resolveBookName(rawBook);

  return {
    book: normalizedBook,
    chapter,
    verse_start,
    verse_end
  };
}

function resolveBookName(rawBook: string): string {
  const normalized = rawBook.trim().toLowerCase();
  const entry = bookNames.find((book) =>
    [book.name, ...book.aliases].some((alias) => alias.toLowerCase() === normalized)
  );
  return entry?.name ?? rawBook;
}

export async function detectBibleVerseAI(
  text: string, 
  endpoint: string, 
  apiKey: string,
  model: string = 'mistral'
): Promise<BibleVerse | null> {
  const prompt = `Analyze the following spoken text from a church sermon. If the speaker is referencing or paraphrasing a specific Bible story, passage, or verse, determine the exact book, chapter, and verse starting point. Return YOUR ENTIRE RESPONSE as a valid JSON object matching this exact schema: {"book": "Genesis", "chapter": 1, "verse_start": 1}. If no biblical reference is present, return exactly {"book": null}. Do not include markdown, backticks, or conversational text. The spoken text is: "${text}"`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
         model: model,
         messages: [ { role: "user", content: prompt } ],
         temperature: 0.1,
         stream: false
      })
    });
    
    if (!res.ok) {
       console.error("AI Verse Inference Failed", await res.text());
       return null;
    }
    
    const data = await res.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
       if (data.response) {
          // Fallback for native Ollama /api/generate endpoints which return { response: "" }
          const parsed = JSON.parse(data.response.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (parsed.book) {
             return { book: resolveBookName(parsed.book), chapter: Number(parsed.chapter), verse_start: Number(parsed.verse_start), verse_end: Number(parsed.verse_start) };
          }
       }
       return null;
    }
    
    // Fallback for OpenAI / v1/chat/completions endpoints
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed && parsed.book && parsed.chapter && parsed.verse_start) {
       return {
          book: resolveBookName(parsed.book),
          chapter: Number(parsed.chapter),
          verse_start: Number(parsed.verse_start),
          verse_end: parsed.verse_end ? Number(parsed.verse_end) : Number(parsed.verse_start)
       };
    }
  } catch (err) {
    console.error("AI Verse Inference Exception:", err);
  }
  return null;
}

export function crossReference(verse: BibleVerse): BibleVerse[] {
  const references: BibleVerse[] = [];
  if (verse.book === 'John' && verse.chapter === 3 && verse.verse_start === 16) {
    references.push({ book: 'Romans', chapter: 5, verse_start: 8, verse_end: 8 });
    references.push({ book: '1 John', chapter: 4, verse_start: 9, verse_end: 9 });
  }
  if (verse.book.toLowerCase().includes('corinthians') && verse.chapter === 13) {
    references.push({ book: '1 Peter', chapter: 4, verse_start: 8, verse_end: 8 });
  }
  return references;
}
