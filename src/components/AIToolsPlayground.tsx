import React, { useState } from 'react';
import {
  Sparkles,
  FileCode,
  GitCommit,
  FileText,
  Terminal,
  Play,
  Copy,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Zap,
  Info
} from 'lucide-react';

interface AIToolsPlaygroundProps {
  groqKey: string;
  openAIKey: string;
  activeProvider: 'groq' | 'openai';
}

const PRESET_CODE_SNIPPETS = {
  python: `def calculate_fibonacci_memo(n: int, memo: dict = None) -> int:
    """Calculates n-th Fibonacci number using top-down dynamic programming."""
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = calculate_fibonacci_memo(n - 1, memo) + calculate_fibonacci_memo(n - 2, memo)
    return memo[n]`,
  rust: `pub fn binary_search<T: Ord>(slice: &[T], target: &T) -> Option<usize> {
    let mut low = 0;
    let mut high = slice.len();
    while low < high {
        let mid = low + (high - low) / 2;
        match slice[mid].cmp(target) {
            std::cmp::Ordering::Less => low = mid + 1,
            std::cmp::Ordering::Greater => high = mid,
            std::cmp::Ordering::Equal => return Some(mid),
        }
    }
    None
}`,
  typescript: `async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return retryWithBackoff(fn, retries - 1, delayMs * 2);
  }
}`
};

const PRESET_DIFFS = {
  feature: `diff --git a/python_backend/file_organizer.py b/python_backend/file_organizer.py
index 4b825dc..a71f01c 100644
--- a/python_backend/file_organizer.py
+++ b/python_backend/file_organizer.py
@@ -102,6 +102,12 @@ class FileOrganizer:
+    def _resolve_unique_destination(self, target_folder: Path, file_name: str) -> Tuple[Path, bool]:
+        """Handles duplicate name collisions by appending sequential numbering."""
+        candidate = target_folder / file_name
+        if not candidate.exists():
+            return candidate, False
+        # Auto disambiguate: report (1).pdf`,
  bugfix: `diff --git a/python_backend/config_manager.py b/python_backend/config_manager.py
--- a/python_backend/config_manager.py
+++ b/python_backend/config_manager.py
@@ -45,3 +45,5 @@ class ConfigManager:
-        os.chmod(self.config_file, 0o777)
+        # Restrict permissions to owner read/write only (POSIX 0o600)
+        if os.name != 'nt':
+            os.chmod(self.config_file, 0o600)`
};

