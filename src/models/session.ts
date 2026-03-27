export interface Session {
  id: string;
  name: string;
  status: 'live' | 'paused' | 'finished';
  created_at: string;
  updated_at: string;
}
