#!/usr/bin/env python3
"""
SURA (v2.0.0) - Automated Standalone Executable Builder
======================================================
Validates local dependencies, compiles bytecode, cleans prior build artifacts,
and invokes PyInstaller to produce dist/sura.exe (Windows) or dist/sura (Unix).

Usage:
    python build_executable.py
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path


def log(msg: str):
    print(f"[SURA-BUILD] {msg}")


def check_dependencies():
    log("Checking prerequisite packages...")
    required = ["customtkinter", "requests", "PyInstaller"]
    missing = []
    for pkg in required:
        try:
            __import__(pkg)
        except ImportError:
            # Check lowercase variant
            try:
                __import__(pkg.lower())
            except ImportError:
                missing.append(pkg)

    if missing:
        log(f"CRITICAL: Missing packages: {', '.join(missing)}")
        log("Install via: pip install customtkinter requests pyinstaller")
        sys.exit(1)
    log("✓ All prerequisite packages are installed.")


def clean_build_artifacts():
    log("Cleaning previous build and dist artifacts...")
    for folder in ["build", "dist"]:
        path = Path(folder)
        if path.exists() and path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
            log(f"  Removed old {folder}/")


def run_pyinstaller():
    log("Starting PyInstaller packaging...")
    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconsole",
        "--onefile",
        "--name",
        "sura",
        "--collect-all",
        "customtkinter",
        "main.py",
    ]
    log(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd)

    if result.returncode != 0:
        log("✗ PyInstaller build failed. Check logs above.")
        sys.exit(result.returncode)

    exe_name = "sura.exe" if sys.platform == "win32" else "sura"
    dist_file = Path("dist") / exe_name

    if dist_file.exists():
        size_mb = round(dist_file.stat().st_size / (1024 * 1024), 2)
        log("=" * 60)
        log(f"✓ BUILD SUCCESSFUL: {dist_file.resolve()}")
        log(f"  Binary Size: {size_mb} MB")
        log(f"  Target: Standalone portable {exe_name}")
        log("=" * 60)
    else:
        log("✗ Build finished but binary not found in dist/")


if __name__ == "__main__":
    check_dependencies()
    clean_build_artifacts()
    run_pyinstaller()
