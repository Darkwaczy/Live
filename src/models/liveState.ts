export interface LiveHistoryItem {
  type: 'scripture' | 'lyrics' | 'note';
  content: string;
  reference?: string;
  timestamp: string;
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
}

export interface LiveState {
  session_id: string;
  current_text: string;
  current_verse?: BibleVerse | null;
  secondary_verse?: string | null; // For parallel view
  current_song?: string;
  current_line?: number;
  preview_text?: string;
  preview_verse?: BibleVerse | null;
  is_live_dirty?: boolean;
  history: LiveHistoryItem[];
  content_type?: 'scripture' | 'lyrics' | 'notes';
  updated_at: string;
}
