export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'speaker' | 'viewer';
  token?: string;
  authenticated: boolean;
}
