import { User } from '../models/user';
import { supabase } from './supabaseClient';

const isElectron = typeof window !== 'undefined' && (window as any).sermonSync?.db;

export async function login(email: string, password: string): Promise<User> {
  if (isElectron) {
    return {
      id: 'local-admin',
      name: 'Local Admin',
      email: 'admin@sermonsync.local',
      role: 'admin',
      authenticated: true
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  // ... rest of login ...
  if (error || !data.user) {
    throw new Error(error?.message || 'Login failed');
  }

  const profileRes = await supabase
    .from('profiles')
    .select('id,name,role')
    .eq('id', data.user.id)
    .single();

  const profile = profileRes.data;

  return {
    id: data.user.id,
    name: profile?.name ?? data.user.email ?? 'Unknown',
    email: data.user.email ?? email,
    role: (profile?.role as 'admin' | 'speaker' | 'viewer') ?? 'viewer',
    authenticated: true,
    token: data.session?.access_token
  };
}

export async function getCurrentUser(): Promise<User | null> {
  if (isElectron) {
    return {
      id: 'local-admin',
      name: 'Local Admin',
      email: 'admin@sermonsync.local',
      role: 'admin',
      authenticated: true
    };
  }

  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const profileRes = await supabase
      .from('profiles')
      .select('id,name,role')
      .eq('id', user.id)
      .single();

    const profile = profileRes.data;

    return {
      id: user.id,
      name: profile?.name ?? user.email ?? 'User',
      email: user.email ?? 'unknown',
      role: (profile?.role as 'admin' | 'speaker' | 'viewer') ?? 'viewer',
      authenticated: true,
      token: user?.id ?? undefined
    };
  } catch (e) {
    console.warn('getCurrentUser failed', e);
    return null;
  }
}

export async function logout(): Promise<void> {
  if (isElectron) return;
  await supabase.auth.signOut();
}

