import React, { useState } from 'react';
import { Mic, Cpu, Monitor, Activity, Volume2, Save, Database, Bell, Download, Trash2, Cloud, Palette, X, Radio, AlertCircle } from 'lucide-react';
import { THEMES } from '../config/themes';

export default function SettingsView({ settings, onUpdate, onSave }: any) {
  const [activeTab, setActiveTab] = useState<'audio' | 'ai' | 'display' | 'data' | 'notifications'>('audio');
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [ndiStatus, setNdiStatus] = useState<{ installed: boolean; loading: boolean }>({ installed: true, loading: false });
  const [nAtlasStatus, setNAtlasStatus] = useState<{
    installed: boolean;
    downloadConfigured: boolean;
    inProgress: boolean;
    progress: number | null;
    error: string | null;
    loading: boolean;
  }>({
    installed: false,
    downloadConfigured: false,
    inProgress: false,
    progress: null,
    error: null,
    loading: false
  });

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (b: boolean) => void }) => (
    <div 
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-600'}`}
    >
      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </div>
  );

  // Check NDI Status when tab changes
  React.useEffect(() => {
    if (activeTab === 'display' && (window as any).sermonSync?.checkNDIRuntime) {
      setNdiStatus(s => ({ ...s, loading: true }));
      (window as any).sermonSync.checkNDIRuntime().then((installed: boolean) => {
        setNdiStatus({ installed, loading: false });
      });
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab !== 'ai' || !window.sermonSync?.getNAtlasStatus) {
      return;
    }

    let cancelled = false;

    const refreshStatus = async (showLoading = false) => {
      if (showLoading) {
        setNAtlasStatus((s) => ({ ...s, loading: true }));
      }

      try {
        const status = await window.sermonSync!.getNAtlasStatus();
        if (!cancelled) {
          setNAtlasStatus({
            ...status,
            loading: false
          });
        }
      } catch (error: any) {
        if (!cancelled) {
          setNAtlasStatus((s) => ({
            ...s,
            loading: false,
            error: error?.message || 'Could not check N-ATLAS status.'
          }));
        }
      }
    };

    refreshStatus(true);
    const interval = window.setInterval(() => refreshStatus(false), 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeTab]);

  const handleInstallNDI = async () => {
    setNdiStatus(s => ({ ...s, loading: true }));
    try {
      await (window as any).sermonSync.installNDIRuntime();
      // After install attempt, check again
      const installed = await (window as any).sermonSync.checkNDIRuntime();
      setNdiStatus({ installed, loading: false });
    } catch (e) {
      setNdiStatus(s => ({ ...s, loading: false }));
    }
  };

  const handleInstallNAtlas = async () => {
    if (!window.sermonSync?.installNAtlas || !window.sermonSync?.getNAtlasStatus) return;

    setNAtlasStatus((s) => ({
      ...s,
      loading: true,
      error: null
    }));

    try {
      const result = await window.sermonSync.installNAtlas();
      const status = await window.sermonSync.getNAtlasStatus();
      setNAtlasStatus({
        ...status,
        loading: false,
        error: result.success ? null : result.error || status.error
      });
    } catch (error: any) {
      setNAtlasStatus((s) => ({
        ...s,
        loading: false,
        error: error?.message || 'Could not install N-ATLAS.'
      }));
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-(--bg-primary) rounded-tl-2xl border-t border-l border-(--border-color) transition-colors">
      {/* Sidebar */}
      <div className="w-72 bg-(--bg-secondary) border-r border-(--border-color) p-6 flex flex-col shrink-0 transition-colors">
        <h2 className="text-xl font-semibold mb-8 text-white px-2">System Settings</h2>
        <nav className="space-y-2 flex-1">
          <button 
            onClick={() => setActiveTab('audio')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'audio' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Mic size={18} /> Audio & Input
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'ai' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Cpu size={18} /> AI & Detection
          </button>
          <button 
            onClick={() => setActiveTab('display')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'display' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Monitor size={18} /> Display & UI
          </button>
          <button 
            onClick={() => setActiveTab('data')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Database size={18} /> Data & Export
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <Bell size={18} /> Notifications
          </button>
        </nav>
        <div className="pt-6 border-t border-white/5">
          <button 
            onClick={() => onSave()}
            className="w-full bg-[#1e1e1e] hover:bg-[#252525] text-emerald-400 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors border border-emerald-500/20">
            <Save size={16} /> Save Preferences
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="flex-1 overflow-y-auto p-10">
        <div className="max-w-3xl mx-auto space-y-12 pb-24">
          
          {activeTab === 'audio' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">Audio & Input Settings</h3>
                <p className="text-gray-400">Configure your primary audio sources and hardware sensitivity.</p>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Microphone Device</label>
                  <select 
                    value={settings.micDevice} onChange={e => onUpdate('micDevice', e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="default">System Default</option>
                    <option value="focusrite">Focusrite USB Audio</option>
                    <option value="rode">RØDE Wireless GO II</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Input Source</label>
                  <div className="flex gap-4 mb-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border cursor-pointer transition-colors ${settings.audioInput === 'live' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-[#1e1e1e] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                      <input type="radio" value="live" checked={settings.audioInput === 'live'} onChange={() => onUpdate('audioInput', 'live')} className="hidden" />
                      <Mic size={18} /> Live Mic (Pastor)
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-xl border cursor-pointer transition-colors ${settings.audioInput === 'system' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-[#1e1e1e] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                      <input type="radio" value="system" checked={settings.audioInput === 'system'} onChange={() => onUpdate('audioInput', 'system')} className="hidden" />
                      <Volume2 size={18} /> System Audio (Mixer)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">AI & Detection Settings</h3>
                <p className="text-gray-400">Control the behavior of the internal speech engines and parsers.</p>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-8">
                {/* Transcription Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium text-lg block mb-1">Live Transcription</span>
                      <span className="text-sm text-gray-400">Enable real-time speech to text processing</span>
                    </div>
                    <Toggle checked={settings.enableTranscription} onChange={(v) => onUpdate('enableTranscription', v)} />
                  </div>
                  
                  <div className={`space-y-6 transition-opacity ${!settings.enableTranscription && 'opacity-50 pointer-events-none'}`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Primary Speech Engine</label>
                      <select value={settings.speechEngine} onChange={e => onUpdate('speechEngine', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50">
                        <option value="n-atlas">🇳🇬 N-ATLAS Nigerian English (Local, Offline) ⭐ RECOMMENDED</option>
                        <option value="web">Chrome Web Speech API (Free, Requires Internet)</option>
                        <option value="worker">Vosk WASM Engine (Free, 100% Offline)</option>
                        <option value="groq">Groq Cloud API (Ultra-Fast Whisper)</option>
                        <option value="deepgram">Deepgram Nova Cloud API</option>
                        <option value="whisper">OpenAI Whisper Cloud (Paid, Best Accuracy)</option>
                      </select>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-[#1e1e1e] p-5 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-white font-medium">N-ATLAS Add-on</h4>
                          <p className="text-sm text-gray-400">
                            Install or retry the Nigerian English offline engine after the main app setup.
                          </p>
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                          nAtlasStatus.installed
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : nAtlasStatus.inProgress
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-white/5 text-gray-400'
                        }`}>
                          {nAtlasStatus.installed ? 'Installed' : nAtlasStatus.inProgress ? 'Downloading' : 'Not Installed'}
                        </span>
                      </div>

                      <div className="text-sm text-gray-300 space-y-1">
                        {nAtlasStatus.downloadConfigured ? (
                          <p>
                            {nAtlasStatus.inProgress && nAtlasStatus.progress !== null
                              ? `Download in progress: ${nAtlasStatus.progress}%`
                              : nAtlasStatus.installed
                                ? 'N-ATLAS is ready for offline Nigerian English transcription.'
                                : 'N-ATLAS is optional. Install it when you want the offline local engine.'}
                          </p>
                        ) : (
                          <p className="text-amber-400">
                            N-ATLAS download is not configured in this build yet.
                          </p>
                        )}
                        {nAtlasStatus.error && (
                          <p className="text-rose-400">{nAtlasStatus.error}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleInstallNAtlas}
                          disabled={
                            nAtlasStatus.loading ||
                            nAtlasStatus.inProgress ||
                            !nAtlasStatus.downloadConfigured
                          }
                          className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:text-white/60 text-black px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                        >
                          {nAtlasStatus.inProgress
                            ? 'Downloading N-ATLAS...'
                            : nAtlasStatus.installed
                              ? 'Reinstall N-ATLAS'
                              : 'Install N-ATLAS'}
                        </button>

                        {nAtlasStatus.loading && !nAtlasStatus.inProgress && (
                          <span className="text-sm text-gray-400">Checking status...</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">Display & UI Settings</h3>
                <p className="text-gray-400">Customize the appearance for operators and projected views.</p>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-8">
                
                {/* Visibility Toggles */}
                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Module Visibility</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">Live Transcript Focus</span>
                      <Toggle checked={settings.showTranscript} onChange={(v) => onUpdate('showTranscript', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">Floating Scripture Popup</span>
                      <Toggle checked={settings.showVerse} onChange={(v) => onUpdate('showVerse', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">Lyrics / Worship Dock</span>
                      <Toggle checked={settings.showLyrics} onChange={(v) => onUpdate('showLyrics', v)} />
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Typography & Scaling */}
                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Typography & Interface Scaling</h4>
                  <div className="space-y-6">
                     <div>
                        <label className="block text-sm text-gray-300 mb-2">Base Text Size (Transcripts)</label>
                        <select value={settings.transcriptSize} onChange={e => onUpdate('transcriptSize', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                          <option value="small">Small (Standard Density)</option>
                          <option value="medium">Medium (Ideal for Tablets)</option>
                          <option value="large">Large (High Legibility)</option>
                        </select>
                     </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* APP THEME */}
                <div>
                  <h4 className="text-(--text-secondary) text-sm font-medium uppercase tracking-wider mb-4">Application Theme</h4>
                  <div className="grid grid-cols-5 gap-3">
                    {[
                      { id: 'obsidian', name: 'Obsidian', color: '#121212', accent: '#10b981' },
                      { id: 'midnight-royal', name: 'Royal', color: '#1a1a2e', accent: '#fbbf24' },
                      { id: 'classic-hymnal', name: 'Hymnal', color: '#fdf6e3', accent: '#b91c1c' },
                      { id: 'deep-sea', name: 'Sea', color: '#0f172a', accent: '#06b6d4' },
                      { id: 'modern-clean', name: 'Clean', color: '#f8fafc', accent: '#3b82f6' }
                    ].map(t => (
                      <button 
                        key={t.id}
                        onClick={() => {
                          onUpdate('theme', t.id);
                        }}
                        className={`flex flex-col gap-2 p-2 rounded-xl border transition-all ${settings.theme === t.id ? 'border-(--accent-color) bg-(--accent-color)/10' : 'border-(--border-color) bg-(--bg-secondary)'}`}
                      >
                        <div className="aspect-square rounded-lg border border-white/10" style={{ backgroundColor: t.color, borderLeft: `4px solid ${t.accent}` }} />
                        <span className={`text-[9px] font-black uppercase text-center ${settings.theme === t.id ? 'text-(--accent-color)' : 'text-(--text-secondary)'}`}>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-(--border-color)" />

                {/* LIVE STREAM OUTPUT */}
                <div>
                  <h4 className="text-(--text-secondary) text-sm font-medium uppercase tracking-wider mb-4">Live Stream Output</h4>
                  <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-8">
                    
                    {!ndiStatus.installed && (
                      <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-6 flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-300">
                        <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500">
                          <AlertCircle size={28} />
                        </div>
                        <div>
                          <h4 className="text-amber-500 font-bold text-lg">Broadcast Drivers Missing</h4>
                          <p className="text-amber-400/80 text-sm max-w-md mx-auto">
                            To use the Live Stream Output (NDI), you need to install the core drivers.
                          </p>
                        </div>
                        <button 
                          onClick={handleInstallNDI}
                          disabled={ndiStatus.loading}
                          className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                        >
                          {ndiStatus.loading ? 'Installing Drivers...' : 'Install Drivers Now'}
                        </button>
                      </div>
                    )}

                    <div className={`flex items-center justify-between transition-opacity ${!ndiStatus.installed && 'opacity-50 pointer-events-none'}`}>
                      <div>
                        <span className="text-white font-medium text-lg block mb-1">Enable Network Output</span>
                        <span className="text-sm text-gray-400">Broadcast as "SermonSync Display" for OBS / vMix</span>
                      </div>
                      <Toggle checked={settings.enableNDI} onChange={(v) => onUpdate('enableNDI', v)} />
                    </div>

                    <div className={`space-y-6 transition-opacity ${!settings.enableNDI && 'opacity-50 pointer-events-none'}`}>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-3">Broadcast Theme</label>
                          <div className="grid grid-cols-2 gap-4">
                            <button 
                              onClick={() => onUpdate('ndiTheme', 'lower-third')}
                              className={`p-4 rounded-xl border text-left transition-all ${settings.ndiTheme === 'lower-third' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                            >
                              <span className={`text-sm font-bold block mb-1 ${settings.ndiTheme === 'lower-third' ? 'text-emerald-400' : 'text-white'}`}>Lower Thirds</span>
                              <span className="text-xs text-gray-500">Perfect for livestreams (vMix/OBS)</span>
                            </button>
                            <button 
                              onClick={() => onUpdate('ndiTheme', 'center')}
                              className={`p-4 rounded-xl border text-left transition-all ${settings.ndiTheme === 'center' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
                            >
                              <span className={`text-sm font-bold block mb-1 ${settings.ndiTheme === 'center' ? 'text-emerald-400' : 'text-white'}`}>Full Screen Center</span>
                              <span className="text-xs text-gray-500">Ideal for auditorium projectors</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Resolution</label>
                            <select value={settings.ndiResolution || '1080p'} onChange={e => onUpdate('ndiResolution', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                              <option value="720p">720p (HD)</option>
                              <option value="1080p">1080p (Full HD)</option>
                              <option value="4k">4K (Ultra HD)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Frame Rate</label>
                            <select value={settings.ndiFps || '30'} onChange={e => onUpdate('ndiFps', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                              <option value="24">24 FPS (Cinematic)</option>
                              <option value="30">30 FPS (Standard)</option>
                              <option value="60">60 FPS (Smooth)</option>
                            </select>
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">Data & Export Settings</h3>
                <p className="text-gray-400">Manage session storage, backups, and output formats.</p>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-8">
                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Export Settings</h4>
                  <div className="flex gap-4">
                     <button className="flex-1 bg-[#1e1e1e] hover:bg-[#252525] text-emerald-400 border border-emerald-500/20 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                       <Download size={16} /> Export Latest Session
                     </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">Notifications & Alerts</h3>
                <p className="text-gray-400">Configure visual toasts and sound alerts for system events.</p>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-8">
                <div className="flex items-center justify-between">
                  <span className="text-gray-200">Bible Verse Detected Chime</span>
                  <Toggle checked={settings.alertVerse} onChange={(v) => onUpdate('alertVerse', v)} />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
