import { BibleVerse } from '../models/liveState';

const bookNames = [
  { name: 'Genesis', aliases: ['Gen'] },
  { name: 'Exodus', aliases: ['Exod', 'Ex', 'Exitos', 'Exit'] },
  { name: 'Leviticus', aliases: ['Lev'] },
  { name: 'Numbers', aliases: ['Num', 'Nu', 'Number'] },
  { name: 'Deuteronomy', aliases: ['Deut', 'Dt'] },
  { name: 'Joshua', aliases: ['Josh', 'Jos'] },
  { name: 'Judges', aliases: ['Judg', 'Jdg', 'Georges', 'Judge', 'George'] },
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

// Sort books by length (desc) to ensure "1 John" matches before "John"
const sortedBookRegex = bookNames
  .flatMap(book => [book.name, ...book.aliases])
  .sort((a, b) => b.length - a.length)
  .join('|');

const biblePattern = new RegExp(`\\b(${sortedBookRegex})\\s+(\\d{1,3}):(\\d{1,3})(?:-(\\d{1,3}))?\\b`, 'i');
// Pattern for "john 316" format (no colon, when speech-to-text merges numbers)
// Matches: book + space + consecutive digits (e.g., "john 316")
const biblePatternNoColon = new RegExp(`\\b(${sortedBookRegex})\\s+(\\d{2,5})\\b`, 'i');
// Generic fallback for misheard books (e.g. "Genests 1:1")
const genericBiblePattern = /\b([a-z1-3\s]{3,15})\s+(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?\b/i;

export function detectBibleVerse(text: string): BibleVerse | null {
  // Clean transcription artifacts like #, /, \, |, _, , 
  const sanitizedText = text
    .replace(/[#\\|_]/g, ' ') // Strip weird prefix symbols
    .replace(/(\d+)\s*[\/,]\s*(\d+)/g, '$1:$2') // "3/16" or "3, 16" -> "3:16"
    .replace(/(\D),\s*(\d)/g, '$1 $2') // "John, 316" -> "John 316"
    .replace(/\s+/g, ' ')
    .trim();

  // Hard fix for common phrases
  if (/fishers\s*of\s*men/i.test(sanitizedText)) {
    return { book: 'Matthew', chapter: 4, verse_start: 19, verse_end: 19 };
  }
  if (/john\s*316\b/i.test(sanitizedText)) {
    return { book: 'John', chapter: 3, verse_start: 16, verse_end: 16 };
  }
  
  console.log(`🔍 [detectBibleVerse] Input: "${text}" (Sanitized: "${sanitizedText}")`);
  
  // Normalize spoken structures from speech-to-text engines
  let normalizedText = sanitizedText
    .replace(/chapter\s+(\d+)(?:\s*,?\s*|\s+verses?\s+|\s+)(\d+)/gi, '$1:$2')
    .replace(/\b(\d+)\s+verses?\s+(\d+)/gi, '$1:$2') 
    .replace(/\b(\d+)\s*(?::|\s+)\s*(\d+)\s*(?:to|through|until|-|–|—)\s*(\d+)\b/gi, '$1:$2-$3') // "15:1 to 5", "15 1 to 5"
    .replace(/(\d+)\s*,\s*(\d+)/g, '$1:$2') 
    .replace(/verses?\s+(\d+)/gi, ':$1')
    .replace(/\s+/g, ' '); 

  console.log(`  → Normalized: "${normalizedText}"`);

  // First try: Standard pattern with colon
  let match = biblePattern.exec(normalizedText);
  if (match) {
    console.log(`  ✅ Matched colon pattern: ${match[1]} ${match[2]}:${match[3]}`);
  } else {
    // Second try: Generic fallback for accents/mishearings
    match = genericBiblePattern.exec(normalizedText);
    if (match) {
      const fuzzyBook = resolveBookName(match[1]);
      if (fuzzyBook !== match[1]) {
        console.log(`  ✅ Matched generic pattern with fuzzy resolve: ${match[1]} -> ${fuzzyBook}`);
      } else {
        // If it didn't resolve and it's some random word, ignore it to prevent false positives
        match = null;
      }
    }
  }

  if (!match) {
    // Third try: Handle "john 316" format
    const noColonMatch = biblePatternNoColon.exec(normalizedText);
    if (noColonMatch) {
      const book = noColonMatch[1];
      const combinedDigits = noColonMatch[2];
      
      // Try splitting: last 2 digits as verse, rest as chapter
      // E.g., "316" → chapter="3", verse="16"; "2310" → chapter="23", verse="10"
      let chapter: number;
      let verse: number;
      
      if (combinedDigits.length === 2) {
        // If only 2 digits, treat as chapter 1, verse XX OR chapter X, verse Y (if book has many chapters)
        // For safety in speech-to-text, usually single digit chapter + single digit verse
        if (combinedDigits[0] !== '0') {
           chapter = parseInt(combinedDigits[0], 10);
           verse = parseInt(combinedDigits[1], 10);
        } else {
           chapter = 1;
           verse = parseInt(combinedDigits, 10);
        }
      } else if (combinedDigits.length === 3) {
        // If 3 digits, likely: single digit chapter + 2 digit verse (e.g., 316)
        // OR 2 digit chapter + 1 digit verse
        chapter = parseInt(combinedDigits.slice(0, -2) || combinedDigits[0], 10);
        verse = parseInt(combinedDigits.slice(-2), 10);
      } else {
        // If 4+ digits, chapter is first digits, last 2 are verse
        chapter = parseInt(combinedDigits.slice(0, -2), 10);
        verse = parseInt(combinedDigits.slice(-2), 10);
      }
      
      const fixedRef = `${book} ${chapter}:${verse}`;
      console.log(`  🔧 Fixed no-colon format "${noColonMatch[0]}" → "${fixedRef}" (split: ch=${chapter}, v=${verse})`);
      match = biblePattern.exec(fixedRef);
      if (match) {
        return {
          book: resolveBookName(match[1]),
          chapter: parseInt(match[2], 10),
          verse_start: parseInt(match[3], 10),
          verse_end: match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10)
        };
      }
    }
  }

  if (!match) {
    console.log(`  ❌ No Bible verse detected in text`);
    return null;
  }

  const rawBook = match[1];
  const chapter = parseInt(match[2], 10);
  const verse_start = parseInt(match[3], 10);
  const verse_end = match[4] ? parseInt(match[4], 10) : verse_start;

  const normalizedBook = resolveBookName(rawBook);

  console.log(`✅ Bible verse detected: ${normalizedBook} ${chapter}:${verse_start}${verse_end > verse_start ? `-${verse_end}` : ''}`);

  return {
    book: normalizedBook,
    chapter,
    verse_start,
    verse_end
  };
}

function resolveBookName(rawBook: string): string {
  const normalized = rawBook.trim().toLowerCase();
  
  // 1. Exact or Alias match
  const exactMatch = bookNames.find((book) =>
    [book.name, ...book.aliases].some((alias) => alias.toLowerCase() === normalized)
  );
  if (exactMatch) return exactMatch.name;

  // 2. Fuzzy match fallback for accents/mishearings
  let bestMatch = null;
  let highestScore = 0;

  for (const book of bookNames) {
    const targets = [book.name, ...book.aliases];
    for (const target of targets) {
      const distance = getLevenshteinDistance(normalized, target.toLowerCase());
      const maxLength = Math.max(normalized.length, target.length);
      const score = 1 - (distance / maxLength);
      
      if (score > 0.8 && score > highestScore) {
        highestScore = score;
        bestMatch = book.name;
      }
    }
  }

  return bestMatch ?? rawBook;
}

function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

export async function detectBibleVerseAI(
  text: string, 
  endpoint: string, 
  apiKey: string,
  model: string = 'mistral'
): Promise<BibleVerse | null> {
  const prompt = `Analyze the following spoken text from a sermon. 
  1. Identify any explicit Bible references (e.g., "John 3:16").
  2. Identify any paraphrased or quoted scripture even without a reference (e.g., "follow me and I will make you fishers of men" -> Matthew 4:19).
  3. Map phonetic variations/accents (e.g., "Georges" -> "Judges").
  Return ONLY a JSON object: {"book": "BookName", "chapter": X, "verse_start": Y}. 
  If multiple verses are quoted, pick the most prominent one. If no scripture is found, return {"book": null}. 
  Target: "${text}"`;

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

/**
 * Classifies transcribed text content as Scripture, Lyrics, or Notes
 * Returns the type and confidence score (0-1)
 */
export function classifyContent(text: string): { type: 'scripture' | 'lyrics' | 'notes'; confidence: number } {
  const lowerText = text.toLowerCase();
  
  // Scripture indicators
  const scripturePatterns = [
    /\b(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|john|jude|revelation)\s+\d+/gi,
    /\b(chapter|verse|scripture|bible|testament|passage|verse|psalm|eternal|redemption|salvation|covenant|gospel|apostle|disciple)\b/gi,
    /\b(god|lord|jesus|christ|holy spirit|father|amen|glory|praised)\b/gi
  ];
  
  const scriptureMatches = scripturePatterns.reduce((count, pattern) => count + (lowerText.match(pattern) || []).length, 0);
  
  // Lyrics indicators
  const lyricsPatterns = [
    /\b(love|heart|soul|sky|night|light|shine|bright|fly|high|dream|song|sing|forever|always|never|want|need|feel)\b/gi,
    /\b(chorus|verse|bridge|hook|beat|tempo|rhythm|rhyme|melody|music)\b/gi,
    /\b(yeah|oh|babe|baby|darling|honey|sweet|kiss|hold|together)\b/gi
  ];
  
  const lyricsMatches = lyricsPatterns.reduce((count, pattern) => count + (lowerText.match(pattern) || []).length, 0);
  
  // Notes indicators
  const notesPatterns = [
    /\b(remember|important|note|point|remind|emphasis|summary|key|topic|remember|focus)\b/gi,
    /\b(like|basically|so|actually|right|you know|i mean|well)\b/gi,
  ];
  
  const notesMatches = notesPatterns.reduce((count, pattern) => count + (lowerText.match(pattern) || []).length, 0);
  
  const total = scriptureMatches + lyricsMatches + notesMatches;
  
  if (total === 0) {
    return { type: 'notes', confidence: 0.5 };
  }
  
  if (scriptureMatches >= lyricsMatches && scriptureMatches >= notesMatches) {
    return { type: 'scripture', confidence: scriptureMatches / total };
  } else if (lyricsMatches >= notesMatches) {
    return { type: 'lyrics', confidence: lyricsMatches / total };
  } else {
    return { type: 'notes', confidence: notesMatches / total };
  }
}
