export {}; // module augmentation

declare global {
  interface Window {
    sermonSync?: {
      getAppVersion: () => Promise<string>;
      getNAtlasStatus: () => Promise<{
        installed: boolean;
        downloadConfigured: boolean;
        inProgress: boolean;
        progress: number | null;
        error: string | null;
      }>;
      installNAtlas: () => Promise<{ success: boolean; error?: string }>;
      send: (channel: string, data: any) => void;
      on: (channel: string, callback: (event: any, value: any) => void) => void;
      db?: {
        saveSession: (session: any) => Promise<any>;
        saveLiveState: (liveState: any) => Promise<any>;
        saveNote: (note: any) => Promise<any>;
        getNotes: (sessionId: string) => Promise<any>;
        getLiveState: (sessionId: string) => Promise<any>;
      };
    };
  }
}
