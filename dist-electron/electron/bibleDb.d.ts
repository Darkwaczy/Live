import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
/**
 * Perform a Full-Text Search on the Bible to reverse-match spoken quotes.
 */
export declare function searchBibleQuotes(queryText: string, limit?: number): unknown[];
/**
 * Get Cross-References for a specific verse, ordered by votes.
 */
export declare function getCrossReferences(book: string, chapter: number, verse: number, limit?: number): any[];
export declare function closeDb(): void;
