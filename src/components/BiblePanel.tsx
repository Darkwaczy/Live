import React from 'react';
import { BibleVerse, LiveState } from '../models/liveState';
import { crossReference } from '../services/bibleParser';

interface BiblePanelProps {
  verse?: BibleVerse | null;
  liveState?: LiveState;
}

const BiblePanel: React.FC<BiblePanelProps> = ({ verse, liveState }) => {
  const display = verse || liveState?.current_verse;

  return (
    <div className="panel" aria-label="Bible Verse Detection">
      <header>Bible Verse</header>
      {display ? (
        <div>
          <p>
            {display.book} {display.chapter}:{display.verse_start}
            {display.verse_end && display.verse_end !== display.verse_start ? `-${display.verse_end}` : ''}
          </p>
          <small>Detected automatically from sermon transcript.</small>
          <div style={{ marginTop: 6 }}>
            <strong>Cross references:</strong>
            <ul>
              {crossReference(display).map((ref, idx) => (
                <li key={idx}>
                  {ref.book} {ref.chapter}:{ref.verse_start}
                  {ref.verse_end && ref.verse_end !== ref.verse_start ? `-${ref.verse_end}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p>No verse detected yet.</p>
      )}
    </div>
  );
};

export default BiblePanel;
