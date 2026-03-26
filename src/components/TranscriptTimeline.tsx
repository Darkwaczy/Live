import React, { useMemo } from 'react';
import { Note } from '../models/note';

interface TranscriptTimelineProps {
  notes: Note[];
  onJumpToNote: (noteId: string) => void;
  totalWords?: number;
}

const TranscriptTimeline: React.FC<TranscriptTimelineProps> = ({ notes, onJumpToNote, totalWords = 100 }) => {
  const notesWithPosition = useMemo(() => {
    return notes.map((note, idx) => ({
      ...note,
      position: Math.max(0, Math.min(100, ((idx + 1) / Math.max(1, notes.length)) * 100))
    }));
  }, [notes]);

  return (
    <div className="panel">
      <header>Transcript Timeline · {notes.length} notes</header>
      <div style={{ position: 'relative', height: 60, background: '#0f172a', borderRadius: 6, marginBottom: 8 }}>
        {/* Timeline bar */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: '#2e3b55', transform: 'translateY(-50%)' }} />

        {/* Note markers */}
        {notesWithPosition.map((note) => (
          <div
            key={`${note.user_id}-${note.timestamp}`}
            style={{
              position: 'absolute',
              left: `${note.position}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 12,
              height: 12,
              background: '#58a6ff',
              borderRadius: '50%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid #0f172a'
            }}
            onClick={() => onJumpToNote(`${note.user_id}-${note.timestamp}`)}
            title={`${note.content.substring(0, 30)}... at ${new Date(note.timestamp).toLocaleTimeString()}`}
            onMouseEnter={(e) => {
              (e.target as HTMLDivElement).style.width = '16px';
              (e.target as HTMLDivElement).style.height = '16px';
              (e.target as HTMLDivElement).style.background = '#46c2ff';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLDivElement).style.width = '12px';
              (e.target as HTMLDivElement).style.height = '12px';
              (e.target as HTMLDivElement).style.background = '#58a6ff';
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
        <span>Start</span>
        <span>Sermon Progress</span>
        <span>End</span>
      </div>
    </div>
  );
};

export default TranscriptTimeline;
