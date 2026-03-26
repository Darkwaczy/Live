import { supabase } from './supabaseClient';
import { LiveState } from '../models/liveState';

type LiveStateCallback = (state: LiveState) => void;

export class SupabaseRealtimeSync {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private sessionId: string | null = null;

  async publishLiveState(state: LiveState): Promise<void> {
    const { error } = await supabase.from('live_state').upsert(state).select().single();
    if (error) {
      console.warn('Failed to upsert live_state', error);
    }
  }

  async fetchLiveState(sessionId: string): Promise<LiveState | null> {
    const { data, error } = await supabase
      .from('live_state')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error) {
      console.warn('fetchLiveState failed', error);
      return null;
    }
    return data as LiveState;
  }

  subscribe(sessionId: string, callback: LiveStateCallback): void {
    this.sessionId = sessionId;
    if (this.channel) {
      this.channel.unsubscribe();
    }

    this.channel = supabase
      .channel(`live_state:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_state', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const newState = payload.new as LiveState;
        if (newState) {
          callback(newState);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Supabase realtime subscribed to live_state for session ${sessionId}`);
        }
      });
  }

  unsubscribe(): void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.sessionId = null;
  }
}
