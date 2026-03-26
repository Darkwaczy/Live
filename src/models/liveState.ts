export interface LiveState {
  session_id: string;
  current_text: string;
  current_verse?: BibleVerse | null;
  current_song?: string;
  current_line?: number;
  updated_at: string;
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
}
