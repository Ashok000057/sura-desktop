# SURA — Developer Productivity Suite (v2.0.0)

> A modern, lightweight, privacy-first desktop application designed for automated file organization and ultra-fast developer AI tasks with zero telemetry.

---

## 🚀 Key Features

- **Smart File Organizer:** Automatically categorizes messy directories (Downloads, Documents, Projects) into structured folders using customizable rules and file hash tracking.
- **BYOK AI Assistant:** Bring Your Own Key (BYOK) architecture supporting Groq LPU inference (Llama 3.1, Qwen, Mixtral) with local credential storage and sub-200ms latency.
- **Dynamic Model Auto-Discovery:** Seamlessly connects to live model endpoints, auto-detects active identifiers, and auto-recovers from deprecated model errors.
- **Zero Telemetry & Local Privacy:** API keys and settings reside exclusively on your machine in `config.json` with strict local permissions.
- **Native Desktop Performance:** Built with Python & CustomTkinter for quick startup and negligible memory footprint.

---

## 🛠️ Tech Stack

- **Language:** Python 3.11
- **UI Engine:** CustomTkinter
- **AI Provider:** Groq API (High-speed LPU inference)
- **Packaging:** PyInstaller (Standalone binary)
- **Installer:** Inno Setup 6

---

## 📥 Installation

Download the latest installer from the [Releases](https://github.com/Ashok000057/sura-desktop/releases/latest) section:
1. Run `SURA_v2.0.0_Setup.exe`.
2. Follow the standard Windows setup wizard.
3. Launch SURA from your Desktop shortcut or Start Menu.

---

## ⚙️ Development & Local Run

Clone the repository and install requirements:

```bash
git clone [https://github.com/Ashok000057/sura-desktop.git](https://github.com/Ashok000057/sura-desktop.git)
cd sura-desktop
pip install -r python_backend/requirements.txt
python main.py