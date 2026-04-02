export type Theme = {
  id: string;
  name: string;
  bg: string;
  panel: string;
  text: string;
  secondaryText: string;
  accent: string;
  border: string;
  projectorBg: string; // The URL to the background image
  isDark: boolean;
};

export const THEMES: Record<string, Theme> = {
  'obsidian': {
    id: 'obsidian',
    name: 'Obsidian Emerald',
    bg: '#121212',
    panel: '#161616',
    text: '#ffffff',
    secondaryText: '#94a3b8',
    accent: '#10b981', // emerald-500
    border: 'rgba(255, 255, 255, 0.05)',
    projectorBg: '/worship-bg.png',
    isDark: true
  },
  'midnight-royal': {
    id: 'midnight-royal',
    name: 'Midnight Royal',
    bg: '#1a1a2e',
    panel: '#16213e',
    text: '#ffffff',
    secondaryText: '#94a3b8',
    accent: '#fbbf24', // amber-400 (gold)
    border: 'rgba(251, 191, 36, 0.1)',
    projectorBg: '/worship-bg-royal.png',
    isDark: true
  },
  'classic-hymnal': {
    id: 'classic-hymnal',
    name: 'Classic Hymnal',
    bg: '#fdf6e3',
    panel: '#eee8d5',
    text: '#002b36',
    secondaryText: '#586e75',
    accent: '#b91c1c', // red-700
    border: 'rgba(0, 43, 54, 0.1)',
    projectorBg: '/worship-bg-hymnal.png',
    isDark: false
  },
  'deep-sea': {
    id: 'deep-sea',
    name: 'Deep Sea',
    bg: '#0f172a',
    panel: '#1e293b',
    text: '#ffffff',
    secondaryText: '#94a3b8',
    accent: '#06b6d4', // cyan-500
    border: 'rgba(6, 182, 212, 0.1)',
    projectorBg: '/worship-bg-sea.png',
    isDark: true
  },
  'modern-clean': {
    id: 'modern-clean',
    name: 'Modern Clean',
    bg: '#f8fafc',
    panel: '#ffffff',
    text: '#1e293b',
    secondaryText: '#64748b',
    accent: '#3b82f6', // blue-500
    border: 'rgba(30, 41, 59, 0.05)',
    projectorBg: '/worship-bg-clean.png',
    isDark: false
  }
};
