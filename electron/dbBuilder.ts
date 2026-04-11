import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import https from 'https';

const dbPath = path.join(__dirname, '..', 'bible-temp.db'); // Create a local DB next to electron folder

// 1. Setup DB
console.log(`Setting up database at ${dbPath}`);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  DROP TABLE IF EXISTS verses;
  DROP TABLE IF EXISTS verses_fts;
  DROP TABLE IF EXISTS cross_references;

  CREATE TABLE verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book TEXT,
    chapter INTEGER,
    verse INTEGER,
    text TEXT,
    translation TEXT
  );
  
  CREATE VIRTUAL TABLE verses_fts USING fts5(
    book, chapter, verse, text, content='verses', content_rowid='id'
  );
  
  CREATE TABLE cross_references (
    from_book TEXT,
    from_chapter INTEGER,
    from_verse INTEGER,
    to_book TEXT,
    to_chapter INTEGER,
    to_verse INTEGER,
    votes INTEGER
  );
  
  CREATE INDEX idx_cross_ref_from ON cross_references(from_book, from_chapter, from_verse);
`);

async function buildDatabase() {
  console.log("Loading KJV JSON into SQLite...");
  
  const kjvPath = path.join(__dirname, '..', 'public', 'bibles', 'kjv.json');
  if (!fs.existsSync(kjvPath)) {
    console.error(`Error: Could not find ${kjvPath}`);
    return;
  }

  const kjvData = JSON.parse(fs.readFileSync(kjvPath, 'utf8'));
  const insertVerse = db.prepare('INSERT INTO verses (book, chapter, verse, text, translation) VALUES (?, ?, ?, ?, ?)');
  
  db.transaction(() => {
    for (const book of kjvData) {
      const bookName = book.name || book.book;
      if (!bookName || !book.chapters) continue;
      
      for (let cIndex = 0; cIndex < book.chapters.length; cIndex++) {
        const chapter = cIndex + 1;
        const verses = book.chapters[cIndex];
        
        for (let vIndex = 0; vIndex < verses.length; vIndex++) {
          const verse = vIndex + 1;
          const text = verses[vIndex];
          insertVerse.run(bookName, chapter, verse, text, 'KJV');
        }
      }
    }
  })();
  
  // Rebuild FTS table
  db.exec("INSERT INTO verses_fts(verses_fts) VALUES('rebuild');");
  console.log("KJV Database loaded successfully.");

  console.log("Downloading OpenBible Cross References (~15MB)...");
  const crossRefUrl = "https://raw.githubusercontent.com/openbibleinfo/CrossReferences/master/cross_references.txt";
  
  https.get(crossRefUrl, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log("Download complete. Parsing 340,000+ cross-references...");
      
      const insertRef = db.prepare(`
        INSERT INTO cross_references (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse, votes) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const lines = data.split('\n');
      
      db.transaction(() => {
        for (let i = 1; i < lines.length; i++) { // Skip header
          const line = lines[i].trim();
          if (!line) continue;
          
          // Format: Gen.1.1 \t John.1.1 \t 10
          const parts = line.split('\t');
          if (parts.length < 3) continue;
          
          const fromParts = parts[0].split('.');
          const toParts = parts[1].split('.');
          const votes = parseInt(parts[2], 10);
          
          if (fromParts.length !== 3 || toParts.length !== 3) continue;
          
          const normalizeBook = (short: string) => {
             // Basic normalization from OSIS to our names
             const map: Record<string, string> = {
                'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
                'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth', '1Sam': '1 Samuel', '2Sam': '2 Samuel',
                '1Kgs': '1 Kings', '2Kgs': '2 Kings', '1Chr': '1 Chronicles', '2Chr': '2 Chronicles', 'Ezra': 'Ezra',
                'Neh': 'Nehemiah', 'Esth': 'Esther', 'Job': 'Job', 'Ps': 'Psalms', 'Prov': 'Proverbs',
                'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon', 'Isa': 'Isaiah', 'Jer': 'Jeremiah',
                'Lam': 'Lamentations', 'Ezek': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea', 'Joel': 'Joel',
                'Amos': 'Amos', 'Obad': 'Obadiah', 'Jonah': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum',
                'Hab': 'Habakkuk', 'Zeph': 'Zephaniah', 'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi',
                'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John', 'Acts': 'Acts',
                'Rom': 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians', 'Gal': 'Galatians',
                'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians', '1Thess': '1 Thessalonians',
                '2Thess': '2 Thessalonians', '1Tim': '1 Timothy', '2Tim': '2 Timothy', 'Titus': 'Titus',
                'Phlm': 'Philemon', 'Heb': 'Hebrews', 'Jas': 'James', '1Pet': '1 Peter', '2Pet': '2 Peter',
                '1John': '1 John', '2John': '2 John', '3John': '3 John', 'Jude': 'Jude', 'Rev': 'Revelation'
             };
             return map[short] || short;
          };

          const fromBook = normalizeBook(fromParts[0]);
          const toBook = normalizeBook(toParts[0]);

          insertRef.run(
              fromBook, parseInt(fromParts[1], 10), parseInt(fromParts[2], 10),
              toBook, parseInt(toParts[1], 10), parseInt(toParts[2], 10),
              votes
          );
        }
      })();
      
      console.log("Database built successfully! You can find it at: ", dbPath);
      console.log("Please copy this bible-temp.db into your app's userData folder (app.getPath('userData')) manually, or adapt bibleDb.ts to use this generated file locally for dev.");
      db.close();
    });
  }).on('error', (e) => {
    console.error("Error downloading cross-references:", e);
  });
}

buildDatabase();
