import React from 'react';
import { Download, Terminal } from 'lucide-react';
import { downloadPythonCodebaseZip } from '../utils/zipExporter';

interface NavbarProps {
  activeTab: 'organizer' | 'config' | 'ai' | 'code' | 'architecture';
  setActiveTab: (tab: 'organizer' | 'config' | 'ai' | 'code' | 'architecture') => void;
  hasKeyConfigured: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  hasKeyConfigured
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0d131f]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('organizer');
            }}
            className="text-lg font-bold tracking-tight text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
            DevPulse Desktop
          </a>
        </div>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <button
            onClick={() => setActiveTab('organizer')}
            className={`transition-colors hover:text-white pb-0.5 border-b-2 ${
              activeTab === 'organizer'
                ? 'text-white border-blue-500 font-semibold'
                : 'text-slate-400 border-transparent'
            }`}
          >
            File Organizer
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`transition-colors hover:text-white pb-0.5 border-b-2 flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'text-white border-blue-500 font-semibold'
                : 'text-slate-400 border-transparent'
            }`}
          >
            BYOK Config
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasKeyConfigured ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
              title={hasKeyConfigured ? 'Key Configured' : 'Key Not Set'}
            />
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`transition-colors hover:text-white pb-0.5 border-b-2 ${
              activeTab === 'ai'
                ? 'text-white border-blue-500 font-semibold'
                : 'text-slate-400 border-transparent'
            }`}
          >
            AI Developer Tools
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`transition-colors hover:text-white pb-0.5 border-b-2 ${
              activeTab === 'code'
                ? 'text-white border-blue-500 font-semibold'
                : 'text-slate-400 border-transparent'
            }`}
          >
            Python Codebase
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`transition-colors hover:text-white pb-0.5 border-b-2 ${
              activeTab === 'architecture'
                ? 'text-white border-blue-500 font-semibold'
                : 'text-slate-400 border-transparent'
            }`}
          >
            Desktop Blueprint
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadPythonCodebaseZip()}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow-sm whitespace-nowrap"
            title="Download complete runnable Python backend as .zip"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Python Suite (.zip)</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/90 rounded-lg hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 whitespace-nowrap"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>CLI Docs</span>
          </button>
        </div>
      </div>
    </header>
  );
};
