import React, { useState } from 'react';
import {
  Layers,
  Terminal,
  Cpu,
  Monitor,
  Copy,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  Check
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pyqt' | 'tauri' | 'electron' | 'cron'>('pyqt');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const PYQT_SNIPPET = `# PyQt6 / PySide6 Desktop Integration Example
import sys
from PyQt6.QtWidgets import (QApplication, QMainWindow, QPushButton, 
                             QVBoxLayout, QWidget, QLabel, QFileDialog)
from PyQt6.QtCore import QThread, pyqtSignal
from file_organizer import FileOrganizer
from ai_handler import AIHandler
from config_manager import ConfigManager

class OrganizeWorker(QThread):
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)

    def __init__(self, target_folder):
        super().__init__()
        self.target_folder = target_folder

    def run(self):
        try:
            organizer = FileOrganizer()
            res = organizer.organize(self.target_folder)
            self.finished.emit(res.to_dict())
        except Exception as exc:
            self.error.emit(str(exc))

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("DevPulse Desktop Companion")
        self.resize(500, 300)

        layout = QVBoxLayout()
        self.status_label = QLabel("Ready. Select a folder to organize.")
        self.btn = QPushButton("Select Folder & Organize")
        self.btn.clicked.connect(self.start_organizing)

        layout.addWidget(self.status_label)
        layout.addWidget(self.btn)

        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

    def start_organizing(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Folder")
        if folder:
            self.status_label.setText(f"Scanning & organizing {folder}...")
            self.worker = OrganizeWorker(folder)
            self.worker.finished.connect(lambda data: self.status_label.setText(
                f"Done! Moved {data['total_files_moved']} files."
            ))
            self.worker.error.connect(lambda err: self.status_label.setText(f"Error: {err}"))
            self.worker.start()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())`;

  const TAURI_SNIPPET = `// Tauri / Rust Desktop Integration
// src-tauri/src/main.rs
use std::process::Command;

#[tauri::command]
fn organize_downloads(path: String, dry_run: bool) -> Result<String, String> {
    let mut args = vec!["python_backend/productivity_toolkit.py", "organize", &path];
    if dry_run {
        args.push("--dry-run");
    }

    let output = Command::new("python3")
        .args(&args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}`;

  const ELECTRON_SNIPPET = `// Electron / Node.js child_process Integration
const { execFile } = require('child_process');
const path = require('path');

function runFileOrganizer(targetFolder, isDryRun = false) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'python_backend', 'productivity_toolkit.py');
    const args = ['organize', targetFolder];
    if (isDryRun) args.push('--dry-run');

    execFile('python3', [scriptPath, ...args], (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}`;

  const CRON_SNIPPET = `# Automated Daily Desktop Cleanup Daemon
# Add to crontab via 'crontab -e' (runs every night at 23:00)
0 23 * * * /usr/bin/python3 /path/to/productivity_toolkit.py organize ~/Downloads >> ~/.devpulse/cron.log 2>&1

# On Windows (PowerShell Scheduled Task):
# Register-ScheduledTask -TaskName "DevPulseDownloadsClean" \`
#   -Trigger (New-ScheduledTaskTrigger -Daily -At 11pm) \`
#   -Action (New-ScheduledTaskAction -Execute 'python' -Argument 'productivity_toolkit.py organize "$env:USERPROFILE\\Downloads"')`;

  return (
    <div className="space-y-6">
      {/* Blueprint Header */}
      <div className="bg-[#101726] border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
          <span>Desktop Architecture Blueprint</span>
          <span aria-hidden="true">·</span>
          <span>Zero-Overhead Subsystems</span>
          <span aria-hidden="true">·</span>
          <span>Cross-Platform Ready</span>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Desktop Application Integration Architecture
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Guidelines and recipes for integrating the Python backend engine with native desktop frameworks (PyQt6 / PySide6, Tauri, Electron) or headless background daemons.
        </p>
      </div>

      {/* Architecture Topology Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>1. ConfigManager (BYOK)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Encapsulates local JSON persistence with POSIX <code className="text-slate-300">chmod 0600</code> permissions. Protects API keys from unauthorized access by other system users while maintaining zero server relay.
          </p>
          <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/80">
            Storage: <span className="text-slate-300">~/.devpulse/config.json</span>
          </div>
        </div>

        <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>2. FileOrganizer Engine</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Non-recursive file scanner with deterministic collision resolution (<code className="text-slate-300">file (1).ext</code>), graceful permission error skipping, dry-run simulation, and atomic rollback log.
          </p>
          <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/80">
            Rollback: <span className="text-slate-300">.devpulse_organize_history.json</span>
          </div>
        </div>

        <div className="bg-[#101726] border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>3. AIHandler (Requests)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Lightweight client communicating with Groq and OpenAI chat endpoints using standard Python <code className="text-slate-300">requests</code>. Includes 1-token health check and error classification (401, 429).
          </p>
          <div className="text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/80">
            Dependencies: <span className="text-slate-300">requests &gt;= 2.31.0</span>
          </div>
        </div>
      </div>

      {/* Desktop GUI Integration Code Tabs */}
      <div className="bg-[#101726] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-200">
              Desktop Framework Integration Recipes
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('pyqt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'pyqt'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              PyQt6 / PySide6
            </button>
            <button
              onClick={() => setActiveTab('tauri')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'tauri'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Tauri (Rust)
            </button>
            <button
              onClick={() => setActiveTab('electron')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'electron'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Electron (Node)
            </button>
            <button
              onClick={() => setActiveTab('cron')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'cron'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Daemon / Cron
            </button>
          </div>
        </div>

        <div className="p-4 bg-[#0a0e17]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-slate-500">
              {activeTab === 'pyqt' && 'gui_app.py (Non-blocking QThread implementation)'}
              {activeTab === 'tauri' && 'src-tauri/src/main.rs (Tauri IPC command invocation)'}
              {activeTab === 'electron' && 'main.js (Subprocess execFile pipeline)'}
              {activeTab === 'cron' && 'crontab / Task Scheduler (Autonomous nighttime cleanup)'}
            </span>

            <button
              onClick={() => {
                const text =
                  activeTab === 'pyqt'
                    ? PYQT_SNIPPET
                    : activeTab === 'tauri'
                    ? TAURI_SNIPPET
                    : activeTab === 'electron'
                    ? ELECTRON_SNIPPET
                    : CRON_SNIPPET;
                copyToClipboard(text, activeTab);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-white bg-slate-800 rounded transition-colors"
            >
              {copiedCode === activeTab ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Snippet</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 text-xs font-mono text-slate-300 bg-[#070b12] rounded-lg overflow-x-auto leading-relaxed">
            {activeTab === 'pyqt' && PYQT_SNIPPET}
            {activeTab === 'tauri' && TAURI_SNIPPET}
            {activeTab === 'electron' && ELECTRON_SNIPPET}
            {activeTab === 'cron' && CRON_SNIPPET}
          </pre>
        </div>
      </div>
    </div>
  );
};