export const AIToolsPlayground: React.FC<AIToolsPlaygroundProps> = ({
  groqKey,
  openAIKey,
  activeProvider
}) => {
  const [activeTool, setActiveTool] = useState<'summarize' | 'commit' | 'rename' | 'prompt'>('summarize');

  // Tool states
  const [codeSnippet, setCodeSnippet] = useState(PRESET_CODE_SNIPPETS.python);
  const [codeLanguage, setCodeLanguage] = useState('python');

  const [gitDiff, setGitDiff] = useState(PRESET_DIFFS.feature);

  const [rawFilename, setRawFilename] = useState('Screenshot 2026-03-29 at 11.23.41 PM.png');
  const [fileContext, setFileContext] = useState('Screenshot of user authentication dashboard showing active sessions and security tokens.');

  const [customPrompt, setCustomPrompt] = useState('Explain how Python handles circular imports and how to avoid them.');

  // Output states
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const activeKey = activeProvider === 'groq' ? groqKey : openAIKey;

  const runAITask = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setOutput('');
    const startTime = performance.now();

    // Check if user has provided a key or if we run demo simulation
    if (!activeKey || !activeKey.trim()) {
      setIsDemoMode(true);
      // Simulate realistic AI generation with built-in mock response
      setTimeout(() => {
        let simulated = '';
        if (activeTool === 'summarize') {
          simulated = `### Code Analysis & Architecture Review

**1. Executive Function**
Calculates the n-th Fibonacci number utilizing top-down dynamic programming with hash-map memoization to cache subproblem solutions.

**2. Key Logic Breakdown**
• Initializes an optional dictionary parameter \`memo\` to store previously evaluated outputs.
• Base cases handle \`n <= 1\` returning \`n\` directly.
• Recursive calls calculate \`fib(n-1) + fib(n-2)\` only once per integer argument and record into \`memo[n]\`.

**3. Complexity & Performance**
• **Time Complexity**: $\\mathcal{O}(n)$ — eliminates the exponential $\\mathcal{O}(2^n)$ branching tree.
• **Space Complexity**: $\\mathcal{O}(n)$ — auxiliary dictionary memory plus call stack depth.

**4. Potential Edge Cases**
• Large values of \`n\` (> 1000) will raise \`RecursionError: maximum recursion depth exceeded\` in Python. Consider converting to bottom-up tabular loop for large scales.`;
        } else if (activeTool === 'commit') {
          simulated = `feat(organizer): implement duplicate file disambiguation

• Add _resolve_unique_destination to prevent overwriting existing files
• Append sequential integer counters (e.g. file (1).ext) on naming collisions
• Maintain data integrity during batch folder sorting operations`;
        } else if (activeTool === 'rename') {
          simulated = `Suggested Clean Filenames:
1. auth-sessions-dashboard.png
2. user-security-tokens-overview.png
3. dashboard-active-sessions.png`;
        } else {
          simulated = `Python circular imports occur when two modules import each other (e.g. \`a.py\` imports \`b.py\` while \`b.py\` imports \`a.py\`).

When module A is being executed, it halts midway to import module B. If module B immediately accesses attributes of module A that have not yet been evaluated, Python raises an \`AttributeError\` or \`ImportError\`.

**How to avoid circular imports:**
1. **Deferred Imports**: Place the \`import\` statement inside the specific function or method where it is invoked rather than at the top level.
2. **Architecture Refactoring**: Extract shared models, classes, or interfaces into a dedicated third module (e.g. \`models.py\` or \`common.py\`).
3. **Type Hint Guards**: Use \`if TYPE_CHECKING:\` from the \`typing\` module for annotations that are only needed by mypy or IDEs.`;
        }

        setOutput(simulated);
        setExecutionTimeMs(Math.round(performance.now() - startTime));
        setIsLoading(false);
      }, 700);
      return;
    }

    // Real API call via BYOK key
    setIsDemoMode(false);
    try {
      let promptContent = '';
      let systemInstruction = 'You are an expert developer productivity assistant.';

      if (activeTool === 'summarize') {
        systemInstruction =
          'You are a Senior Principal Software Engineer. Analyze the code snippet. Provide: 1) Executive summary (2 sentences), 2) Key logic breakdown, 3) Complexity / Big-O performance, 4) Potential edge cases or bugs.';
        promptContent = `\`\`\`${codeLanguage}\n${codeSnippet}\n\`\`\`\n\nPlease analyze and review this code.`;
      } else if (activeTool === 'commit') {
        systemInstruction =
          'You are an automated Git commit assistant following Conventional Commits (feat:, fix:, refactor:, chore:, docs:). Output 1-line subject (<=72 chars), followed by 2-3 bullet points.';
        promptContent = `Generate a conventional commit message for this diff:\n\n${gitDiff}`;
      } else if (activeTool === 'rename') {
        systemInstruction =
          'You are a file naming normalization agent. Suggest 3 clean, unambiguous, lowercase filenames with hyphens or underscores. Output only the 3 suggestions.';
        promptContent = `Original filename: ${rawFilename}\nContext hint: ${fileContext}`;
      } else {
        promptContent = customPrompt;
      }

      const endpoint =
        activeProvider === 'groq'
          ? 'https://api.groq.com/openai/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions';

      const model =
        activeProvider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeKey.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: promptContent }
          ],
          temperature: 0.3,
          max_tokens: 1024
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Provider returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || 'No output generated.';
      setOutput(content);
      setExecutionTimeMs(Math.round(performance.now() - startTime));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch AI task.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyOutput = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#101726] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
              <span>Python Backend Module</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-300">ai_handler.py</span>
              <span aria-hidden="true">·</span>
              <span className="uppercase text-slate-300">{activeProvider} Provider</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              AI Developer Productivity Playground
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Execute specialized developer tasks using your stored API key or instant demo mode. Zero dependencies outside Python's standard <code className="text-slate-300">requests</code>.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono ${
                activeKey
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{activeKey ? `${activeProvider.toUpperCase()} Key Active` : 'Demo Sandbox Mode'}</span>
            </span>
          </div>
        </div>

        {/* Task Tabs */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveTool('summarize');
              setOutput('');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTool === 'summarize'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Code Summarizer & Reviewer</span>
          </button>

          <button
            onClick={() => {
              setActiveTool('commit');
              setOutput('');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTool === 'commit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Git Conventional Commit</span>
          </button>

          <button
            onClick={() => {
              setActiveTool('rename');
              setOutput('');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTool === 'rename'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Semantic File Renamer</span>
          </button>

          <button
            onClick={() => {
              setActiveTool('prompt');
              setOutput('');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              activeTool === 'prompt'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Developer Prompt Runner</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Split: Input & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 flex flex-col justify-between min-h-[420px]">
            <div>
              {/* Task 1: Code Summarizer */}
              {activeTool === 'summarize' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">
                      Code Snippet to Analyze:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCodeSnippet(PRESET_CODE_SNIPPETS.python);
                          setCodeLanguage('python');
                        }}
                        className="text-[11px] text-slate-400 hover:text-blue-400 font-mono"
                      >
                        Python Memo
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        onClick={() => {
                          setCodeSnippet(PRESET_CODE_SNIPPETS.rust);
                          setCodeLanguage('rust');
                        }}
                        className="text-[11px] text-slate-400 hover:text-blue-400 font-mono"
                      >
                        Rust Search
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        onClick={() => {
                          setCodeSnippet(PRESET_CODE_SNIPPETS.typescript);
                          setCodeLanguage('typescript');
                        }}
                        className="text-[11px] text-slate-400 hover:text-blue-400 font-mono"
                      >
                        TS Backoff
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={12}
                    value={codeSnippet}
                    onChange={(e) => setCodeSnippet(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                    placeholder="Paste code snippet..."
                  />
                </div>
              )}

              {/* Task 2: Git Commit */}
              {activeTool === 'commit' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-200">
                      Git Diff Staged Changes:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setGitDiff(PRESET_DIFFS.feature)}
                        className="text-[11px] text-slate-400 hover:text-blue-400 font-mono"
                      >
                        Feature Diff
                      </button>
                      <span className="text-slate-600">·</span>
                      <button
                        onClick={() => setGitDiff(PRESET_DIFFS.bugfix)}
                        className="text-[11px] text-slate-400 hover:text-blue-400 font-mono"
                      >
                        Security Fix Diff
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={12}
                    value={gitDiff}
                    onChange={(e) => setGitDiff(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                    placeholder="Paste git diff output..."
                  />
                </div>
              )}

              {/* Task 3: File Renamer */}
              {activeTool === 'rename' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                      Current Messy Filename:
                    </label>
                    <input
                      type="text"
                      value={rawFilename}
                      onChange={(e) => setRawFilename(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Screenshot 2026-03-29 at 11.23.41 PM.png"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                      Content Hint / Preview Context:
                    </label>
                    <textarea
                      rows={7}
                      value={fileContext}
                      onChange={(e) => setFileContext(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Provide brief context on what this file contains..."
                    />
                  </div>
                </div>
              )}

              {/* Task 4: Prompt Runner */}
              {activeTool === 'prompt' && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-200 block">
                    Developer Prompt:
                  </label>
                  <textarea
                    rows={12}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                    placeholder="Ask an engineering question or request code..."
                  />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                <Info className="w-3 h-3 text-slate-400" />
                {!activeKey ? 'Demo mode (simulated response)' : `Direct API: ${activeProvider}`}
              </span>

              <button
                onClick={runAITask}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Task...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Execute Task</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: AI Output Viewer (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#101726] border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="px-4 py-3 bg-[#0b101c] border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-semibold text-slate-200">AI Response</span>
                  {executionTimeMs !== null && (
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">
                      ({executionTimeMs}ms)
                    </span>
                  )}
                  {isDemoMode && (
                    <span className="text-[10px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded font-mono">
                      demo output
                    </span>
                  )}
                </div>

                {output && (
                  <button
                    onClick={copyOutput}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="p-5 text-xs text-slate-200 leading-relaxed font-sans min-h-[300px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                    <span>Querying LLM via lightweight requests client...</span>
                  </div>
                ) : errorMsg ? (
                  <div className="flex items-start gap-2.5 p-4 rounded-lg bg-rose-950/30 border border-rose-800 text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Execution Error</div>
                      <div className="mt-1 text-slate-300">{errorMsg}</div>
                    </div>
                  </div>
                ) : output ? (
                  <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed">
                    {output}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center h-56 text-slate-500 text-center gap-2">
                    <Terminal className="w-8 h-8 text-slate-600" />
                    <p>Select a task and click "Execute Task" to inspect AI responses.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-[#0c121e] border-t border-slate-800/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
              <span>CLI Equivalent:</span>
              <span className="text-slate-300">
                python productivity_toolkit.py ai{' '}
                {activeTool === 'summarize'
                  ? '--summarize file.py'
                  : activeTool === 'commit'
                  ? '--commit "$DIFF"'
                  : '--prompt "..."'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
