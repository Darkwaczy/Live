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
  current_song_id?: string | null;  // ID of active song
  current_line?: number;
  // --- LYRIC BROADCAST STATE (independent of Sermon Point) ---
  current_lyric_line?: string | null;  // Line currently on Live On Screen
  current_lyric_index?: number;        // Index of current live lyric
  preview_lyric_line?: string | null;  // Line staged in Preview
  preview_lyric_index?: number;        // Index of preview lyric
  preview_text?: string;
  preview_verse?: BibleVerse | null;
  preview_verse_text?: string | null;   // Staged verse text
  current_verse_text?: string | null;   // Active verse text on TV
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
  is_point?: boolean;
  media_muted?: boolean;
  media_playing?: boolean;
  media_volume?: number;
  media_epoch?: number;
  media_currentTime?: number;
  preview_media_muted?: boolean;
  preview_media_playing?: boolean;
  preview_media_volume?: number;
  updated_at: string;
}
