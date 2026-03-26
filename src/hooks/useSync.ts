import { useEffect, useRef, useState } from 'react';
import { LiveState } from '../models/liveState';
import { SupabaseRealtimeSync } from '../services/supabaseRealtimeService';

export function useSync(
  sessionId: string,
  state: LiveState,
  onRemoteUpdate?: (state: LiveState) => void
) {
  const [connected, setConnected] = useState(false);
  const syncInstRef = useRef<SupabaseRealtimeSync | null>(null);
  const lastPublished = useRef<string>('');

  useEffect(() => {
    const sync = new SupabaseRealtimeSync();
    syncInstRef.current = sync;

    sync.subscribe(sessionId, (remoteState) => {
      const remoteKey = JSON.stringify(remoteState);
      if (remoteKey !== lastPublished.current) {
        if (onRemoteUpdate) {
          onRemoteUpdate(remoteState);
        }
        lastPublished.current = remoteKey;
      }
    });

    setConnected(true);

    return () => {
      sync.unsubscribe();
      setConnected(false);
    };
  }, [sessionId, onRemoteUpdate]);

  useEffect(() => {
    if (!connected) return;

    const currentKey = JSON.stringify(state);
    if (currentKey === lastPublished.current) return;

    lastPublished.current = currentKey;

    syncInstRef.current?.publishLiveState(state).catch((err) => {
      console.warn('Failed to publish live state', err);
    });
  }, [state, connected]);

  return { connected };
}
