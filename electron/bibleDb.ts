import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const isDev = process.env.NODE_ENV !== 'production';

// The database is stored in the userData folder so it persists across updates in production
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'bible.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // If the database doesn't exist in userData yet, copy the pre-built one
    if (!fs.existsSync(dbPath)) {
      const devTempPath = path.join(__dirname, '..', 'bible-temp.db');
      if (fs.existsSync(devTempPath)) {
         fs.copyFileSync(devTempPath, dbPath);
         console.log('Installed newly compiled bible-temp.db into user AppData folder.');
      }
    }

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    // Ensure schema exists (just as a safety backup)
    db.exec(`
      CREATE TABLE IF NOT EXISTS verses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book TEXT,
        chapter INTEGER,
        verse INTEGER,
        text TEXT,
        translation TEXT
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
        book, chapter, verse, text, content='verses', content_rowid='id'
      );
      
      CREATE TABLE IF NOT EXISTS cross_references (
        from_book TEXT,
        from_chapter INTEGER,
        from_verse INTEGER,
        to_book TEXT,
        to_chapter INTEGER,
        to_verse INTEGER,
        votes INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_cross_ref_from ON cross_references(from_book, from_chapter, from_verse);
    `);
  }
  return db;
}

/**
 * Perform a Full-Text Search on the Bible to reverse-match spoken quotes.
 */
export function searchBibleQuotes(queryText: string, limit: number = 1) {
  try {
    const database = getDb();
    
    // SQLite FTS5 matching expects a specific syntax. We sanitize the input to avoid SQL syntax errors.
    const sanitizedQuery = queryText.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    if (!sanitizedQuery) return [];
    
    // Create a precise phrase match
    const ftsQuery = `"${sanitizedQuery}"`;

    const stmt = database.prepare(`
      SELECT book, chapter, verse, text, translation
      FROM verses_fts 
      WHERE text MATCH ? 
      ORDER BY rank
      LIMIT ?
    `);

    return stmt.all(ftsQuery, limit);
  } catch (error) {
    console.error("FTS Search Error:", error);
    return [];
  }
}

/**
 * Get Cross-References for a specific verse, ordered by votes.
 */
export function getCrossReferences(book: string, chapter: number, verse: number, limit: number = 5) {
  try {
    const database = getDb();
    
    const stmt = database.prepare(`
      SELECT to_book as book, to_chapter as chapter, to_verse as verse_start, votes
      FROM cross_references
      WHERE from_book = ? AND from_chapter = ? AND from_verse = ?
      ORDER BY votes DESC
      LIMIT ?
    `);

    const refs = stmt.all(book, chapter, verse, limit) as any[];
    
    // Optionally fetch the actual text for these references
    const verseStmt = database.prepare(`
      SELECT text, translation FROM verses 
      WHERE book = ? AND chapter = ? AND verse = ? 
      LIMIT 1
    `);
    
    for (let ref of refs) {
      const verseData = verseStmt.get(ref.book, ref.chapter, ref.verse_start) as any;
      if (verseData) {
        ref.text = verseData.text;
        ref.translation = verseData.translation;
      }
    }

    return refs;
  } catch (error) {
    console.error("Cross Reference Error:", error);
    return [];
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
