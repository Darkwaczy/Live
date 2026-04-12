"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sql_js_1 = __importDefault(require("sql.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const https_1 = __importDefault(require("https"));
const dbPath = path_1.default.join(__dirname, '..', 'bible-temp.db'); // Create a local DB next to electron folder
async function buildDatabase() {
    console.log(`Setting up database with sql.js at ${dbPath}`);
    const wasmPath = path_1.default.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    const wasmBinary = new Uint8Array(fs_1.default.readFileSync(wasmPath));
    const SQL = await (0, sql_js_1.default)({
        wasmBinary: wasmBinary
    });
    const db = new SQL.Database();
    db.run(`
    DROP TABLE IF EXISTS verses;
    DROP TABLE IF EXISTS cross_references;

    CREATE TABLE verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book TEXT,
      chapter INTEGER,
      verse INTEGER,
      text TEXT,
      translation TEXT
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
    console.log("Loading KJV JSON into SQLite...");
    const kjvPath = path_1.default.join(__dirname, '..', 'public', 'bibles', 'kjv.json');
    if (!fs_1.default.existsSync(kjvPath)) {
        console.error(`Error: Could not find ${kjvPath}`);
        return;
    }
    const kjvData = JSON.parse(fs_1.default.readFileSync(kjvPath, 'utf8'));
    const insertVerse = db.prepare('INSERT INTO verses (book, chapter, verse, text, translation) VALUES (?, ?, ?, ?, ?)');
    for (const book of kjvData) {
        const bookName = book.name || book.book;
        if (!bookName || !book.chapters)
            continue;
        for (let cIndex = 0; cIndex < book.chapters.length; cIndex++) {
            const chapter = cIndex + 1;
            const verses = book.chapters[cIndex];
            for (let vIndex = 0; vIndex < verses.length; vIndex++) {
                const verse = vIndex + 1;
                const text = verses[vIndex];
                insertVerse.run([bookName, chapter, verse, text, 'KJV']);
            }
        }
    }
    insertVerse.free();
    console.log("KJV Database loaded successfully.");
    console.log("Downloading OpenBible Cross References (~15MB)...");
    const crossRefUrl = "https://raw.githubusercontent.com/openbibleinfo/CrossReferences/master/cross_references.txt";
    https_1.default.get(crossRefUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log("Download complete. Parsing 340,000+ cross-references...");
            const insertRef = db.prepare(`
        INSERT INTO cross_references (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse, votes) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
            const lines = data.split('\n');
            for (let i = 1; i < lines.length; i++) { // Skip header
                const line = lines[i].trim();
                if (!line)
                    continue;
                const parts = line.split('\t');
                if (parts.length < 3)
                    continue;
                const fromParts = parts[0].split('.');
                const toParts = parts[1].split('.');
                const votes = parseInt(parts[2], 10);
                if (fromParts.length !== 3 || toParts.length !== 3)
                    continue;
                const normalizeBook = (short) => {
                    const map = {
                        'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
                        'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth', '1Sam': '1 Samuel', '2Sam': '2 Samuel',
                        '1Kgs': '1 Kings', '2Kgs': '2 Kings', '1Chr': '1 Chronicles', '2Chr': '2 Chronicles', 'Ezra': 'Ezra',
                        'Neh': 'Nehemiah', 'Esth': 'Esther', 'Job': 'Job', 'Ps': 'Psalms', 'Prov': 'Proverbs',
                        'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon', 'Isa': 'Isaiah', 'Jer': 'Jeremiah',
                        'Lam': 'Lamentations', 'Ezek': 'Ezekiel', 'Dan': 'Daniel', 'Hos': 'Hosea', 'Joel': 'Joel',
                        'Amos': 'Amos', 'Obad': 'Obadiah', 'Jonah': 'Jonah', 'Mic': 'Micah', 'Nah': 'Nahum',
                        'Hab': 'Habakkuk', 'Zeph': 'Zechariah', 'Hag': 'Haggai', 'Zech': 'Zechariah', 'Mal': 'Malachi',
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
                insertRef.run([
                    fromBook, parseInt(fromParts[1], 10), parseInt(fromParts[2], 10),
                    toBook, parseInt(toParts[1], 10), parseInt(toParts[2], 10),
                    votes
                ]);
            }
            insertRef.free();
            console.log("Database built successfully!");
            const binaryData = db.export();
            fs_1.default.writeFileSync(dbPath, Buffer.from(binaryData));
            console.log("Database saved to: ", dbPath);
            db.close();
        });
    }).on('error', (e) => {
        console.error("Error downloading cross-references:", e);
    });
}
buildDatabase();
