export interface LiveHistoryItem {
  id: string;
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
  preview_media?: string | null;  // URL for staged images/videos
  current_media?: string | null;  // URL for airing images/videos
  is_live_dirty: boolean;
  is_analyzing: boolean;
  detection_history: Array<{
    id: string;
    verse: BibleVerse;
    timestamp: string;
    confidence?: number;
    is_paraphrase?: boolean;
  }>;
  history: LiveHistoryItem[];
  content_type?: 'scripture' | 'lyrics' | 'notes' | 'media';
  ticker_items?: string[];
  ticker_enabled?: boolean;
  is_blank?: boolean;
  is_logo?: boolean;
  updated_at: string;
}
