import React from 'react';
import { LiveState } from '../models/liveState';

interface TranscriptPanelProps {
  liveState: LiveState;
}

const TranscriptPanel: React.FC<TranscriptPanelProps> = ({ liveState }) => {
  return (
    <div className="panel" aria-label="Live Transcript">
      <header>Live Transcript</header>
      <p>{liveState.current_text || 'Listening for sermon...'}</p>
    </div>
  );
};

export default TranscriptPanel;
