export interface LiveState {
  session_id: string;
  current_text: string;
  current_verse?: BibleVerse | null;
  current_song?: string;
  current_line?: number;
  preview_text?: string;
  preview_verse?: BibleVerse | null;
  is_live_dirty?: boolean;
  content_type?: 'scripture' | 'lyrics' | 'notes'; // What type of content is being transcribed
  updated_at: string;
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
}
