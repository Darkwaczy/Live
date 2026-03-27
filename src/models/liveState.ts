<<<<<<< HEAD
export interface LiveHistoryItem {
  type: 'scripture' | 'lyrics' | 'note';
  content: string;
  reference?: string;
  timestamp: string;
}

=======
>>>>>>> 1d421d8b32dda4748bbb1120594e66a46f4921c2
export interface LiveState {
  session_id: string;
  current_text: string;
  current_verse?: BibleVerse | null;
<<<<<<< HEAD
  secondary_verse?: string | null; // For parallel view
  current_song?: string;
  current_line?: number;
  preview_text?: string;
  preview_verse?: BibleVerse | null;
  is_live_dirty?: boolean;
  history: LiveHistoryItem[];
  content_type?: 'scripture' | 'lyrics' | 'notes';
=======
  current_song?: string;
  current_line?: number;
  content_type?: 'scripture' | 'lyrics' | 'notes'; // What type of content is being transcribed
>>>>>>> 1d421d8b32dda4748bbb1120594e66a46f4921c2
  updated_at: string;
}

export interface BibleVerse {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
}
