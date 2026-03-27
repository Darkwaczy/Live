import { renderHook, act } from '@testing-library/react';
import { useSync } from '../useSync';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SupabaseRealtimeSync } from '../../services/supabaseRealtimeService';

// Mock SupabaseRealtimeSync
vi.mock('../../services/supabaseRealtimeService', () => {
  const MockSync = vi.fn().mockImplementation(function(this: any) {
    this.subscribe = vi.fn();
    this.unsubscribe = vi.fn();
    this.publishLiveState = vi.fn().mockResolvedValue(undefined);
  });
  return { SupabaseRealtimeSync: MockSync };
});

describe('useSync', () => {
  const sessionId = 'test-session';
  const initialState = {
    session_id: sessionId,
    current_text: '',
    updated_at: new Date().toISOString(),
    history: []
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to session on mount', () => {
    renderHook(() => useSync(sessionId, initialState));
    
    const mockSyncInstance = (SupabaseRealtimeSync as any).mock.results[0].value;
    expect(mockSyncInstance.subscribe).toHaveBeenCalledWith(sessionId, expect.any(Function));
  });

  it('should publish state changes', () => {
    const { rerender } = renderHook(
      ({ state }) => useSync(sessionId, state),
      { initialProps: { state: initialState } }
    );
    
    const updatedState = { ...initialState, current_text: 'updated' };
    
    act(() => {
      rerender({ state: updatedState });
    });
    
    const mockSyncInstance = (SupabaseRealtimeSync as any).mock.results[0].value;
    expect(mockSyncInstance.publishLiveState).toHaveBeenCalledWith(updatedState);
  });

  it('should call onRemoteUpdate when receiving remote changes', () => {
    const onRemoteUpdate = vi.fn();
    renderHook(() => useSync(sessionId, initialState, onRemoteUpdate));
    
    const mockSyncInstance = (SupabaseRealtimeSync as any).mock.results[0].value;
    const subscribeCallback = mockSyncInstance.subscribe.mock.calls[0][1];
    
    const remoteState = { ...initialState, current_text: 'remote changes' };
    
    act(() => {
      subscribeCallback(remoteState);
    });
    
    expect(onRemoteUpdate).toHaveBeenCalledWith(remoteState);
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useSync(sessionId, initialState));
    const mockSyncInstance = (SupabaseRealtimeSync as any).mock.results[0].value;
    
    unmount();
    
    expect(mockSyncInstance.unsubscribe).toHaveBeenCalled();
  });
});
