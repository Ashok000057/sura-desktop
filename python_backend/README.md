# DevPulse Desktop Productivity Backend (BYOK Architecture)

A modular, production-ready Python backend engine for developer desktop productivity tools. Follows the **Bring Your Own Key (BYOK)** paradigm for local AI capabilities and includes a resilient, self-healing file organization engine.

---

## 1. System Requirements & Pip Installation

The core system is engineered to have minimal external dependencies to ensure fast startup times and zero dependency conflicts.

```bash
# Minimal required package (for HTTP AI API calls)
pip install requests>=2.31.0

# Optional enhancements (for CLI visual styling or cryptographic encryption):
pip install rich>=13.7.0
pip install cryptography>=42.0.0
```

---

## 2. Architecture & File Breakdown

| File | Purpose | Key Classes & Methods |
| :--- | :--- | :--- |
| `config_manager.py` | Secure local credential & settings management | `ConfigManager`, `save_api_key()`, `get_api_key()`, `has_valid_key()` |
| `file_organizer.py` | Extension-based sorting & duplicate collision resolution | `FileOrganizer`, `organize()`, `revert_last_run()` |
| `ai_handler.py` | Lightweight Groq & OpenAI requests client | `AIHandler`, `execute_prompt()`, `summarize_code()`, `generate_git_commit()` |
| `productivity_toolkit.py` | Master CLI interface and orchestrator | `main()`, `handle_config_command()`, `handle_organize_command()` |

---

## 3. Quick Start & CLI Usage

### A. Manage BYOK API Keys
```bash
# Save your Groq API Key (Recommended for ultra-fast, free tier usage)
python productivity_toolkit.py config --set-key gsk_yourGroqKeyHere... --provider groq

# Or save an OpenAI API Key
python productivity_toolkit.py config --set-key sk-yourOpenAIKeyHere... --provider openai

# Inspect current configuration status
python productivity_toolkit.py config --status
```

### B. Organize Download & Desktop Directories
```bash
# 1. Preview changes first without moving any files (Dry Run)
python productivity_toolkit.py organize ~/Downloads --dry-run

# 2. Execute live reorganization
python productivity_toolkit.py organize ~/Downloads

# 3. Undo / Rollback the last organization run (safely restores all files)
python productivity_toolkit.py organize ~/Downloads --revert
```

### C. Run AI Developer Tasks (Using Your Stored Key)
```bash
# Summarize a Python script with code analysis
python productivity_toolkit.py ai summarize --file config_manager.py

# Synthesize a Conventional Commit message from staged git diff
python productivity_toolkit.py ai commit --diff "$(git diff --staged)"

# Ask a direct engineering question
python productivity_toolkit.py ai prompt "Explain how Python's GIL affects threading vs multiprocessing"
```

---

## 4. Edge Case Handling Blueprint

1. **Duplicate Filenames**: If `report.pdf` already exists in `Documents/`, the engine renames incoming files sequentially to `report (1).pdf`, `report (2).pdf` without data loss or overwriting.
2. **Missing Folders**: Creates destination category folders on-the-fly (`os.makedirs(exist_ok=True)`).
3. **Permission Locks**: If an open or system file throws `PermissionError`, the engine logs the specific file error, skips it safely, and finishes organizing all other eligible files.
4. **Credential Security**: Config file permissions are automatically hardened with `chmod 0600` on POSIX systems so only the active operating system user account can read or write API tokens.
5. **Accidental Moves**: Writes a local session manifest `.devpulse_organize_history.json` allowing immediate 1-click rollback via `--revert`.

---

## 5. Desktop GUI Integration Patterns

### A. PyQt6 / PySide6 Desktop GUI
```python
from PyQt6.QtCore import QThread, pyqtSignal
from file_organizer import FileOrganizer

class OrganizeWorker(QThread):
    progress = pyqtSignal(str)
    finished = pyqtSignal(dict)

    def __init__(self, target_directory):
        super().__init__()
        self.target_dir = target_directory

    def run(self):
        organizer = FileOrganizer()
        result = organizer.organize(self.target_dir)
        self.finished.emit(result.to_dict())
```

### B. Electron / Tauri (Via JSON-RPC or Subprocess)
Expose standard stdin/stdout JSON messages or invoke the CLI:
```javascript
import { execFile } from 'child_process';

execFile('python', ['productivity_toolkit.py', 'organize', folderPath, '--dry-run'], (error, stdout) => {
  console.log(stdout);
});
```
