import React, { useState } from 'react';
import { Mic, Cpu, Monitor, Activity, Volume2, Save, Database, Bell, Download, Trash2, Cloud } from 'lucide-react';

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
    <div className="flex-1 flex overflow-hidden bg-[#0d0d0d] rounded-tl-2xl border-t border-l border-white/5">
      {/* Sidebar */}
      <div className="w-72 bg-[#161616] border-r border-white/5 p-6 flex flex-col shrink-0">
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

                <div className="flex items-center justify-between border-t border-white/5 pt-6">
                  <div>
                    <span className="text-white font-medium block">Noise Suppression</span>
                    <span className="text-sm text-gray-400">AI-powered background noise removal</span>
                  </div>
                  <Toggle checked={settings.noiseSuppression} onChange={(val) => onUpdate('noiseSuppression', val)} />
                </div>

                <div className="space-y-4 border-t border-white/5 pt-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-white font-medium">Sensitivity / Gain</span>
                    <span className="text-emerald-400">{settings.gain}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={settings.gain} onChange={e => onUpdate('gain', Number(e.target.value))} className="w-full accent-emerald-500" />
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
                      <select value={settings.speechEngine} onChange={e => onUpdate('speechEngine', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-4 py-3 text-white outline-none">
                        <option value="web">Chrome Web Speech API (Free)</option>
                        <option value="worker">Vosk Engine (Offline)</option>
                        <option value="groq">Groq Cloud API (Fastest)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-lg">Scripture & Parallel View</span>
                    <Toggle checked={settings.detectVerses} onChange={(v) => onUpdate('detectVerses', v)} />
                  </div>
                  
                  <div className={`grid grid-cols-2 gap-6 transition-opacity ${!settings.detectVerses && 'opacity-50 pointer-events-none'}`}>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Primary Translation</label>
                      <select value={settings.bibleVersion} onChange={e => onUpdate('bibleVersion', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                        <option value="KJV">KJV</option>
                        <option value="NIV">NIV</option>
                        <option value="NLT">NLT</option>
                        <option value="TPT">TPT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Parallel Translation (Optional)</label>
                      <select value={settings.secondaryBibleVersion} onChange={e => onUpdate('secondaryBibleVersion', e.target.value)} className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-white outline-none">
                        <option value="">None (Single Bible)</option>
                        <option value="KJV">KJV</option>
                        <option value="NIV">NIV</option>
                        <option value="NLT">NLT</option>
                        <option value="TPT">TPT</option>
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
                </div>

                <hr className="border-white/5" />

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium text-lg">Lyrics Detection</span>
                    <Toggle checked={settings.detectSongs} onChange={(v) => onUpdate('detectSongs', v)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-2xl font-semibold text-white mb-2">Display Settings</h3>
              </div>
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-8">
                 <div className="flex items-center justify-between">
                    <span className="text-gray-200">Show Transcript</span>
                    <Toggle checked={settings.showTranscript} onChange={(v) => onUpdate('showTranscript', v)} />
                 </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
