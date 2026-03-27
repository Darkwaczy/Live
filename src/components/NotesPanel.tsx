import React, { useMemo, useState } from 'react';
import { Note } from '../models/note';
import { LiveState } from '../models/liveState';

interface NotesPanelProps {
  sessionId: string;
  userId: string;
  liveState: LiveState;
  onSave: (note: Note) => void;
  notes: Note[];
  onJumpToNote?: (noteId: string) => void;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ sessionId, userId, liveState, onSave, notes, onJumpToNote }) => {
  const [content, setContent] = useState('');

  const sortedNotes = useMemo(() => [...notes].sort((a, b) => a.timestamp - b.timestamp), [notes]);

  return (
    <div className="panel">
      <header>Notes</header>
      <div style={{ marginBottom: 8 }}>
        <textarea
          rows={5}
          value={content}
          placeholder="Take timestamped sermon notes..."
          style={{ width: '100%', borderRadius: 6, padding: 8, border: '1px solid var(--panel-border)', background: '#0f172a', color: '#c9d1d9' }}
          onChange={(e) => setContent(e.target.value)}
        />
        <button
          style={{ marginTop: 6, padding: '6px 12px', backgroundColor: '#58a6ff', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer' }}
          onClick={() => {
            if (!content.trim()) return;
            onSave({
              user_id: userId,
              session_id: sessionId,
              content: content.trim(),
              timestamp: Date.now(),
              context: {
                sermon_time: Date.now(),
                bible_verse: liveState.current_verse ?? undefined,
                lyric_line: liveState.current_line
              }
            });
            setContent('');
          }}
        >
          Save Note
        </button>
      </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {sortedNotes.length === 0 && <p>No notes yet</p>}
        {sortedNotes.map((note) => (
          <div key={`${note.user_id}-${note.timestamp}`} style={{ borderTop: '1px solid var(--panel-border)', padding: '8px 0' }}>
            <p style={{ margin: 0 }}>{note.content}</p>
            <small>
              {new Date(note.timestamp).toLocaleTimeString()} · {note.context?.bible_verse?.book ?? ''} {note.context?.bible_verse?.chapter ?? ''}:{note.context?.bible_verse?.verse_start ?? ''}
            </small>
            <div style={{ marginTop: 4 }}>
              <button
                style={{ marginRight: 6, fontSize: 11, padding: '4px 6px' }}
                onClick={() => onJumpToNote?.(`${note.user_id}-${note.timestamp}`)}
              >
                Jump to note
              </button>
              <button
                style={{ fontSize: 11, padding: '4px 6px' }}
                onClick={() => window.alert(`Jump to sermon time: ${note.context?.sermon_time || 'unknown'}`)}
              >
                Jump to time
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotesPanel;
