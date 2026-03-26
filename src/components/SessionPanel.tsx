import React from 'react';
import { Session } from '../models/session';

interface SessionPanelProps {
  session: Session;
}

const SessionPanel: React.FC<SessionPanelProps> = ({ session }) => {
  return (
    <div className="panel">
      <header>Session</header>
      <p>
        <strong>ID:</strong> {session.id}
      </p>
      <p>
        <strong>Name:</strong> {session.name}
      </p>
      <p>
        <strong>Status:</strong> {session.status}
      </p>
    </div>
  );
};

export default SessionPanel;
