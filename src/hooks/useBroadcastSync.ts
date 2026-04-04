import { useEffect, useRef, useCallback } from 'react';
import { LiveState } from '../models/liveState';

const CHANNEL_NAME = 'church-assistant-live-v1';

/**
 * Zero-config, zero-internet BroadcastChannel sync.
 * Operator window → publishes state.
 * Projector window → receives state.
 * Works across two browser windows on the same machine, same origin.
 */
export function useBroadcastSync(
  state: LiveState,
  onRemoteUpdate: (state: LiveState) => void,
  isProjectorMode: boolean
) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastPublished = useRef<string>('');
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  onRemoteUpdateRef.current = onRemoteUpdate;

  // Open channel once
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      if (event.data?.type === 'LIVE_STATE') {
        onRemoteUpdateRef.current(event.data.state as LiveState);
      }
      // Projector pinging for latest state
      if (event.data?.type === 'REQUEST_STATE' && !isProjectorMode) {
        channel.postMessage({ type: 'LIVE_STATE', state: JSON.parse(lastPublished.current || '{}') });
      }
    };

    // If projector, ask operator for current state immediately
    if (isProjectorMode) {
      channel.postMessage({ type: 'REQUEST_STATE' });
      
      // Fallback: Check localStorage for any existing state on load
      const saved = localStorage.getItem('ca_live_sync_v1');
      if (saved) {
        try {
          onRemoteUpdateRef.current(JSON.parse(saved));
        } catch {}
      }

      // Listen for localStorage changes (backup for Electron windows)
      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'ca_live_sync_v1' && e.newValue) {
          try {
            onRemoteUpdateRef.current(JSON.parse(e.newValue));
          } catch {}
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => {
        channel.close();
        window.removeEventListener('storage', handleStorage);
        channelRef.current = null;
      };
    }

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [isProjectorMode]);

  // Operator: publish every time state changes
  useEffect(() => {
    if (isProjectorMode) return; // Projector only listens, never publishes
    const currentKey = JSON.stringify(state);
    if (currentKey === lastPublished.current) return;
    lastPublished.current = currentKey;
    
    // Primary sync: Channel
    channelRef.current?.postMessage({ type: 'LIVE_STATE', state });
    
    // Backup sync: LocalStorage (extremely reliable for same-machine windows)
    localStorage.setItem('ca_live_sync_v1', currentKey);
  }, [state, isProjectorMode]);
}
