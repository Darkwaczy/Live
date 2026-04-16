import { LiveState } from '../models/liveState';

/**
 * BroadcastService
 * 
 * Manages communication between the React frontend and the local 
 * NDI Broadcast Sidecar (Port 5004).
 */
export class BroadcastService {
  private static endpoint = 'http://localhost:5004';
  
  /**
   * Syncs the current live state to the NDI broadcast.
   */
  static async updateNDI(state: LiveState, active: boolean = true) {
    try {
      let text = '';
      let subtext = '';
      
      // Determine what to show based on priorities
      if (state.current_verse && state.current_verse_text) {
        text = state.current_verse_text;
        subtext = `${state.current_verse.book} ${state.current_verse.chapter}:${state.current_verse.verse_start}`;
      } else if (state.current_lyric_line) {
        text = state.current_lyric_line;
        subtext = state.current_song || "Worship";
      } else if (state.transcription_text && state.transcription_text.length > 0) {
        text = state.transcription_text;
        subtext = "Live Stream";
      }

      const response = await fetch(`${this.endpoint}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          subtext,
          theme: 'lower-third',
          active: active && (text.length > 0)
        })
      });

      if (!response.ok) {
        throw new Error('NDI update failed');
      }
    } catch (error) {
      // In development, we might not have the NDI service running
      console.warn('[BroadcastService] NDI Update Failed:', error);
    }
  }

  /**
   * Checks if the NDI sidecar is reachable
   */
  static async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${this.endpoint}/health`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      return response.ok;
    } catch {
      return false;
    }
  }
}
