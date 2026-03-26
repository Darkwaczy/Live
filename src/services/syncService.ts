import { io, Socket } from 'socket.io-client';
import { LiveState } from '../models/liveState';

interface SyncHandlers {
  onLiveState: (state: LiveState) => void;
  onReconnected: () => void;
}

export class RealtimeSync {
  private socket?: Socket;
  private room?: string;
  private handlers: SyncHandlers;
  private serverUrl: string;

  constructor(serverUrl: string, handlers: SyncHandlers) {
    this.serverUrl = serverUrl;
    this.handlers = handlers;
  }

  connect(sessionId: string) {
    this.room = sessionId;
    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    this.socket.on('connect', () => {
      if (this.room) this.socket?.emit('joinRoom', this.room);
      this.handlers.onReconnected();
    });

    this.socket.on('liveStateUpdated', (state: LiveState) => {
      this.handlers.onLiveState(state);
    });

    this.socket.on('disconnect', () => {
      console.warn('RealtimeSync disconnected, attempting to reconnect.');
    });
  }

  updateLiveState(state: LiveState) {
    if (!this.socket || !this.socket.connected || !this.room) return;
    this.socket.emit('updateState', { room: this.room, state });
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

// Alternative: use Supabase Realtime by table channel subscription.
