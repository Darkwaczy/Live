export interface Note {
  id?: string;
  user_id: string;
  session_id: string;
  content: string;
  timestamp: number; // milliseconds
  context?: {
    sermon_time?: number;
    bible_verse?: {
      book: string;
      chapter: number;
      verse_start: number;
      verse_end: number;
    };
    lyric_line?: number;
  };
  created_at?: string;
  updated_at?: string;
}
