export declare function getDb(): Promise<any>;
/**
 * Perform a Keyword Search on the Bible to reverse-match spoken quotes.
 * Note: sql.js FTS5 availability varies, using LIKE as a safe fallback if needed.
 */
export declare function searchBibleQuotes(queryText: string, limit?: number): Promise<any[]>;
/**
 * Get Cross-References for a specific verse, ordered by votes.
 */
export declare function getCrossReferences(book: string, chapter: number, verse: number, limit?: number): Promise<any[]>;
export declare function closeDb(): void;
