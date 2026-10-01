import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OrganizerSandbox } from './components/OrganizerSandbox';
import { ConfigBYOKManager } from './components/ConfigBYOKManager';
import { AIToolsPlayground } from './components/AIToolsPlayground';
import { CodeViewer } from './components/CodeViewer';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { Key, ShieldCheck, Download, Terminal, FolderCheck, Cpu } from 'lucide-react';
import { downloadPythonCodebaseZip } from './utils/zipExporter';

export default function App() {
  const [activeTab, setActiveTab] = useState<'organizer' | 'config' | 'ai' | 'code' | 'architecture'>('organizer');

  // BYOK State with localStorage persistence
  const [groqKey, setGroqKey] = useState<string>(() => {
    return localStorage.getItem('devpulse_groq_key') || '';
  });
  const [openAIKey, setOpenAIKey] = useState<string>(() => {
    return localStorage.getItem('devpulse_openai_key') || '';
  });
  const [activeProvider, setActiveProvider] = useState<'groq' | 'openai'>(() => {
    return (localStorage.getItem('devpulse_active_provider') as 'groq' | 'openai') || 'groq';
  });

  useEffect(() => {
    localStorage.setItem('devpulse_groq_key', groqKey);
  }, [groqKey]);

  useEffect(() => {
    localStorage.setItem('devpulse_openai_key', openAIKey);
  }, [openAIKey]);

  useEffect(() => {
    localStorage.setItem('devpulse_active_provider', activeProvider);
  }, [activeProvider]);

  const hasKeyConfigured = Boolean(
    (activeProvider === 'groq' && groqKey.trim()) ||
    (activeProvider === 'openai' && openAIKey.trim())
  );

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1-row, 3-zone Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasKeyConfigured={hasKeyConfigured}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Navigation Quick Jump Cards / Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setActiveTab('organizer')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeTab === 'organizer'
                ? 'bg-blue-950/30 border-blue-500/80 shadow-sm'
                : 'bg-[#0f1624] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Engine Module</span>
              <FolderCheck className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-sm font-bold text-white">File Organizer</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              Auto-scan & duplicate handling
            </div>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeTab === 'config'
                ? 'bg-blue-950/30 border-blue-500/80 shadow-sm'
                : 'bg-[#0f1624] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Security</span>
              <Key className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>BYOK Config</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasKeyConfigured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              config.json & chmod 0600
            </div>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeTab === 'ai'
                ? 'bg-blue-950/30 border-blue-500/80 shadow-sm'
                : 'bg-[#0f1624] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Lightweight AI</span>
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-sm font-bold text-white">AI Tools</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              Summaries, diffs, names
            </div>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`p-3.5 rounded-xl border text-left transition-all ${
              activeTab === 'code'
                ? 'bg-blue-950/30 border-blue-500/80 shadow-sm'
                : 'bg-[#0f1624] border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>OOP Python</span>
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-white">Source Modules</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              4 .py scripts + requirements
            </div>
          </button>
        </div>

        {/* View Routing */}
        {activeTab === 'organizer' && <OrganizerSandbox />}

        {activeTab === 'config' && (
          <ConfigBYOKManager
            groqKey={groqKey}
            setGroqKey={setGroqKey}
            openAIKey={openAIKey}
            setOpenAIKey={setOpenAIKey}
            activeProvider={activeProvider}
            setActiveProvider={setActiveProvider}
          />
        )}

        {activeTab === 'ai' && (
          <AIToolsPlayground
            groqKey={groqKey}
            openAIKey={openAIKey}
            activeProvider={activeProvider}
          />
        )}

        {activeTab === 'code' && <CodeViewer />}

        {activeTab === 'architecture' && <ArchitectureGuide />}
      </main>

      {/* Clean Unboxed Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070b13] py-6 px-6 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">DevPulse Productivity Backend</span>
            <span aria-hidden="true">·</span>
            <span>Bring Your Own Key (BYOK) Architecture</span>
            <span aria-hidden="true">·</span>
            <span>Apache 2.0</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => downloadPythonCodebaseZip()}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Codebase (.zip)</span>
            </button>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-400">pip install requests</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
