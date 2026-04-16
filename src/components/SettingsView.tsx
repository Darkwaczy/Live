import React, { useState } from 'react';
import { Mic, Cpu, Monitor, Volume2, Save, Database, Bell, Download, X, Radio, AlertCircle, Eye, Key, Sliders, Timer, Cloud, Palette } from 'lucide-react';

export default function SettingsView({ settings, onUpdate, onSave }: any) {
  const [activeTab, setActiveTab] = useState<'audio' | 'ai' | 'display' | 'data' | 'notifications'>('audio');
  const [ndiStatus, setNdiStatus] = useState<{ installed: boolean; loading: boolean }>({ installed: true, loading: false });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
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
      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors shrink-0 ${checked ? 'bg-emerald-500' : 'bg-gray-600'}`}
    >
      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </div>
  );

  const Row = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <span className="text-gray-200 font-medium leading-tight">{label}</span>
        {sub && <span className="text-xs text-gray-500 block">{sub}</span>}
      </div>
      {children}
    </div>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h4 className="text-gray-400 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">{children}</h4>
  );

  const Divider = () => <hr className="border-white/5" />;

  // Check NDI Status
  React.useEffect(() => {
    if (activeTab === 'display' && (window as any).sermonSync?.checkNDIRuntime) {
      setNdiStatus(s => ({ ...s, loading: true }));
      (window as any).sermonSync.checkNDIRuntime().then((installed: boolean) => {
        setNdiStatus({ installed, loading: false });
      });
    }
  }, [activeTab]);

  // Poll N-ATLAS status
  React.useEffect(() => {
    if (activeTab !== 'ai' || !window.sermonSync?.getNAtlasStatus) return;
    let cancelled = false;
    const refresh = async (showLoading = false) => {
      if (showLoading) setNAtlasStatus(s => ({ ...s, loading: true }));
      try {
        const status = await window.sermonSync!.getNAtlasStatus();
        if (!cancelled) setNAtlasStatus({ ...status, loading: false });
      } catch (e: any) {
        if (!cancelled) setNAtlasStatus(s => ({ ...s, loading: false, error: e?.message || 'Could not check N-ATLAS status.' }));
      }
    };
    refresh(true);
    const id = window.setInterval(() => refresh(false), 1500);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [activeTab]);

  const handleInstallNDI = async () => {
    setNdiStatus(s => ({ ...s, loading: true }));
    try {
      await (window as any).sermonSync.installNDIRuntime();
      const installed = await (window as any).sermonSync.checkNDIRuntime();
      setNdiStatus({ installed, loading: false });
    } catch { setNdiStatus(s => ({ ...s, loading: false })); }
  };

  const handleInstallNAtlas = async () => {
    if (!window.sermonSync?.installNAtlas || !window.sermonSync?.getNAtlasStatus) return;
    setNAtlasStatus(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await window.sermonSync.installNAtlas();
      const status = await window.sermonSync.getNAtlasStatus();
      setNAtlasStatus({ ...status, loading: false, error: result.success ? null : result.error || status.error });
    } catch (e: any) {
      setNAtlasStatus(s => ({ ...s, loading: false, error: e?.message || 'Could not install N-ATLAS.' }));
    }
  };

  const navItems = [
    { id: 'audio', icon: <Mic size={18} />, label: 'Audio & Input' },
    { id: 'ai', icon: <Cpu size={18} />, label: 'AI & Detection' },
    { id: 'display', icon: <Monitor size={18} />, label: 'Display & UI' },
    { id: 'data', icon: <Database size={18} />, label: 'Data & Export' },
    { id: 'notifications', icon: <Bell size={18} />, label: 'Notifications' },
  ] as const;

  return (
    <div className="flex-1 flex overflow-hidden bg-(--bg-primary) rounded-tl-2xl border-t border-l border-(--border-color) transition-colors">
      {/* Sidebar */}
      <div className="w-64 bg-(--bg-secondary) border-r border-(--border-color) p-6 flex flex-col shrink-0 transition-colors">
        <h2 className="text-xl font-black mb-8 text-white px-2 tracking-tight">System Settings</h2>
        <nav className="space-y-1 flex-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
        <div className="pt-6 border-t border-white/5">
          <button
            onClick={() => onSave()}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <Save size={16} /> Save Preferences
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-10">
        <div className="max-w-2xl mx-auto space-y-10 pb-24">

          {/* ─── AUDIO & INPUT ─── */}
          {activeTab === 'audio' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Audio & Input</h3>
                <p className="text-gray-400 text-sm">Configure microphone hardware, gain levels, and signal processing.</p>
              </div>

              {/* Hardware */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle><Mic size={14} /> Hardware</SectionTitle>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Microphone Device</label>
                  <select value={settings.micDevice} onChange={e => onUpdate('micDevice', e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 text-sm">
                    <option value="default">System Default</option>
                    <option value="focusrite">Focusrite USB Audio</option>
                    <option value="rode">RØDE Wireless GO II</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Input Source</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center justify-center gap-2 p-4 rounded-xl border cursor-pointer transition-all ${settings.audioInput === 'live' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-[#1e1e1e] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                      <input type="radio" value="live" checked={settings.audioInput === 'live'} onChange={() => onUpdate('audioInput', 'live')} className="hidden" />
                      <Mic size={16} /> <span className="text-sm font-medium">Live Mic</span>
                    </label>
                    <label className={`flex items-center justify-center gap-2 p-4 rounded-xl border cursor-pointer transition-all ${settings.audioInput === 'system' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-[#1e1e1e] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                      <input type="radio" value="system" checked={settings.audioInput === 'system'} onChange={() => onUpdate('audioInput', 'system')} className="hidden" />
                      <Volume2 size={16} /> <span className="text-sm font-medium">System Audio</span>
                    </label>
                  </div>
                </div>

                <Row label="Noise Suppression" sub="Filter background hum and mic rumble">
                  <Toggle checked={settings.noiseSuppression ?? true} onChange={v => onUpdate('noiseSuppression', v)} />
                </Row>
              </div>

              {/* Signal levels */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle><Sliders size={14} /> Signal Levels</SectionTitle>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Input Gain</label>
                    <span className="text-sm font-bold text-emerald-400">{settings.gain ?? 75}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={1} value={settings.gain ?? 75}
                    onChange={e => onUpdate('gain', Number(e.target.value))} className="w-full accent-emerald-500" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>Silent</span><span>Max</span></div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Confidence Threshold</label>
                    <span className="text-sm font-bold text-emerald-400">{settings.accuracyLevel ?? 95}%</span>
                  </div>
                  <input type="range" min={50} max={100} step={1} value={settings.accuracyLevel ?? 95}
                    onChange={e => onUpdate('accuracyLevel', Number(e.target.value))} className="w-full accent-emerald-500" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>50% (Loose)</span><span>100% (Strict)</span></div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Verse Detection Sensitivity</label>
                    <span className="text-sm font-bold text-emerald-400">{settings.verseSensitivity ?? 60}%</span>
                  </div>
                  <input type="range" min={20} max={100} step={1} value={settings.verseSensitivity ?? 60}
                    onChange={e => onUpdate('verseSensitivity', Number(e.target.value))} className="w-full accent-emerald-500" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>Loose</span><span>Balanced</span><span>Strict</span></div>
                </div>
              </div>

              {/* Detection Toggles */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-5">
                <SectionTitle><Radio size={14} /> Live Detection</SectionTitle>
                <Row label="AI Verse Auto-Detection" sub="Intelligently detect Bible verses in speech">
                  <Toggle checked={settings.aiVerseDetection ?? true} onChange={v => onUpdate('aiVerseDetection', v)} />
                </Row>
                <Divider />
                <Row label="Detect Worship Songs" sub="Auto-identify and sync lyrics during worship">
                  <Toggle checked={settings.detectSongs ?? true} onChange={v => onUpdate('detectSongs', v)} />
                </Row>
                <Divider />
                <Row label="Auto-Sync Lyrics" sub="Automatically highlight sung lines">
                  <Toggle checked={settings.autoSyncLyrics ?? true} onChange={v => onUpdate('autoSyncLyrics', v)} />
                </Row>
              </div>
            </div>
          )}

          {/* ─── AI & DETECTION ─── */}
          {activeTab === 'ai' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">AI & Detection</h3>
                <p className="text-gray-400 text-sm">Control speech engines, API credentials, and AI verse detection behaviour.</p>
              </div>

              {/* Transcription Engine */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle><Cpu size={14} /> Speech Engine</SectionTitle>

                <Row label="Live Transcription" sub="Enable real-time speech-to-text processing">
                  <Toggle checked={settings.enableTranscription ?? true} onChange={v => onUpdate('enableTranscription', v)} />
                </Row>

                <div className={`space-y-6 transition-opacity ${!settings.enableTranscription && 'opacity-40 pointer-events-none'}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Primary Speech Engine</label>
                    <select value={settings.speechEngine} onChange={e => onUpdate('speechEngine', e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 text-sm">
                      <option value="n-atlas">🇳🇬 N-ATLAS — Nigerian English (Local, Offline) ⭐</option>
                      <option value="web">Chrome Web Speech API (Free, Requires Internet)</option>
                      <option value="worker">Vosk WASM Engine (Free, 100% Offline)</option>
                      <option value="groq">Groq Cloud API (Ultra-Fast Whisper)</option>
                      <option value="deepgram">Deepgram Nova Cloud API</option>
                      <option value="whisper">OpenAI Whisper Cloud (Best Accuracy)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Language / Model</label>
                    <select value={settings.languageModel} onChange={e => onUpdate('languageModel', e.target.value)}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 text-sm">
                      <option value="whisper-1">whisper-1</option>
                      <option value="nova-2">nova-2</option>
                      <option value="nova-2-general">nova-2-general</option>
                      <option value="enhanced">enhanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <Key size={14} className="text-emerald-400" /> Speech Engine API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={settings.whisperApiKey}
                        onChange={e => onUpdate('whisperApiKey', e.target.value)}
                        placeholder="sk-... or dg_..."
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-emerald-500/50 text-sm font-mono"
                      />
                      <button onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                        <Eye size={16} />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Used for Deepgram, OpenAI Whisper, or Groq engines</p>
                  </div>
                </div>
              </div>

              {/* AI Verse Detector */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle><Radio size={14} /> AI Verse Detector</SectionTitle>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">AI Endpoint URL</label>
                  <input type="text" value={settings.aiEndpoint} onChange={e => onUpdate('aiEndpoint', e.target.value)}
                    placeholder="https://api.groq.com/openai/v1/chat/completions"
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 text-sm font-mono" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">AI Model Name</label>
                  <input type="text" value={settings.aiModel} onChange={e => onUpdate('aiModel', e.target.value)}
                    placeholder="llama-3.3-70b-versatile"
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 text-sm font-mono" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Key size={14} className="text-emerald-400" /> AI API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showAiKey ? 'text' : 'password'}
                      value={settings.aiApiKey}
                      onChange={e => onUpdate('aiApiKey', e.target.value)}
                      placeholder="gsk_... or sk-..."
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-emerald-500/50 text-sm font-mono"
                    />
                    <button onClick={() => setShowAiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <Eye size={16} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Used for AI-powered verse detection (Groq, OpenAI, etc.)</p>
                </div>
              </div>

              {/* Bible Detection */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle>📖 Bible Detection</SectionTitle>

                <Row label="Detect Bible Verses" sub="Automatically detect verse references from speech">
                  <Toggle checked={settings.detectVerses ?? true} onChange={v => onUpdate('detectVerses', v)} />
                </Row>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Primary Bible Version</label>
                  <select value={settings.bibleVersion} onChange={e => onUpdate('bibleVersion', e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 text-sm">
                    <option value="KJV">KJV — King James Version</option>
                    <option value="NIV">NIV — New International Version</option>
                    <option value="NLT">NLT — New Living Translation</option>
                    <option value="TPT">TPT — The Passion Translation</option>
                    <option value="ESV">ESV — English Standard Version</option>
                    <option value="NKJV">NKJV — New King James Version</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Secondary Bible Version <span className="text-gray-500 font-normal">(optional)</span></label>
                  <select value={settings.secondaryBibleVersion || ''} onChange={e => onUpdate('secondaryBibleVersion', e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 text-sm">
                    <option value="">None</option>
                    <option value="KJV">KJV — King James Version</option>
                    <option value="NIV">NIV — New International Version</option>
                    <option value="NLT">NLT — New Living Translation</option>
                    <option value="TPT">TPT — The Passion Translation</option>
                    <option value="ESV">ESV — English Standard Version</option>
                    <option value="NKJV">NKJV — New King James Version</option>
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1">Shows a second translation alongside the primary on the projector</p>
                </div>
              </div>

              {/* Lyrics */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle>🎵 Lyrics Engine</SectionTitle>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Lyrics Source</label>
                  <select value={settings.lyricsSource} onChange={e => onUpdate('lyricsSource', e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 text-sm">
                    <option value="local">Local Library (10,000+ songs, offline)</option>
                    <option value="genius">Genius API (Online)</option>
                    <option value="manual">Manual / Paste Only</option>
                  </select>
                </div>
              </div>

              {/* N-ATLAS */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col">
                    <h4 className="text-white font-bold text-base">N-ATLAS Offline Engine</h4>
                    <p className="text-sm text-gray-400 mt-0.5">Nigerian English offline transcription add-on</p>
                  </div>
                  <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full shrink-0 ${
                    nAtlasStatus.installed ? 'bg-emerald-500/15 text-emerald-400'
                      : nAtlasStatus.inProgress ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-white/5 text-gray-400'
                  }`}>
                    {nAtlasStatus.installed ? 'Installed' : nAtlasStatus.inProgress ? 'Downloading' : 'Not Installed'}
                  </span>
                </div>
                <div className="text-sm text-gray-400">
                  {nAtlasStatus.downloadConfigured
                    ? (nAtlasStatus.inProgress && nAtlasStatus.progress !== null
                        ? `Downloading: ${nAtlasStatus.progress}%`
                        : nAtlasStatus.installed
                          ? 'N-ATLAS is ready for offline Nigerian English transcription.'
                          : 'N-ATLAS is optional. Install when you want the offline local engine.')
                    : <span className="text-amber-400">N-ATLAS download is not configured in this build yet.</span>
                  }
                  {nAtlasStatus.error && <p className="text-rose-400 mt-1">{nAtlasStatus.error}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleInstallNAtlas}
                    disabled={nAtlasStatus.loading || nAtlasStatus.inProgress || !nAtlasStatus.downloadConfigured}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:text-white/60 text-black px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                    {nAtlasStatus.inProgress ? 'Downloading...' : nAtlasStatus.installed ? 'Reinstall N-ATLAS' : 'Install N-ATLAS'}
                  </button>
                  {nAtlasStatus.loading && !nAtlasStatus.inProgress && <span className="text-sm text-gray-400">Checking…</span>}
                </div>
              </div>
            </div>
          )}

          {/* ─── DISPLAY & UI ─── */}
          {activeTab === 'display' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Display & UI</h3>
                <p className="text-gray-400 text-sm">Customize the operator interface and projected output appearance.</p>
              </div>

              {/* Module visibility */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-5">
                <SectionTitle><Eye size={14} /> Module Visibility</SectionTitle>
                <Row label="Live Transcript Panel" sub="Show the speech-to-text transcript view">
                  <Toggle checked={settings.showTranscript ?? true} onChange={v => onUpdate('showTranscript', v)} />
                </Row>
                <Divider />
                <Row label="Floating Scripture Popup" sub="Show detected verse preview card">
                  <Toggle checked={settings.showVerse ?? true} onChange={v => onUpdate('showVerse', v)} />
                </Row>
                <Divider />
                <Row label="Lyrics / Worship Dock" sub="Show the worship lyrics panel">
                  <Toggle checked={settings.showLyrics ?? true} onChange={v => onUpdate('showLyrics', v)} />
                </Row>
              </div>

              {/* Typography */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle>Aa Typography & Scaling</SectionTitle>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Transcript Text Size</label>
                  <select value={settings.transcriptSize} onChange={e => onUpdate('transcriptSize', e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-sm">
                    <option value="small">Small (Standard Density)</option>
                    <option value="medium">Medium (Ideal for Tablets)</option>
                    <option value="large">Large (High Legibility)</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">UI Scale</label>
                    <span className="text-sm font-bold text-emerald-400">{settings.uiScale ?? 100}%</span>
                  </div>
                  <input type="range" min={70} max={130} step={5} value={settings.uiScale ?? 100}
                    onChange={e => onUpdate('uiScale', Number(e.target.value))} className="w-full accent-emerald-500" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>70% (Compact)</span><span>100%</span><span>130% (Large)</span></div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Overlay Transparency</label>
                    <span className="text-sm font-bold text-emerald-400">{settings.transparency ?? 50}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={settings.transparency ?? 50}
                    onChange={e => onUpdate('transparency', Number(e.target.value))} className="w-full accent-emerald-500" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>Opaque</span><span>50%</span><span>Transparent</span></div>
                </div>
              </div>

              {/* Lyric Highlight */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle><Palette size={14} /> Lyric Highlight Style</SectionTitle>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Highlight Colour</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'emerald', label: 'Emerald', color: '#10b981' },
                      { id: 'gold', label: 'Gold', color: '#fbbf24' },
                      { id: 'blue', label: 'Blue', color: '#3b82f6' },
                    ].map(c => (
                      <button key={c.id} onClick={() => onUpdate('highlightColor', c.id)}
                        className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border transition-all ${settings.highlightColor === c.id ? 'border-white/30 bg-white/5' : 'border-white/5 hover:bg-white/5'}`}>
                        <div className="w-6 h-6 rounded-full" style={{ backgroundColor: c.color }}></div>
                        <span className="text-[10px] font-bold uppercase text-gray-400">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Animation Style</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'glow', label: 'Glow' },
                      { id: 'fade', label: 'Pulse' },
                      { id: 'none', label: 'None' },
                    ].map(a => (
                      <button key={a.id} onClick={() => onUpdate('highlightAnimation', a.id)}
                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${settings.highlightAnimation === a.id ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-[#1e1e1e] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
                <SectionTitle>🎨 Application Theme</SectionTitle>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { id: 'obsidian', name: 'Obsidian', color: '#121212', accent: '#10b981' },
                    { id: 'midnight-royal', name: 'Royal', color: '#1a1a2e', accent: '#fbbf24' },
                    { id: 'classic-hymnal', name: 'Hymnal', color: '#fdf6e3', accent: '#b91c1c' },
                    { id: 'deep-sea', name: 'Sea', color: '#0f172a', accent: '#06b6d4' },
                    { id: 'modern-clean', name: 'Clean', color: '#f8fafc', accent: '#3b82f6' },
                  ].map(t => (
                    <button key={t.id} onClick={() => onUpdate('theme', t.id)}
                      className={`flex flex-col gap-2 p-2 rounded-xl border transition-all ${settings.theme === t.id ? 'border-white/40 bg-white/5' : 'border-white/5 hover:bg-white/5'}`}>
                      <div className="aspect-square rounded-lg border border-white/10" style={{ backgroundColor: t.color, borderLeft: `4px solid ${t.accent}` }} />
                      <span className={`text-[9px] font-black uppercase text-center ${settings.theme === t.id ? 'text-white' : 'text-gray-500'}`}>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Projector Branding */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle>🖼 Projector Background & Branding</SectionTitle>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">Projector Background Image</label>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-12 rounded-lg border border-white/10 bg-cover bg-center bg-black shrink-0"
                      style={{ backgroundImage: settings.projectorBg ? `url('${settings.projectorBg}')` : 'none' }} />
                    <label className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1e1e1e] hover:bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer text-gray-400 hover:text-white transition-colors text-sm">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) onUpdate('projectorBg', URL.createObjectURL(f)); }} />
                      Upload Background
                    </label>
                    {settings.projectorBg && (
                      <button onClick={() => onUpdate('projectorBg', '')} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Displayed behind scripture & lyrics on the projector screen</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">Church Logo</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg border border-white/10 bg-black flex items-center justify-center shrink-0 overflow-hidden">
                      {settings.churchLogo
                        ? <img src={settings.churchLogo} alt="logo" className="w-full h-full object-contain" />
                        : <span className="text-gray-600 text-[10px]">None</span>
                      }
                    </div>
                    <label className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1e1e1e] hover:bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer text-gray-400 hover:text-white transition-colors text-sm">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) onUpdate('churchLogo', URL.createObjectURL(f)); }} />
                      Upload Logo
                    </label>
                    {settings.churchLogo && (
                      <button onClick={() => onUpdate('churchLogo', '')} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Shown in the top corner of the projector display</p>
                </div>
              </div>

              {/* Live Stream Output / NDI */}
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle><Radio size={14} /> Live Stream Output (NDI)</SectionTitle>

                {!ndiStatus.installed && (
                  <div className="bg-amber-500/10 border border-amber-500/50 rounded-xl p-5 flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-500">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-amber-500 font-bold">Broadcast Drivers Missing</h4>
                      <p className="text-amber-400/80 text-sm mt-1">Install the NDI drivers to enable OBS / vMix output.</p>
                    </div>
                    <button onClick={handleInstallNDI} disabled={ndiStatus.loading}
                      className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                      {ndiStatus.loading ? 'Installing...' : 'Install Drivers Now'}
                    </button>
                  </div>
                )}

                <div className={`transition-opacity ${!ndiStatus.installed && 'opacity-40 pointer-events-none'}`}>
                  <Row label="Enable Network Output" sub={'Broadcast as "SermonSync Display" for OBS / vMix'}>
                    <Toggle checked={settings.enableNDI ?? false} onChange={v => onUpdate('enableNDI', v)} />
                  </Row>
                </div>

                <div className={`space-y-5 transition-opacity ${(!settings.enableNDI || !ndiStatus.installed) && 'opacity-40 pointer-events-none'}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">Broadcast Layout</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'lower-third', title: 'Lower Thirds', sub: 'Perfect for livestreams (OBS/vMix)' },
                        { id: 'center', title: 'Full Screen Center', sub: 'Ideal for auditorium projectors' },
                      ].map(t => (
                        <button key={t.id} onClick={() => onUpdate('ndiTheme', t.id)}
                          className={`p-4 rounded-xl border text-left transition-all ${settings.ndiTheme === t.id ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                          <span className={`text-sm font-bold block mb-1 ${settings.ndiTheme === t.id ? 'text-emerald-400' : 'text-white'}`}>{t.title}</span>
                          <span className="text-xs text-gray-500">{t.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Resolution</label>
                      <select value={settings.ndiResolution || '1080p'} onChange={e => onUpdate('ndiResolution', e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none text-sm">
                        <option value="720p">720p (HD)</option>
                        <option value="1080p">1080p (Full HD)</option>
                        <option value="4k">4K (Ultra HD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Frame Rate</label>
                      <select value={settings.ndiFps || '30'} onChange={e => onUpdate('ndiFps', e.target.value)}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none text-sm">
                        <option value="24">24 FPS (Cinematic)</option>
                        <option value="30">30 FPS (Standard)</option>
                        <option value="60">60 FPS (Smooth)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── DATA & EXPORT ─── */}
          {activeTab === 'data' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Data & Export</h3>
                <p className="text-gray-400 text-sm">Manage session storage, cloud sync, and export formats.</p>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle><Download size={14} /> Export</SectionTitle>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Export Format</label>
                  <select value={settings.exportFormat} onChange={e => onUpdate('exportFormat', e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white outline-none text-sm">
                    <option value="txt">Plain Text (.txt)</option>
                    <option value="pdf">PDF Document (.pdf)</option>
                    <option value="docx">Word Document (.docx)</option>
                    <option value="json">JSON Data (.json)</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                    <Download size={16} /> Export Latest Session
                  </button>
                </div>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-5">
                <SectionTitle><Cloud size={14} /> Cloud Sync</SectionTitle>
                <Row label="Cloud Backup" sub="Automatically sync sessions to cloud storage">
                  <Toggle checked={settings.cloudSync ?? false} onChange={v => onUpdate('cloudSync', v)} />
                </Row>
              </div>
            </div>
          )}

          {/* ─── NOTIFICATIONS ─── */}
          {activeTab === 'notifications' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Notifications & Automation</h3>
                <p className="text-gray-400 text-sm">Configure alerts, auto-air behaviour, and the service timer.</p>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-5">
                <SectionTitle><Bell size={14} /> Visual Alerts</SectionTitle>
                <Row label="Visual Toast Notifications" sub="Show on-screen toasts for system events">
                  <Toggle checked={settings.alertVisual ?? true} onChange={v => onUpdate('alertVisual', v)} />
                </Row>
                <Divider />
                <Row label="Bible Verse Detected Chime" sub="Play a subtle sound when a verse is detected">
                  <Toggle checked={settings.alertVerse ?? false} onChange={v => onUpdate('alertVerse', v)} />
                </Row>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-5">
                <SectionTitle>⚡ Automation</SectionTitle>
                <Row label="Auto-Air Detected Verses" sub="Automatically push detected verses live (use with caution)">
                  <Toggle checked={settings.autoAirVerses ?? false} onChange={v => onUpdate('autoAirVerses', v)} />
                </Row>
              </div>

              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
                <SectionTitle><Timer size={14} /> Service Timer</SectionTitle>

                <Row label="Auto-Show Timer" sub="Automatically display the countdown timer on start">
                  <Toggle checked={settings.autoShowTimer ?? false} onChange={v => onUpdate('autoShowTimer', v)} />
                </Row>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Default Timer Duration</label>
                    <span className="text-sm font-bold text-emerald-400">{settings.timerDuration ?? 45} min</span>
                  </div>
                  <input type="range" min={5} max={180} step={5} value={settings.timerDuration ?? 45}
                    onChange={e => onUpdate('timerDuration', Number(e.target.value))} className="w-full accent-emerald-500" />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>5 min</span><span>60 min</span><span>3 hrs</span></div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
