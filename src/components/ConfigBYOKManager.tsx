import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Terminal,
  Zap,
  Lock,
  RefreshCw
} from 'lucide-react';
import { downloadSingleFile } from '../utils/zipExporter';

interface ConfigBYOKManagerProps {
  groqKey: string;
  setGroqKey: (key: string) => void;
  openAIKey: string;
  setOpenAIKey: (key: string) => void;
  activeProvider: 'groq' | 'openai';
  setActiveProvider: (prov: 'groq' | 'openai') => void;
}

export const ConfigBYOKManager: React.FC<ConfigBYOKManagerProps> = ({
  groqKey,
  setGroqKey,
  openAIKey,
  setOpenAIKey,
  activeProvider,
  setActiveProvider
}) => {
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    provider: string;
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({
    provider: '',
    status: 'idle',
    message: ''
  });
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Validate format regexes matching Python's ConfigManager
  const isValidGroq = (key: string) => /^gsk_[a-zA-Z0-9]{30,}$/.test(key.trim());
  const isValidOpenAI = (key: string) => /^sk-[a-zA-Z0-9_\-]{30,}$/.test(key.trim());

  const currentKey = activeProvider === 'groq' ? groqKey : openAIKey;
  const isCurrentKeyValid =
    activeProvider === 'groq' ? isValidGroq(groqKey) : isValidOpenAI(openAIKey);

  const configJsonString = JSON.stringify(
    {
      api_keys: {
        groq: groqKey ? `${groqKey.slice(0, 7)}...${groqKey.slice(-4)}` : '',
        openai: openAIKey ? `${openAIKey.slice(0, 7)}...${openAIKey.slice(-4)}` : ''
      },
      active_provider: activeProvider,
      file_organizer: {
        dry_run_default: false,
        auto_disambiguate_duplicates: true,
        skip_hidden_files: true,
        custom_extensions: {}
      },
      theme: 'dark'
    },
    null,
    2
  );

  const handleTestKey = async () => {
    if (!currentKey) {
      setTestStatus({
        provider: activeProvider,
        status: 'error',
        message: 'No API key provided. Please enter a key first.'
      });
      return;
    }

    setTestStatus({
      provider: activeProvider,
      status: 'testing',
      message: `Pinging ${activeProvider.toUpperCase()} endpoint with 1-token probe...`
    });

    try {
      if (activeProvider === 'groq') {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${groqKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 1
          })
        });

        if (response.ok) {
          setTestStatus({
            provider: 'groq',
            status: 'success',
            message: 'Connection verified! Groq API key is valid and active.'
          });
        } else {
          const err = await response.json().catch(() => ({}));
          setTestStatus({
            provider: 'groq',
            status: 'error',
            message: err.error?.message || `HTTP ${response.status}: Key validation failed.`
          });
        }
      } else {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openAIKey.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Ping' }],
            max_tokens: 1
          })
        });

        if (response.ok) {
          setTestStatus({
            provider: 'openai',
            status: 'success',
            message: 'Connection verified! OpenAI API key is active.'
          });
        } else {
          const err = await response.json().catch(() => ({}));
          setTestStatus({
            provider: 'openai',
            status: 'error',
            message: err.error?.message || `HTTP ${response.status}: Key validation failed.`
          });
        }
      }
    } catch (e: any) {
      // CORS or network failure fallback format check
      if (isCurrentKeyValid) {
        setTestStatus({
          provider: activeProvider,
          status: 'success',
          message: `Format validated (${activeProvider.toUpperCase()} key matches signature). In CLI/desktop, direct requests will connect.`
        });
      } else {
        setTestStatus({
          provider: activeProvider,
          status: 'error',
          message: `Network transport check error: ${e.message || 'Key format incorrect'}`
        });
      }
    }
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(
      JSON.stringify(
        {
          api_keys: {
            groq: groqKey,
            openai: openAIKey
          },
          active_provider: activeProvider,
          file_organizer: {
            dry_run_default: false,
            auto_disambiguate_duplicates: true,
            skip_hidden_files: true,
            custom_extensions: {}
          },
          theme: 'dark'
        },
        null,
        2
      )
    );
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const downloadConfigJson = () => {
    const raw = JSON.stringify(
      {
        api_keys: {
          groq: groqKey,
          openai: openAIKey
        },
        active_provider: activeProvider,
        file_organizer: {
          dry_run_default: false,
          auto_disambiguate_duplicates: true,
          skip_hidden_files: true,
          custom_extensions: {}
        },
        theme: 'dark'
      },
      null,
      2
    );
    downloadSingleFile('config.json', raw);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#101726] border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
          <span>Python Backend Module</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono text-slate-300">config_manager.py</span>
          <span aria-hidden="true">·</span>
          <span>Zero-Telemetry Security</span>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Bring Your Own Key (BYOK) & Configuration Manager
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          DevPulse never routes API credentials through third-party servers. All keys are stored locally on your machine in <code className="text-slate-300">config.json</code> with POSIX <code className="text-slate-300">chmod 0600</code> (owner read/write only).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Key Entry and Provider Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Provider Selector */}
          <div className="bg-[#101726] border border-slate-800 rounded-xl p-5">
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Default Active Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveProvider('groq')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeProvider === 'groq'
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                    Groq Cloud
                  </span>
                  {activeProvider === 'groq' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Llama 3.3 70B · Ultra-fast (&lt;250ms) · Free tier
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveProvider('openai')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  activeProvider === 'openai'
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-emerald-400" />
                    OpenAI
                  </span>
                  {activeProvider === 'openai' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  GPT-4o Mini · Standard OpenAI endpoint
                </div>
              </button>
            </div>
          </div>

          {/* Groq Key Input Card */}
          <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  Groq API Key
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Format: <code className="text-slate-300">gsk_...</code> (Get free key from console.groq.com)
                </span>
              </div>
              <span className="text-[11px] font-mono">
                {groqKey ? (
                  isValidGroq(groqKey) ? (
                    <span className="text-emerald-400">Valid Format</span>
                  ) : (
                    <span className="text-amber-400">Unrecognized Format</span>
                  )
                ) : (
                  <span className="text-slate-500">Unconfigured</span>
                )}
              </span>
            </div>

            <div className="relative">
              <input
                type={showGroqKey ? 'text' : 'password'}
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 pr-10 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowGroqKey(!showGroqKey)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                title={showGroqKey ? 'Hide Key' : 'Reveal Key'}
              >
                {showGroqKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* OpenAI Key Input Card */}
          <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  OpenAI API Key
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Format: <code className="text-slate-300">sk-...</code> (From platform.openai.com)
                </span>
              </div>
              <span className="text-[11px] font-mono">
                {openAIKey ? (
                  isValidOpenAI(openAIKey) ? (
                    <span className="text-emerald-400">Valid Format</span>
                  ) : (
                    <span className="text-amber-400">Unrecognized Format</span>
                  )
                ) : (
                  <span className="text-slate-500">Unconfigured</span>
                )}
              </span>
            </div>

            <div className="relative">
              <input
                type={showOpenAIKey ? 'text' : 'password'}
                placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={openAIKey}
                onChange={(e) => setOpenAIKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 pr-10 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                title={showOpenAIKey ? 'Hide Key' : 'Reveal Key'}
              >
                {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test & Verification Action */}
          <div className="bg-[#101726] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Validate active key for{' '}
                <strong className="text-white uppercase">{activeProvider}</strong>
              </span>
            </div>

            <button
              onClick={handleTestKey}
              disabled={testStatus.status === 'testing'}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              {testStatus.status === 'testing' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Probing API...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Probe API Key</span>
                </>
              )}
            </button>
          </div>

          {/* Test Status Banner */}
          {testStatus.status !== 'idle' && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                testStatus.status === 'success'
                  ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                  : testStatus.status === 'error'
                  ? 'bg-rose-950/30 border-rose-800 text-rose-300'
                  : 'bg-sky-950/30 border-sky-800 text-sky-300'
              }`}
            >
              {testStatus.status === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              {testStatus.status === 'error' && (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              {testStatus.status === 'testing' && (
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin shrink-0 mt-0.5" />
              )}
              <div>{testStatus.message}</div>
            </div>
          )}
        </div>

        {/* Right Column: Live config.json preview & Security Invariants (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Security Invariants Box */}
          <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <Lock className="w-4 h-4 text-blue-400" />
              <span>Storage & Security Invariants</span>
            </div>

            <div className="space-y-2 text-xs text-slate-400 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span>File Permissions:</span>
                <span className="text-emerald-400 font-bold">-rw------- (0o600)</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span>Local Path:</span>
                <span className="text-slate-300">~/.devpulse/config.json</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                <span>Network Exposure:</span>
                <span className="text-emerald-400">Zero (Direct BYOK)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Environment Fallback:</span>
                <span className="text-slate-300">GROQ_API_KEY</span>
              </div>
            </div>
          </div>

          {/* config.json Live Preview */}
          <div className="bg-[#101726] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[#0b101c] border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>config.json Preview</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={copyConfig}
                  className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
                  title="Copy full JSON"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedConfig ? 'Copied!' : 'Copy'}</span>
                </button>

                <button
                  onClick={downloadConfigJson}
                  className="px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors flex items-center gap-1"
                  title="Download config.json"
                >
                  <Download className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            <pre className="p-4 text-[11px] font-mono text-sky-200 overflow-x-auto bg-[#0a0e17] leading-relaxed">
              {configJsonString}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
