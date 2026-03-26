import { User } from '../models/user';
import { supabase } from './supabaseClient';

export async function login(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

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
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

