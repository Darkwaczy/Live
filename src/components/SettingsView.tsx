import React, { useState } from 'react';
import { Mic, Cpu, Monitor, Activity, Volume2, Save, Database, Bell, Download, Trash2, Cloud, Palette, X } from 'lucide-react';
import { THEMES } from '../config/themes';

export default function SettingsView({ settings, onUpdate, onSave }: any) {
  const [activeTab, setActiveTab] = useState<'audio' | 'ai' | 'display' | 'data' | 'notifications'>('audio');
  const [isTestingAudio, setIsTestingAudio] = useState(false);

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (b: boolean) => void }) => (
    <div 
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-600'}`}
    >
      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </div>
  );

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
                  <div className="text-xs text-gray-500 bg-[#1e1e1e] rounded-lg p-3 border border-white/5">
                    {settings.audioInput === 'system' ? (
                      <span><strong>System Audio Setup:</strong> Select this to capture YouTube/Mixer audio. Requires a <strong>Cloud Provider</strong> (Groq, Deepgram, or OpenAI Whisper) with a valid API key. When you start listening, you'll be prompted to select a browser tab and enable audio sharing.</span>
                    ) : (
                      <span><strong>Live Mic:</strong> Captures audio from a connected microphone. Works with any speech engine.</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-6">
                   <div className="space-y-4 w-full">
                      <div className="flex justify-between text-sm">
                        <span className="text-white font-medium">Input Sensitivity / Gain</span>
                        <span className="text-emerald-400">{settings.gain}%</span>
                      </div>
                      <input type="range" min="0" max="100" value={settings.gain} onChange={e => onUpdate('gain', Number(e.target.value))} className="w-full accent-emerald-500" />
                   </div>
                </div>

                <div className="border-t border-white/5 pt-6 flex justify-end">
                  <button 
                    onClick={() => setIsTestingAudio(!isTestingAudio)}
                    className="flex items-center gap-2 bg-[#1e1e1e] hover:bg-[#252525] border border-white/10 px-5 py-2.5 rounded-lg text-white font-medium transition-colors">
                    <Activity size={18} className={isTestingAudio ? "text-emerald-500 animate-pulse" : "text-gray-400"} />
                    {isTestingAudio ? 'Testing Audio...' : 'Test Audio'}
                  </button>
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
                        <option value="web">Chrome Web Speech API (Free, Requires Internet)</option>
                        <option value="worker">Vosk WASM Engine (Free, 100% Offline)</option>
                        <option value="groq">Groq Cloud API (Ultra-Fast Whisper) ⭐ System Audio</option>
                        <option value="deepgram">Deepgram Nova Cloud API ⭐ System Audio</option>
                        <option value="whisper">OpenAI Whisper Cloud (Paid, Best Accuracy) ⭐ System Audio</option>
                      </select>
                      {(settings.audioInput === 'system' && !['groq', 'deepgram', 'whisper'].includes(settings.speechEngine)) && (
                        <p className="text-xs text-yellow-500/80 mt-2 flex items-center gap-1">⚠️ Web Speech API with System Audio: Switch to a starred provider to capture YouTube/mixer audio.</p>
                      )}
                    </div>

                    {['whisper', 'groq', 'deepgram'].includes(settings.speechEngine) && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          {settings.speechEngine === 'groq' ? 'Groq API Key' : settings.speechEngine === 'deepgram' ? 'Deepgram Token' : 'OpenAI API Key'}
                        </label>
                        <input 
                          type="password" 
                          value={settings.whisperApiKey} 
                          onChange={e => onUpdate('whisperApiKey', e.target.value)} 
                          placeholder={settings.speechEngine === 'groq' ? 'gsk_...' : settings.speechEngine === 'deepgram' ? 'Token...' : 'sk-proj-...'} 
                          className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                        />
                        <p className="text-xs text-emerald-400/80 mt-2 mt-flex items-center gap-1">Key is stored securely in local browser storage only.</p>
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Bible Verse Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-lg">Scripture & Parallel View</span>
                    <Toggle checked={settings.detectVerses} onChange={(v) => onUpdate('detectVerses', v)} />
                  </div>
                  
                  <div className={`grid grid-cols-2 gap-6 transition-opacity ${!settings.detectVerses && 'opacity-50 pointer-events-none'}`}>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Detection Sensitivity</label>
                      <input type="range" min="0" max="100" value={settings.verseSensitivity} onChange={e => onUpdate('verseSensitivity', Number(e.target.value))} className="w-full accent-emerald-500 mt-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Primary Translation</label>
                      <select value={settings.bibleVersion} onChange={e => onUpdate('bibleVersion', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                        <option value="KJV">KJV</option>
                        <option value="NIV">NIV</option>
                        <option value="NLT">NLT</option>
                        <option value="TPT">TPT</option>
                        <option value="ESV">ESV</option>
                        <option value="NKJV">NKJV</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm text-gray-400 mb-2">Parallel Translation (Optional)</label>
                      <select value={settings.secondaryBibleVersion} onChange={e => onUpdate('secondaryBibleVersion', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                        <option value="">None (Single Bible)</option>
                        <option value="KJV">KJV</option>
                        <option value="NIV">NIV</option>
                        <option value="NLT">NLT</option>
                        <option value="TPT">TPT</option>
                        <option value="ESV">ESV</option>
                        <option value="NKJV">NKJV</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-6">
                    <div>
                      <span className="text-sm font-medium text-gray-200 block">Auto-Air Verses</span>
                      <span className="text-xs text-emerald-400">Push to Live immediately on detection</span>
                    </div>
                    <Toggle checked={settings.autoAirVerses} onChange={(v) => onUpdate('autoAirVerses', v)} />
                  </div>

                  <div className="border-t border-white/5 pt-6 space-y-4">
                    <h4 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                       <Activity size={14} className="text-emerald-400" /> Service Timing
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                          <label className="block text-xs text-gray-500 mb-2">Timer Duration (Minutes)</label>
                          <input type="number" value={settings.timerDuration || 45} onChange={e => onUpdate('timerDuration', Number(e.target.value))} className="w-full bg-transparent text-xl font-bold text-white outline-none" />
                       </div>
                       <div className="flex flex-col justify-center">
                          <span className="text-xs text-gray-400 mb-2">Auto-show Timer</span>
                          <Toggle checked={settings.autoShowTimer} onChange={(v) => onUpdate('autoShowTimer', v)} />
                       </div>
                    </div>
                  </div>

                  <div className={`space-y-4 pt-4 border-t border-white/5 transition-opacity ${!settings.detectVerses && 'opacity-50 pointer-events-none'}`}>
                     <div className="flex items-center justify-between">
                       <div>
                         <span className="text-sm font-medium text-gray-200 block">Use AI Inference for References</span>
                         <span className="text-xs text-emerald-400">Contextual story detection via LLMs</span>
                       </div>
                       <Toggle checked={settings.aiVerseDetection} onChange={(v) => onUpdate('aiVerseDetection', v)} />
                     </div>
                     {settings.aiVerseDetection && (
                       <div className="p-4 bg-black/20 rounded-xl space-y-4 border border-white/10 animate-in fade-in">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Ollama / LLM API Endpoint</label>
                            <input value={settings.aiEndpoint} onChange={e => onUpdate('aiEndpoint', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">LLM Model Name</label>
                              <input value={settings.aiModel} onChange={e => onUpdate('aiModel', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Authorization Token / API Key</label>
                              <input type="password" value={settings.aiApiKey} onChange={e => onUpdate('aiApiKey', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50" />
                            </div>
                          </div>
                       </div>
                     )}
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Lyrics Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium text-lg block mb-1">Choir / Lyrics Detection</span>
                    </div>
                    <Toggle checked={settings.detectSongs} onChange={(v) => onUpdate('detectSongs', v)} />
                  </div>
                  
                  <div className={`space-y-4 transition-opacity ${!settings.detectSongs && 'opacity-50 pointer-events-none'}`}>
                    <div className="flex items-center justify-between">
                       <span className="text-sm text-gray-300">Auto-sync lyrics to speaker</span>
                       <Toggle checked={settings.autoSyncLyrics} onChange={(v) => onUpdate('autoSyncLyrics', v)} />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Lyrics Source</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-gray-300"><input type="radio" value="local" checked={settings.lyricsSource === 'local'} onChange={() => onUpdate('lyricsSource', 'local')} className="accent-emerald-500" /> Local Database</label>
                        <label className="flex items-center gap-2 text-gray-300"><input type="radio" value="api" checked={settings.lyricsSource === 'api'} onChange={() => onUpdate('lyricsSource', 'api')} className="accent-emerald-500" /> Online API</label>
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

                {/* Typography */}
                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Typography Scaling</h4>
                  <div className="space-y-4">
                     <div>
                        <label className="block text-sm text-gray-300 mb-2">Base Text Size</label>
                        <select value={settings.transcriptSize} onChange={e => onUpdate('transcriptSize', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white">
                          <option value="small">Small (Standard Density)</option>
                          <option value="medium">Medium (Ideal for Tablets)</option>
                          <option value="large">Large (High Legibility)</option>
                        </select>
                     </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Aesthetics */}
                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Highlight Aesthetics</h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Accent Color</label>
                      <select value={settings.highlightColor} onChange={e => onUpdate('highlightColor', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                        <option value="emerald">Emerald Green</option>
                        <option value="gold">Soft Gold</option>
                        <option value="blue">Electric Blue</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Animation Style</label>
                      <select value={settings.highlightAnimation} onChange={e => onUpdate('highlightAnimation', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                        <option value="glow">Subtle Glow</option>
                        <option value="fade">Quick Fade</option>
                        <option value="slide">Typing Slide</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6 space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">UI Glass Transparency / Blur Level</span>
                      <span className="text-emerald-400">{settings.transparency}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={settings.transparency} onChange={e => onUpdate('transparency', Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" />
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* PROJECTOR BACKGROUND SELECTOR */}
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
                          const matchingTheme = THEMES[t.id];
                          if (matchingTheme) {
                            onUpdate('projectorBg', matchingTheme.projectorBg);
                          }
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

                {/* PROJECTOR BACKGROUND SELECTOR */}
                <div>
                  <h4 className="text-(--text-secondary) text-sm font-medium uppercase tracking-wider mb-4">Projector Background</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <button 
                      onClick={() => onUpdate('projectorBg', '/worship-bg.png')}
                      className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${settings.projectorBg === '/worship-bg.png' ? 'bg-(--accent-color)/10 border-(--accent-color)' : 'bg-(--bg-secondary) border-(--border-color) hover:border-white/20'}`}
                    >
                      <div className="aspect-video bg-[url('/worship-bg.png')] bg-cover bg-center rounded-lg border border-white/10" />
                      <span className={`text-[10px] font-black uppercase text-center ${settings.projectorBg === '/worship-bg.png' ? 'text-(--accent-color)' : 'text-(--text-secondary)'}`}>Obsidian Emerald</span>
                    </button>
                    <button 
                      onClick={() => onUpdate('projectorBg', '/worship-bg-blue.png')}
                      className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${settings.projectorBg === '/worship-bg-blue.png' ? 'bg-(--accent-color)/10 border-(--accent-color)' : 'bg-(--bg-secondary) border-(--border-color) hover:border-white/20'}`}
                    >
                      <div className="aspect-video bg-[url('/worship-bg-blue.png')] bg-cover bg-center rounded-lg border border-white/10" />
                      <span className={`text-[10px] font-black uppercase text-center ${settings.projectorBg === '/worship-bg-blue.png' ? 'text-(--accent-color)' : 'text-(--text-secondary)'}`}>Sapphire Night</span>
                    </button>
                    <button 
                      onClick={() => onUpdate('projectorBg', '/worship-bg-amber.png')}
                      className={`flex flex-col gap-2 p-3 rounded-xl border transition-all ${settings.projectorBg === '/worship-bg-amber.png' ? 'bg-(--accent-color)/10 border-(--accent-color)' : 'bg-(--bg-secondary) border-(--border-color) hover:border-white/20'}`}
                    >
                      <div className="aspect-video bg-[url('/worship-bg-amber.png')] bg-cover bg-center rounded-lg border border-white/10" />
                      <span className={`text-[10px] font-black uppercase text-center ${settings.projectorBg === '/worship-bg-amber.png' ? 'text-(--accent-color)' : 'text-(--text-secondary)'}`}>Sunrise Amber</span>
                    </button>
                  </div>
                </div>

                <hr className="border-(--border-color)" />

                {/* LOGO & BRANDING */}
                <div>
                  <h4 className="text-(--text-secondary) text-sm font-medium uppercase tracking-wider mb-4">Logo & Branding (Theme Mode)</h4>
                  <div className="bg-black/20 p-6 rounded-2xl border border-dashed border-white/10 flex flex-col items-center gap-6">
                    {settings.churchLogo ? (
                      <div className="relative group">
                        <img 
                          src={settings.churchLogo} 
                          alt="Logo Preview" 
                          className="max-h-40 max-w-full object-contain rounded-lg shadow-2xl transition-transform group-hover:scale-105"
                          onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/300?text=Upload+Logo')}
                        />
                        <button 
                           onClick={() => onUpdate('churchLogo', '')}
                           className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-40 h-40 bg-white/5 rounded-2xl flex flex-col items-center justify-center border border-white/5 gap-3">
                         <Palette size={48} className="text-gray-700" />
                         <span className="text-[10px] uppercase font-black tracking-widest text-gray-600">No Logo Set</span>
                      </div>
                    )}
                    
                    <div className="flex flex-col items-center gap-2">
                       <label className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer transition-all shadow-[0_4px_15px_rgba(16,185,129,0.3)] active:scale-95">
                          Change Logo / Flyer
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  onUpdate('churchLogo', event.target?.result);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                       </label>
                       <p className="text-[9px] text-gray-500 uppercase tracking-widest">Recommended: Transparent PNG or Hi-Res Flyer</p>
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
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Local Storage & History</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">Auto-save sessions</span>
                      <Toggle checked={settings.autoSave} onChange={(v) => onUpdate('autoSave', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">Save transcript history</span>
                      <Toggle checked={settings.saveHistory} onChange={(v) => onUpdate('saveHistory', v)} />
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Cloud & Sync</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between opacity-80 cursor-not-allowed">
                       <div className="flex flex-col">
                          <span className="text-gray-200 flex items-center gap-2">Cloud Sync <span className="bg-emerald-500 text-[10px] text-white px-2 py-0.5 rounded-full uppercase font-bold">Soon</span></span>
                          <span className="text-gray-400 text-sm">Supabase synchronization architecture integration</span>
                       </div>
                       <Toggle checked={settings.cloudSync} onChange={(v) => onUpdate('cloudSync', v)} />
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Export Settings</h4>
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm text-gray-300 mb-2">Default Export Format</label>
                      <select value={settings.exportFormat} onChange={e => onUpdate('exportFormat', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white">
                        <option value="txt">Plain Text (.txt)</option>
                        <option value="pdf">PDF Document (.pdf)</option>
                        <option value="docx">Word (.docx)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4">
                     <button className="flex-1 bg-[#1e1e1e] hover:bg-[#252525] text-emerald-400 border border-emerald-500/20 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                       <Download size={16} /> Export Latest Session
                     </button>
                     <button className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                       <Trash2 size={16} /> Clear App Cache
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
                
                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Event Trigger Alerts</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">Bible Verse Detected</span>
                      <Toggle checked={settings.alertVerse} onChange={(v) => onUpdate('alertVerse', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">Worship Song Detected</span>
                      <Toggle checked={settings.alertSong} onChange={(v) => onUpdate('alertSong', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-200">Sync Connected Users</span>
                      <Toggle checked={settings.alertSync} onChange={(v) => onUpdate('alertSync', v)} />
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                <div>
                  <h4 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Alert Delivery Methods</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-gray-200 flex items-center gap-2">Play Sound Alerts</span>
                        <span className="text-gray-400 text-sm">Chime on successful detection events</span>
                      </div>
                      <Toggle checked={settings.alertSound} onChange={(v) => onUpdate('alertSound', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-gray-200 flex items-center gap-2">Show Visual Toasts</span>
                        <span className="text-gray-400 text-sm">Slide-down animations at top of screen</span>
                      </div>
                      <Toggle checked={settings.alertVisual} onChange={(v) => onUpdate('alertVisual', v)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
