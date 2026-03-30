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
  const isElectron = typeof window !== 'undefined' && (window as any).sermonSync?.db;

  useEffect(() => {
    // Only subscribe to remote updates if NOT in Electron (prevent loops)
    // Electron is the master source of truth.
    if (isElectron) {
      setConnected(true);
      return;
    }

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
  }, [sessionId, onRemoteUpdate, isElectron]);

  useEffect(() => {
    // Allow publishing in Electron so big screens can "Cast" the state
    if (!connected) return;

    const currentKey = JSON.stringify(state);
    if (currentKey === lastPublished.current) return;

    lastPublished.current = currentKey;

    // Initialize sync instance for Electron if not already there
    if (!syncInstRef.current) {
      syncInstRef.current = new SupabaseRealtimeSync();
    }

    syncInstRef.current?.publishLiveState(state).catch((err) => {
      console.warn('Failed to publish live state', err);
    });
  }, [state, connected, isElectron]);

  return { connected };
}
