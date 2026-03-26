import React from 'react';
import { Song } from '../models/song';

interface LyricsPanelProps {
  song?: Song | null;
  currentLine?: number;
}

const LyricsPanel: React.FC<LyricsPanelProps> = ({ song, currentLine }) => {
  if (!song) {
    return (
      <div className="panel">
        <header>Live Lyrics</header>
        <p>Detecting worship songs from transcript...</p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ overflowY: 'scroll', maxHeight: '100%' }}>
      <header>
        Live Lyrics <em>{song.title}</em>
      </header>
      <div>
        {song.lyrics.map((line) => (
          <p
            key={line.order}
            style={{
              margin: '4px 0',
              color: line.order === currentLine ? '#58a6ff' : 'var(--text)',
              fontWeight: line.order === currentLine ? '700' : '400'
            }}
          >
            {line.line}
          </p>
        ))}
      </div>
    </div>
  );
};

export default LyricsPanel;
