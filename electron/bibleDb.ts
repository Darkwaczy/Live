import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const isDev = process.env.NODE_ENV !== 'production';

// The database is stored in the userData folder so it persists across updates in production
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'bible.db');

let db: any = null;
let SQL: any = null;

async function initDb() {
  if (!SQL) {
    const wasmPath = isDev 
      ? path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
      : path.join(process.resourcesPath, 'sql-wasm.wasm');
      
    if (!fs.existsSync(wasmPath)) {
      console.error(`WASM not found at ${wasmPath}`);
      throw new Error(`Critical Error: Database engine (WASM) not found.`);
    }

    const wasmBinary = new Uint8Array(fs.readFileSync(wasmPath)) as any;
    SQL = await initSqlJs({
      wasmBinary: wasmBinary
    });
  }

  if (!db) {
    // If the database doesn't exist in userData yet, copy the pre-built one
    if (!fs.existsSync(dbPath)) {
      const devTempPath = path.join(__dirname, '..', 'bible-temp.db');
      if (fs.existsSync(devTempPath)) {
         fs.copyFileSync(devTempPath, dbPath);
         console.log('Installed newly compiled bible-temp.db into user AppData folder.');
      }
    }

    if (fs.existsSync(dbPath)) {
      const fileBuffer = new Uint8Array(fs.readFileSync(dbPath)) as any;
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
      // Ensure schema exists (just as a safety backup)
      db.run(`
        CREATE TABLE IF NOT EXISTS verses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          book TEXT,
          chapter INTEGER,
          verse INTEGER,
          text TEXT,
          translation TEXT
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
  }
}

export async function getDb() {
  await initDb();
  return db;
}

/**
 * Perform a Keyword Search on the Bible to reverse-match spoken quotes.
 * Note: sql.js FTS5 availability varies, using LIKE as a safe fallback if needed.
 */
export async function searchBibleQuotes(queryText: string, limit: number = 1) {
  try {
    const database = await getDb();
    
    const sanitizedQuery = queryText.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    if (!sanitizedQuery) return [];
    
    // Using LIKE for maximum compatibility since FTS5 in sql.js can be tricky in some environments
    const stmt = database.prepare(`
      SELECT book, chapter, verse, text, translation
      FROM verses 
      WHERE text LIKE ? 
      LIMIT ?
    `);

    const results = [];
    stmt.bind([`%${sanitizedQuery}%`, limit]);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    return results;
  } catch (error) {
    console.error("Bible Search Error:", error);
    return [];
  }
}

/**
 * Get Cross-References for a specific verse, ordered by votes.
 */
export async function getCrossReferences(book: string, chapter: number, verse: number, limit: number = 5) {
  try {
    const database = await getDb();
    
    const stmt = database.prepare(`
      SELECT to_book as book, to_chapter as chapter, to_verse as verse_start, votes
      FROM cross_references
      WHERE from_book = ? AND from_chapter = ? AND from_verse = ?
      ORDER BY votes DESC
      LIMIT ?
    `);

    const refs = [];
    stmt.bind([book, chapter, verse, limit]);
    while (stmt.step()) {
      refs.push(stmt.getAsObject());
    }
    stmt.free();
    
    const verseStmt = database.prepare(`
      SELECT text, translation FROM verses 
      WHERE book = ? AND chapter = ? AND verse = ? 
      LIMIT 1
    `);
    
    for (let ref of refs as any[]) {
      verseStmt.bind([ref.book, ref.chapter, ref.verse_start]);
      if (verseStmt.step()) {
        const verseData = verseStmt.getAsObject() as any;
        ref.text = verseData.text;
        ref.translation = verseData.translation;
      }
      verseStmt.reset();
    }
    verseStmt.free();

    return refs;
  } catch (error) {
    console.error("Cross Reference Error:", error);
    return [];
  }
}

export function closeDb() {
  if (db) {
    // Optionally save back to disk if you made changes
    // const data = db.export();
    // fs.writeFileSync(dbPath, Buffer.from(data));
    db.close();
    db = null;
  }
}
