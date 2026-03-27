import { renderHook, act } from '@testing-library/react';
import { useLiveState } from '../useLiveState';
import { vi, describe, it, expect } from 'vitest';
import { AudioService } from '../../services/audioService';

// Mock the dependencies
vi.mock('../../services/audioService', () => {
  return {
    AudioService: vi.fn().mockImplementation(function(this: any) {
      this.start = vi.fn().mockResolvedValue(undefined);
      this.stop = vi.fn();
      this.setConfig = vi.fn();
    })
  };
});

vi.mock('../../services/bibleParser', () => ({
  detectBibleVerse: vi.fn().mockReturnValue(null),
  classifyContent: vi.fn().mockReturnValue({ type: 'notes', confidence: 1.0 })
}));

vi.mock('../../services/lyricsService', () => ({
  findSongByWords: vi.fn().mockReturnValue(null),
  locateCurrentLine: vi.fn().mockReturnValue(0)
}));

describe('useLiveState', () => {
  const sessionId = 'test-session';
  const provider = 'web';
  const whisperConfig = { audioInput: 'live' as const };
  const aiConfig = { enabled: false, endpointUrl: '', apiKey: '', modelName: '' };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useLiveState(sessionId, provider, whisperConfig, aiConfig));
    
    expect(result.current.liveState.session_id).toBe(sessionId);
    expect(result.current.liveState.preview_text).toBe('');
    expect(result.current.isListening).toBe(false);
  });

  it('should update interim text when partial transcript is received', () => {
    const { result } = renderHook(() => useLiveState(sessionId, provider, whisperConfig, aiConfig));
    
    // Get the onTranscript callback from the latest mock call
    const lastCall = (AudioService as any).mock.calls.length - 1;
    const onTranscript = (AudioService as any).mock.calls[lastCall][0].onTranscript;
    
    act(() => {
      onTranscript('hello', false, Date.now(), 0.9);
    });
    
    expect(result.current.interimText).toBe('hello');
  });

  it('should update preview_text when final transcript is received', () => {
    const { result } = renderHook(() => useLiveState(sessionId, provider, whisperConfig, aiConfig));
    const lastCall = (AudioService as any).mock.calls.length - 1;
    const onTranscript = (AudioService as any).mock.calls[lastCall][0].onTranscript;
    
    act(() => {
      onTranscript('God is good', true, Date.now(), 1.0);
    });
    
    expect(result.current.liveState.preview_text).toBe('God is good');
    expect(result.current.interimText).toBe('');
  });

  it('should commit preview to live state when calling goLive', () => {
    const { result } = renderHook(() => useLiveState(sessionId, provider, whisperConfig, aiConfig));
    const lastCall = (AudioService as any).mock.calls.length - 1;
    const onTranscript = (AudioService as any).mock.calls[lastCall][0].onTranscript;
    
    act(() => {
      onTranscript('Sermon intro', true, Date.now(), 1.0);
    });
    
    act(() => {
      result.current.goLive();
    });
    
    expect(result.current.liveState.current_text).toBe('Sermon intro');
    expect(result.current.liveState.is_live_dirty).toBe(false);
    expect(result.current.liveState.history).toHaveLength(1);
    expect(result.current.liveState.history[0].type).toBe('note');
  });

  it('should handle starting and stopping transcription', async () => {
    const { result } = renderHook(() => useLiveState(sessionId, provider, whisperConfig, aiConfig));
    
    await act(async () => {
      await result.current.start();
    });
    
    expect(result.current.isListening).toBe(true);
    
    act(() => {
      result.current.stop();
    });
    
    expect(result.current.isListening).toBe(false);
  });
});
