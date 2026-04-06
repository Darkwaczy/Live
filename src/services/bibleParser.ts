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

const numberWords: Record<string, number> = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
  'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
};

function normalizePhoneticNumbers(text: string): string {
  let words = text.toLowerCase().split(/\s+/);
  let result: string[] = [];
  let currentNum = 0;
  let inNumber = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,]/g, '');
    const val = numberWords[word];

    if (val !== undefined) {
      if (!inNumber) {
        currentNum = val;
        inNumber = true;
      } else {
        // Compound check: e.g., "twenty" + "five" = 25
        if (val < 10 && currentNum >= 10 && currentNum % 10 === 0) {
          currentNum += val;
        } else {
          // New distinct number: e.g., "one" space "one" -> "1 1"
          result.push(currentNum.toString());
          currentNum = val;
        }
      }
    } else {
      if (inNumber) {
        result.push(currentNum.toString());
        currentNum = 0;
        inNumber = false;
      }
      result.push(words[i]);
    }
  }
  if (inNumber) result.push(currentNum.toString());
  
  return result.join(' ');
}

export function detectBibleVerse(text: string): BibleVerse[] {
  const results: BibleVerse[] = [];
  const foundRefs = new Set<string>(); // Used to prevent duplicate pushing of the exact same verse in one pass

  const addResult = (book: string, chapter: number, verse_start: number, verse_end: number) => {
    const ref = `${book} ${chapter}:${verse_start}`;
    if (!foundRefs.has(ref)) {
      foundRefs.add(ref);
      results.push({ book, chapter, verse_start, verse_end });
    }
  };

  // Clean transcription artifacts
  const sanitizedText = text
    .replace(/[#\\|_]/g, ' ') 
    .replace(/(\d+)\s*[\/,]\s*(\d+)/g, '$1:$2') 
    .replace(/(\D),\s*(\d)/g, '$1 $2') 
    .replace(/\s+/g, ' ')
    .trim();

  // Hard fix for common phrases
  const SEMANTIC_HOTKEYS: Record<string, BibleVerse> = {
    'fishers of men': { book: 'Matthew', chapter: 4, verse_start: 19, verse_end: 19 },
    'john 3 16': { book: 'John', chapter: 3, verse_start: 16, verse_end: 16 },
    'for god so loved the world': { book: 'John', chapter: 3, verse_start: 16, verse_end: 16 },
    'great commission': { book: 'Matthew', chapter: 28, verse_start: 19, verse_end: 20 },
    'our father who art in heaven': { book: 'Matthew', chapter: 6, verse_start: 9, verse_end: 13 },
  };

  for (const [phrase, verse] of Object.entries(SEMANTIC_HOTKEYS)) {
    if (sanitizedText.toLowerCase().includes(phrase)) {
      addResult(verse.book, verse.chapter, verse.verse_start, verse.verse_end || verse.verse_start);
    }
  }
  
  // Normalize spoken structures from speech-to-text engines
  let normalizedText = normalizePhoneticNumbers(sanitizedText)
    .replace(/chapter\s+(\d+)(?:\s*,?\s*|\s+verses?\s+|\s+)(\d+)/gi, '$1:$2')
    .replace(/\b(\d+)\s+verses?\s+(\d+)/gi, '$1:$2') 
    .replace(/\b(\d+)\s+and\s+(\d+)\b/gi, '$1:$2') 
    .replace(/\b(\d+)\s*(?::)\s*(\d+)\s*(?:to|through|until|-|–|—)\s*(\d+)\b/gi, '$1:$2-$3')
    .replace(/(\d+)\s*,\s*(\d+)/g, '$1:$2') 
    .replace(new RegExp(`\\b(${sortedBookRegex})\\s+(\\d{1,3})\\s+(\\d{1,3})\\b`, 'gi'), '$1 $2:$3')
    .replace(/verses?\s+(\d+)/gi, ':$1')
    .replace(/\s+/g, ' '); 

  // 1. Standard pattern with colon (multiple matching)
  const globalBiblePattern = new RegExp(biblePattern.source, 'gi');
  for (const match of normalizedText.matchAll(globalBiblePattern)) {
    const resolved = resolveBookName(match[1]);
    if (resolved) {
      addResult(resolved, parseInt(match[2], 10), parseInt(match[3], 10), match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10));
    }
  }

  // 2. Generic fallback for accents/mishearings
  const globalGenericPattern = new RegExp(genericBiblePattern.source, 'gi');
  for (const match of normalizedText.matchAll(globalGenericPattern)) {
    const resolved = resolveBookName(match[1]);
    if (resolved) {
      addResult(resolved, parseInt(match[2], 10), parseInt(match[3], 10), match[4] ? parseInt(match[4], 10) : parseInt(match[3], 10));
    }
  }

  // 3. Handle "john 316" format
  const globalNoColonPattern = new RegExp(biblePatternNoColon.source, 'gi');
  for (const match of normalizedText.matchAll(globalNoColonPattern)) {
    const book = match[1];
    const combinedDigits = match[2];
    
    let chapter: number;
    let verse: number;
    
    if (combinedDigits.length === 2) {
      if (combinedDigits[0] !== '0') {
         chapter = parseInt(combinedDigits[0], 10);
         verse = parseInt(combinedDigits[1], 10);
      } else {
         chapter = 1;
         verse = parseInt(combinedDigits, 10);
      }
    } else if (combinedDigits.length === 3) {
      chapter = parseInt(combinedDigits.slice(0, -2) || combinedDigits[0], 10);
      verse = parseInt(combinedDigits.slice(-2), 10);
    } else {
      chapter = parseInt(combinedDigits.slice(0, -2), 10);
      verse = parseInt(combinedDigits.slice(-2), 10);
    }
    
    const resolved = resolveBookName(book);
    if (resolved) {
       addResult(resolved, chapter, verse, verse);
    }
  }

  return results;
}

function resolveBookName(rawBook: string): string | null {
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

  return bestMatch;
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
  model: string = 'llama-3.3-70b-versatile'
): Promise<BibleVerse[]> {
  const resolvedEndpoint = apiKey ? 'https://api.groq.com/openai/v1/chat/completions' : endpoint;
  const resolvedModel = apiKey ? model : (model || 'llama-3.3-70b-versatile');

  const prompt = `You are a precise Bible reference identifier for a live church broadcast.
Your task is to identify ANY and ALL Bible verses spoken, read, or explicitly mentioned in the text.
Extract ALL of them as a JSON array of objects.

RESPONSE FORMAT (JSON ARRAY ONLY, NO OTHER TEXT):
If one or more verses are identified, return an array like this:
[
  {"book": "Luke", "chapter": 15, "verse_start": 11, "confidence": 0.93, "reason": "speaker describes prodigal son"},
  {"book": "John", "chapter": 3, "verse_start": 16, "confidence": 0.95, "reason": "direct quote or explicit call out"}
]

If NO verses or specific stories are found, return exactly this:
[]

RULES:
- General preaching ("God is good") without a specific story/quote = []
- DO NOT default to famous verses unless the text specifically describes them.
- Return ONLY the raw JSON array.

SERMON TEXT:
"${text.slice(-350)}"`;

  try {
    const res = await fetch(resolvedEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
        stream: false
      })
    });

    if (!res.ok) {
      console.warn('[AI Verse] Request failed:', res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || data?.response || '';
    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]|\[\s*\]/);
    if (!jsonMatch) return [];

    const parsedArray = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsedArray)) return [];

    const validResults: BibleVerse[] = [];

    for (const parsed of parsedArray) {
      if (!parsed?.book || parsed.book === 'null') continue;
      
      const confidence = Number(parsed.confidence ?? 0);
      if (confidence < 0.90) {
        console.log(`[AI Verse] ❌ Rejected: ${parsed.book} (${(confidence * 100).toFixed(0)}%) - "${parsed.reason}"`);
        continue;
      }

      const finalBook = resolveBookName(parsed.book) || parsed.book;
      const chapter = Number(parsed.chapter);
      const verse_start = Number(parsed.verse_start);
      const verse_end = parsed.verse_end ? Number(parsed.verse_end) : verse_start;

      if (finalBook && chapter && verse_start) {
         console.log(`[AI Verse] ✅ Found: ${finalBook} ${chapter}:${verse_start} (${(confidence * 100).toFixed(0)}%)`);
         validResults.push({ book: finalBook, chapter, verse_start, verse_end });
      }
    }

    return validResults;

  } catch (err) {
    console.warn('[AI Verse] Exception:', err);
    return [];
  }
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
