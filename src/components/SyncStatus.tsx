import React from 'react';

interface SyncStatusProps {
  connected: boolean;
}

const SyncStatus: React.FC<SyncStatusProps> = ({ connected }) => (
  <div className="panel" style={{ borderColor: connected ? '#2dd4bf' : '#f87171' }}>
    <header>Realtime Sync</header>
    <p>{connected ? 'Connected to session sync server.' : 'Offline / connecting...'}</p>
  </div>
);

export default SyncStatus;
