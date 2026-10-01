#!/usr/bin/env python3
import sys
import os
import ctypes
from pathlib import Path

# Set explicit App User Model ID so Windows shows the custom icon on taskbar
try:
    myappid = "ashok.sura.productivity.v2"
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
except Exception:
    pass

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "python_backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from python_backend.main import SuraDesktopApp, main as backend_main

def main():
    icon_path = ROOT_DIR / "app_icon.ico"
    # Fallback to PyInstaller extraction path if running as bundled binary
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        bundled_icon = Path(sys._MEIPASS) / "app_icon.ico"
        if bundled_icon.exists():
            icon_path = bundled_icon

    # If backend supports app instance override, ensure icon is applied
    try:
        app = SuraDesktopApp()
        if icon_path.exists():
            app.iconbitmap(str(icon_path))
        app.mainloop()
    except Exception:
        backend_main()

if __name__ == "__main__":
    main()