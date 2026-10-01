#!/usr/bin/env python3
"""
SURA - Developer Desktop Productivity Suite
============================================
Modern Dark-Theme Desktop GUI built with CustomTkinter.
Integrates:
- Intelligent File Organization Engine (with dry-run and duplicate disambiguation)
- Smart Bulk File Renamer (Pattern matching, prefix/suffix, numbering, live preview)
- BYOK API Key Manager (Groq llama-3.1-8b-instant & OpenAI gpt-4o-mini)
- AI Developer Assistant (Code Summarization, Commit Messages, File Renamer, Security Audit)

Author: SURA Architecture Team
Framework: CustomTkinter (Python 3.9+)
"""

from __future__ import annotations
import os
import re
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple

# ---------------------------------------------------------
# Dynamic Import Resolution (Handles root, subfolder & PyInstaller paths)
# ---------------------------------------------------------
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

PARENT_DIR = CURRENT_DIR.parent
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))

BACKEND_DIR = CURRENT_DIR / "python_backend"
if BACKEND_DIR.is_dir() and str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

def resource_path(relative_path: str) -> Path:
    """Get absolute path to resource, works for dev and for PyInstaller _MEIPASS."""
    if hasattr(sys, '_MEIPASS'):
        return Path(sys._MEIPASS) / relative_path
    return CURRENT_DIR / relative_path

try:
    from config_manager import ConfigManager, ConfigError
    from file_organizer import FileOrganizer, FileOrganizerError, OrganizationResult
    from ai_handler import (
        AIHandler,
        AIHandlerError,
        AuthenticationError,
        RateLimitError
    )
except ImportError:
    try:
        from python_backend.config_manager import ConfigManager, ConfigError
        from python_backend.file_organizer import FileOrganizer, FileOrganizerError, OrganizationResult
        from python_backend.ai_handler import (
            AIHandler,
            AIHandlerError,
            AuthenticationError,
            RateLimitError
        )
    except ImportError as exc:
        raise ImportError(
            f"Failed to import core SURA modules. Ensure config_manager.py, file_organizer.py, "
            f"and ai_handler.py are in python_backend/. Details: {exc}"
        ) from exc

import customtkinter as ctk
from tkinter import filedialog, messagebox


class SuraDesktopApp(ctk.CTk):
    """
    Main Desktop Graphical User Interface for SURA Productivity Suite.
    """

    APP_TITLE = "SURA - Developer Productivity Suite"
    VERSION = "2.1.0"

    def __init__(self):
        super().__init__()

        # Window Configuration
        self.title(f"{self.APP_TITLE} (v{self.VERSION})")
        self.geometry("1120x720")
        self.minsize(960, 600)

        # Set Sleek Dark Theme
        ctk.set_appearance_mode("Dark")
        ctk.set_default_color_theme("blue")

        # Initialize Backend Subsystems
        self.config_manager = ConfigManager()
        self.organizer = FileOrganizer()

        # State Variables
        self.active_tab = "organizer"
        self.is_processing = False
        self.show_api_key = False
        self.renamer_staged_files: List[Path] = []
        self.renamer_plan: List[Tuple[Path, str]] = []

        # Build Main UI Grid
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build_sidebar()
        self._build_content_views()
        self._select_tab("organizer")
        self._update_sidebar_status()

    # -----------------------------------------------------
    # Sidebar Navigation UI
    # -----------------------------------------------------
    def _build_sidebar(self):
        self.sidebar_frame = ctk.CTkFrame(self, width=220, corner_radius=0, fg_color="#0f1523")
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(6, weight=1)

        # Brand Title
        self.logo_label = ctk.CTkLabel(
            self.sidebar_frame,
            text="S U R A",
            font=ctk.CTkFont(family="Arial", size=24, weight="bold"),
            text_color="#3b82f6"
        )
        self.logo_label.grid(row=0, column=0, padx=20, pady=(24, 2))

        self.subtitle_label = ctk.CTkLabel(
            self.sidebar_frame,
            text="Developer Productivity Suite",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8"
        )
        self.subtitle_label.grid(row=1, column=0, padx=20, pady=(0, 20))

        # Navigation Buttons
        self.nav_organizer_btn = ctk.CTkButton(
            self.sidebar_frame,
            text="📁  File Organizer",
            anchor="w",
            font=ctk.CTkFont(size=13, weight="bold"),
            height=40,
            corner_radius=8,
            command=lambda: self._select_tab("organizer")
        )
        self.nav_organizer_btn.grid(row=2, column=0, padx=14, pady=4, sticky="ew")

        self.nav_renamer_btn = ctk.CTkButton(
            self.sidebar_frame,
            text="🏷️  Bulk Renamer",
            anchor="w",
            font=ctk.CTkFont(size=13),
            height=40,
            corner_radius=8,
            command=lambda: self._select_tab("renamer")
        )
        self.nav_renamer_btn.grid(row=3, column=0, padx=14, pady=4, sticky="ew")

        self.nav_settings_btn = ctk.CTkButton(
            self.sidebar_frame,
            text="⚙️  BYOK Settings",
            anchor="w",
            font=ctk.CTkFont(size=13),
            height=40,
            corner_radius=8,
            command=lambda: self._select_tab("settings")
        )
        self.nav_settings_btn.grid(row=4, column=0, padx=14, pady=4, sticky="ew")

        self.nav_ai_btn = ctk.CTkButton(
            self.sidebar_frame,
            text="🤖  AI Assistant",
            anchor="w",
            font=ctk.CTkFont(size=13),
            height=40,
            corner_radius=8,
            command=lambda: self._select_tab("ai")
        )
        self.nav_ai_btn.grid(row=5, column=0, padx=14, pady=4, sticky="ew")

        # Bottom System Info in Sidebar
        self.sidebar_bottom_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        self.sidebar_bottom_frame.grid(row=7, column=0, padx=14, pady=16, sticky="ew")

        self.key_status_badge = ctk.CTkLabel(
            self.sidebar_bottom_frame,
            text="● Key Unconfigured",
            font=ctk.CTkFont(family="Consolas", size=11),
            text_color="#f59e0b"
        )
        self.key_status_badge.pack(anchor="w", pady=(0, 4))

        self.version_tag = ctk.CTkLabel(
            self.sidebar_bottom_frame,
            text=f"v{self.VERSION} · BYOK Native",
            font=ctk.CTkFont(size=10),
            text_color="#64748b"
        )
        self.version_tag.pack(anchor="w")

    def _select_tab(self, tab_name: str):
        self.active_tab = tab_name
        unselected_color = "transparent"
        selected_color = "#1e3a8a"

        self.nav_organizer_btn.configure(
            fg_color=selected_color if tab_name == "organizer" else unselected_color,
            text_color="#ffffff" if tab_name == "organizer" else "#cbd5e1"
        )
        self.nav_renamer_btn.configure(
            fg_color=selected_color if tab_name == "renamer" else unselected_color,
            text_color="#ffffff" if tab_name == "renamer" else "#cbd5e1"
        )
        self.nav_settings_btn.configure(
            fg_color=selected_color if tab_name == "settings" else unselected_color,
            text_color="#ffffff" if tab_name == "settings" else "#cbd5e1"
        )
        self.nav_ai_btn.configure(
            fg_color=selected_color if tab_name == "ai" else unselected_color,
            text_color="#ffffff" if tab_name == "ai" else "#cbd5e1"
        )

        self.organizer_frame.grid_remove()
        self.renamer_frame.grid_remove()
        self.settings_frame.grid_remove()
        self.ai_frame.grid_remove()

        if tab_name == "organizer":
            self.organizer_frame.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        elif tab_name == "renamer":
            self.renamer_frame.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        elif tab_name == "settings":
            self.settings_frame.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
            self._load_settings_into_ui()
        elif tab_name == "ai":
            self.ai_frame.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
            self._update_ai_tab_badge()

        self._update_sidebar_status()

    def _update_sidebar_status(self):
        active_provider = self.config_manager.get_active_provider()
        has_key = self.config_manager.has_valid_key(active_provider)
        if has_key:
            self.key_status_badge.configure(
                text=f"● {active_provider.upper()} Active",
                text_color="#10b981"
            )
        else:
            self.key_status_badge.configure(
                text="○ Key Not Configured",
                text_color="#f59e0b"
            )

    def _build_content_views(self):
        self.organizer_frame = ctk.CTkFrame(self, fg_color="transparent")
        self._build_organizer_tab()

        self.renamer_frame = ctk.CTkFrame(self, fg_color="transparent")
        self._build_renamer_tab()

        self.settings_frame = ctk.CTkFrame(self, fg_color="transparent")
        self._build_settings_tab()

        self.ai_frame = ctk.CTkFrame(self, fg_color="transparent")
        self._build_ai_tab()

    # =====================================================
    # TAB 1: File Organizer UI
    # =====================================================
    def _build_organizer_tab(self):
        self.organizer_frame.grid_columnconfigure(0, weight=1)
        self.organizer_frame.grid_rowconfigure(3, weight=1)

        header_frame = ctk.CTkFrame(self.organizer_frame, fg_color="transparent")
        header_frame.grid(row=0, column=0, sticky="ew", pady=(0, 14))

        title = ctk.CTkLabel(
            header_frame,
            text="Intelligent Directory Organizer",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#ffffff"
        )
        title.pack(anchor="w")

        desc = ctk.CTkLabel(
            header_frame,
            text="Scans target folders and sorts files into Images, Documents, Code, Archives & Media with automatic collision disambiguation.",
            font=ctk.CTkFont(size=12),
            text_color="#94a3b8"
        )
        desc.pack(anchor="w", pady=(2, 0))

        # Path Selector
        path_box = ctk.CTkFrame(self.organizer_frame, fg_color="#161f30", corner_radius=10)
        path_box.grid(row=1, column=0, sticky="ew", pady=(0, 14), padx=2)
        path_box.grid_columnconfigure(1, weight=1)

        path_label = ctk.CTkLabel(path_box, text="Target Folder:", font=ctk.CTkFont(size=12, weight="bold"))
        path_label.grid(row=0, column=0, padx=(14, 8), pady=12)

        default_downloads = str(Path.home() / "Downloads")
        self.folder_path_entry = ctk.CTkEntry(path_box, font=ctk.CTkFont(family="Consolas", size=12), height=36)
        self.folder_path_entry.insert(0, default_downloads)
        self.folder_path_entry.grid(row=0, column=1, sticky="ew", padx=8, pady=12)

        browse_btn = ctk.CTkButton(
            path_box,
            text="Browse...",
            width=90,
            height=36,
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            command=self._browse_directory
        )
        browse_btn.grid(row=0, column=2, padx=4, pady=12)

        open_folder_btn = ctk.CTkButton(
            path_box,
            text="📂 Open",
            width=75,
            height=36,
            fg_color="#334155",
            hover_color="#475569",
            command=self._open_current_target_folder
        )
        open_folder_btn.grid(row=0, column=3, padx=(4, 14), pady=12)

        # Options & Controls
        controls_frame = ctk.CTkFrame(self.organizer_frame, fg_color="#161f30", corner_radius=10)
        controls_frame.grid(row=2, column=0, sticky="ew", pady=(0, 14), padx=2)

        options_row = ctk.CTkFrame(controls_frame, fg_color="transparent")
        options_row.pack(fill="x", padx=14, pady=(12, 10))

        self.opt_dry_run = ctk.CTkCheckBox(options_row, text="Dry-Run Preview (Calculate without moving)", font=ctk.CTkFont(size=12))
        self.opt_dry_run.pack(side="left", padx=(0, 16))

        self.opt_skip_hidden = ctk.CTkCheckBox(options_row, text="Skip Hidden Dotfiles (.env, .git)", font=ctk.CTkFont(size=12))
        self.opt_skip_hidden.select()
        self.opt_skip_hidden.pack(side="left")

        actions_row = ctk.CTkFrame(controls_frame, fg_color="transparent")
        actions_row.pack(fill="x", padx=14, pady=(0, 12))

        self.start_organize_btn = ctk.CTkButton(
            actions_row,
            text="⚡ Start Organizing",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#10b981",
            hover_color="#059669",
            height=36,
            command=self._start_organize_thread
        )
        self.start_organize_btn.pack(side="left", padx=(0, 10))

        self.revert_btn = ctk.CTkButton(
            actions_row,
            text="↩️ Revert Last Run",
            font=ctk.CTkFont(size=12),
            fg_color="#b45309",
            hover_color="#92400e",
            height=36,
            command=self._start_revert_thread
        )
        self.revert_btn.pack(side="left", padx=(0, 10))

        self.clear_log_btn = ctk.CTkButton(
            actions_row,
            text="🧹 Clear Console",
            font=ctk.CTkFont(size=12),
            fg_color="#334155",
            hover_color="#475569",
            height=36,
            width=110,
            command=self._clear_organizer_logs
        )
        self.clear_log_btn.pack(side="right")

        # Auto-scrolling Log Console
        self.log_console = ctk.CTkTextbox(
            self.organizer_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color="#0b101c",
            text_color="#e2e8f0",
            corner_radius=10,
            wrap="word"
        )
        self.log_console.grid(row=3, column=0, sticky="nsew", padx=2)

        self._append_log("SURA File Organization Subsystem Ready.")
        self._append_log(f"Current Target Directory: {default_downloads}\n")

    def _browse_directory(self):
        folder = filedialog.askdirectory(initialdir=self.folder_path_entry.get() or str(Path.home()))
        if folder:
            self.folder_path_entry.delete(0, "end")
            self.folder_path_entry.insert(0, str(Path(folder).resolve()))
            self._append_log(f"Selected Target: {folder}")

    def _open_current_target_folder(self):
        folder = self.folder_path_entry.get().strip()
        if not folder or not Path(folder).exists():
            messagebox.showwarning("Directory Not Found", "Please choose an existing folder path first.")
            return

        try:
            if sys.platform == "win32":
                os.startfile(folder)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", folder])
            else:
                subprocess.Popen(["xdg-open", folder])
        except Exception as exc:
            messagebox.showerror("Failed to Open Folder", str(exc))

    def _clear_organizer_logs(self):
        self.log_console.delete("1.0", "end")
        self._append_log("Console cleared.")

    def _append_log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_console.insert("end", f"[{timestamp}] {message}\n")
        self.log_console.see("end")

    def _start_organize_thread(self):
        if self.is_processing:
            return

        target_dir = self.folder_path_entry.get().strip()
        if not target_dir or not Path(target_dir).exists():
            messagebox.showerror("Invalid Directory", "The specified target directory does not exist.")
            return

        self.is_processing = True
        self.start_organize_btn.configure(state="disabled", text="⏳ Organizing...")
        self.revert_btn.configure(state="disabled")

        dry_run = bool(self.opt_dry_run.get())
        skip_hidden = bool(self.opt_skip_hidden.get())
        self.organizer.skip_hidden = skip_hidden

        def worker():
            self._append_log(f"Starting organization on: {target_dir} (Dry-Run: {dry_run})")
            start_time = time.time()
            try:
                result = self.organizer.organize(target_dir, dry_run=dry_run)
                elapsed = round(time.time() - start_time, 2)
                self.after(0, lambda r=result, el=elapsed, dr=dry_run: self._on_organize_complete(r, el, dr))
            except Exception as exc:
                err_msg = str(exc)
                self.after(0, lambda m=err_msg: self._on_organize_error(m))

        threading.Thread(target=worker, daemon=True).start()

    def _on_organize_complete(self, result: OrganizationResult, elapsed: float, is_dry_run: bool):
        self.is_processing = False
        self.start_organize_btn.configure(state="normal", text="⚡ Start Organizing")
        self.revert_btn.configure(state="normal")

        tag = "[DRY RUN COMPLETE]" if is_dry_run else "[SUCCESS]"
        self._append_log("=" * 60)
        self._append_log(f"{tag} Finished in {elapsed}s")
        self._append_log(f"  • Files Scanned  : {result.total_files_scanned}")
        self._append_log(f"  • Files Sorted   : {result.total_files_moved}")
        self._append_log(f"  • Files Skipped  : {result.total_files_skipped}")
        self._append_log(f"  • Categories Made: {', '.join(result.categories_created) if result.categories_created else 'None'}")

        if result.moved_records:
            self._append_log("  • Sample Moves:")
            for rec in result.moved_records[:10]:
                src_name = Path(rec.source_path).name
                dest_name = Path(rec.destination_path).name
                renamed_tag = " (auto-renamed duplicate)" if rec.was_renamed else ""
                self._append_log(f"    - {src_name} -> [{rec.category}]/{dest_name}{renamed_tag}")
            if len(result.moved_records) > 10:
                self._append_log(f"    ... and {len(result.moved_records) - 10} more files.")

        if result.errors:
            self._append_log(f"  • Errors Handled : {len(result.errors)}")
            for err in result.errors:
                self._append_log(f"    ! {err['file']}: {err['error']}")

        self._append_log("=" * 60 + "\n")
        messagebox.showinfo("Organization Complete", f"{tag}\nProcessed: {result.total_files_moved} files\nTime: {elapsed}s")

    def _on_organize_error(self, error_message: str):
        self.is_processing = False
        self.start_organize_btn.configure(state="normal", text="⚡ Start Organizing")
        self.revert_btn.configure(state="normal")
        self._append_log(f"ERROR: {error_message}")
        messagebox.showerror("Organization Error", error_message)

    def _start_revert_thread(self):
        if self.is_processing:
            return

        target_dir = self.folder_path_entry.get().strip()
        if not target_dir:
            return

        self.is_processing = True
        self.revert_btn.configure(state="disabled", text="⏳ Reverting...")
        self.start_organize_btn.configure(state="disabled")

        def worker():
            try:
                restored, errors = self.organizer.revert_last_run(target_dir)
                self.after(0, lambda rc=restored, er=errors: self._on_revert_complete(rc, er))
            except Exception as exc:
                err_msg = str(exc)
                self.after(0, lambda m=err_msg: self._on_revert_error(m))

        threading.Thread(target=worker, daemon=True).start()

    def _on_revert_complete(self, restored_count: int, errors: list):
        self.is_processing = False
        self.revert_btn.configure(state="normal", text="↩️ Revert Last Run")
        self.start_organize_btn.configure(state="normal")
        self._append_log(f"[ROLLBACK COMPLETE] Restored {restored_count} files back to source positions.\n")
        if errors:
            for err in errors:
                self._append_log(f"  ! Rollback warning: {err}")
        messagebox.showinfo("Rollback Complete", f"Restored {restored_count} files.")

    def _on_revert_error(self, error_message: str):
        self.is_processing = False
        self.revert_btn.configure(state="normal", text="↩️ Revert Last Run")
        self.start_organize_btn.configure(state="normal")
        self._append_log(f"ROLLBACK ERROR: {error_message}")
        messagebox.showerror("Rollback Failed", error_message)

    # =====================================================
    # TAB 2: Smart Bulk Renamer UI (NEW v2.1.0)
    # =====================================================
    def _build_renamer_tab(self):
        self.renamer_frame.grid_columnconfigure(0, weight=1)
        self.renamer_frame.grid_rowconfigure(3, weight=1)

        # Header
        header = ctk.CTkFrame(self.renamer_frame, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", pady=(0, 10))

        title = ctk.CTkLabel(header, text="Smart Bulk File Renamer", font=ctk.CTkFont(size=20, weight="bold"), text_color="#ffffff")
        title.pack(anchor="w")

        desc = ctk.CTkLabel(
            header,
            text="Batch rename files using prefix, suffix, text find/replace, and auto-numbering with live dry-run preview.",
            font=ctk.CTkFont(size=12),
            text_color="#94a3b8"
        )
        desc.pack(anchor="w", pady=(2, 0))

        # Target Folder & Extension Filter
        dir_box = ctk.CTkFrame(self.renamer_frame, fg_color="#161f30", corner_radius=10)
        dir_box.grid(row=1, column=0, sticky="ew", pady=(0, 10), padx=2)
        dir_box.grid_columnconfigure(1, weight=1)

        dir_lbl = ctk.CTkLabel(dir_box, text="Folder:", font=ctk.CTkFont(size=12, weight="bold"))
        dir_lbl.grid(row=0, column=0, padx=(14, 8), pady=10)

        self.renamer_folder_entry = ctk.CTkEntry(dir_box, font=ctk.CTkFont(family="Consolas", size=12), height=34)
        self.renamer_folder_entry.insert(0, str(Path.home() / "Downloads"))
        self.renamer_folder_entry.grid(row=0, column=1, sticky="ew", padx=8, pady=10)

        browse_btn = ctk.CTkButton(
            dir_box,
            text="Browse...",
            width=85,
            height=34,
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            command=self._browse_renamer_directory
        )
        browse_btn.grid(row=0, column=2, padx=4, pady=10)

        filter_lbl = ctk.CTkLabel(dir_box, text="Filter:", font=ctk.CTkFont(size=12))
        filter_lbl.grid(row=0, column=3, padx=(8, 4), pady=10)

        self.renamer_ext_entry = ctk.CTkEntry(dir_box, width=75, height=34, placeholder_text="*.*", font=ctk.CTkFont(family="Consolas", size=12))
        self.renamer_ext_entry.insert(0, "*.*")
        self.renamer_ext_entry.grid(row=0, column=4, padx=4, pady=10)

        load_files_btn = ctk.CTkButton(
            dir_box,
            text="🔄 Scan Files",
            width=100,
            height=34,
            fg_color="#334155",
            hover_color="#475569",
            command=self._scan_renamer_files
        )
        load_files_btn.grid(row=0, column=5, padx=(4, 14), pady=10)

        # Transformation Controls Card
        rules_box = ctk.CTkFrame(self.renamer_frame, fg_color="#161f30", corner_radius=10)
        rules_box.grid(row=2, column=0, sticky="ew", pady=(0, 10), padx=2)

        # Row 1: Prefix / Suffix
        r1 = ctk.CTkFrame(rules_box, fg_color="transparent")
        r1.pack(fill="x", padx=14, pady=(10, 6))

        ctk.CTkLabel(r1, text="Prefix:", font=ctk.CTkFont(size=12, weight="bold"), width=50, anchor="w").pack(side="left")
        self.prefix_entry = ctk.CTkEntry(r1, placeholder_text="e.g. DOC_", width=160, height=32)
        self.prefix_entry.pack(side="left", padx=(0, 20))
        self.prefix_entry.bind("<KeyRelease>", lambda e: self._generate_renamer_preview())

        ctk.CTkLabel(r1, text="Suffix:", font=ctk.CTkFont(size=12, weight="bold"), width=50, anchor="w").pack(side="left")
        self.suffix_entry = ctk.CTkEntry(r1, placeholder_text="e.g. _v2", width=160, height=32)
        self.suffix_entry.pack(side="left", padx=(0, 20))
        self.suffix_entry.bind("<KeyRelease>", lambda e: self._generate_renamer_preview())

        self.case_menu = ctk.CTkOptionMenu(
            r1,
            values=["Original Case", "lowercase", "UPPERCASE", "Title Case"],
            height=32,
            width=140,
            command=lambda v: self._generate_renamer_preview()
        )
        self.case_menu.pack(side="right")

        # Row 2: Find & Replace
        r2 = ctk.CTkFrame(rules_box, fg_color="transparent")
        r2.pack(fill="x", padx=14, pady=(0, 6))

        ctk.CTkLabel(r2, text="Find:", font=ctk.CTkFont(size=12, weight="bold"), width=50, anchor="w").pack(side="left")
        self.find_entry = ctk.CTkEntry(r2, placeholder_text="text to match", width=160, height=32)
        self.find_entry.pack(side="left", padx=(0, 20))
        self.find_entry.bind("<KeyRelease>", lambda e: self._generate_renamer_preview())

        ctk.CTkLabel(r2, text="Replace:", font=ctk.CTkFont(size=12, weight="bold"), width=50, anchor="w").pack(side="left")
        self.replace_entry = ctk.CTkEntry(r2, placeholder_text="replacement text", width=160, height=32)
        self.replace_entry.pack(side="left", padx=(0, 20))
        self.replace_entry.bind("<KeyRelease>", lambda e: self._generate_renamer_preview())

        self.opt_use_regex = ctk.CTkCheckBox(r2, text="Regex", font=ctk.CTkFont(size=11), command=self._generate_renamer_preview)
        self.opt_use_regex.pack(side="left")

        # Row 3: Auto-Numbering & Action Buttons
        r3 = ctk.CTkFrame(rules_box, fg_color="transparent")
        r3.pack(fill="x", padx=14, pady=(0, 10))

        self.opt_add_numbering = ctk.CTkCheckBox(r3, text="Auto Numbering:", font=ctk.CTkFont(size=12, weight="bold"), command=self._generate_renamer_preview)
        self.opt_add_numbering.pack(side="left", padx=(0, 10))

        self.numbering_padding_entry = ctk.CTkEntry(r3, width=45, height=30, font=ctk.CTkFont(family="Consolas", size=11))
        self.numbering_padding_entry.insert(0, "2")
        self.numbering_padding_entry.pack(side="left", padx=(0, 6))
        self.numbering_padding_entry.bind("<KeyRelease>", lambda e: self._generate_renamer_preview())
        ctk.CTkLabel(r3, text="digits (e.g. 01, 02)", font=ctk.CTkFont(size=11), text_color="#94a3b8").pack(side="left", padx=(0, 20))

        self.execute_rename_btn = ctk.CTkButton(
            r3,
            text="🏷️️ Execute Batch Rename",
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color="#10b981",
            hover_color="#059669",
            height=34,
            command=self._execute_batch_rename
        )
        self.execute_rename_btn.pack(side="right")

        self.preview_btn = ctk.CTkButton(
            r3,
            text="👁️ Refresh Preview",
            font=ctk.CTkFont(size=12),
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            height=34,
            command=self._generate_renamer_preview
        )
        self.preview_btn.pack(side="right", padx=(0, 10))

        # Preview Table Area
        self.renamer_table_box = ctk.CTkTextbox(
            self.renamer_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color="#0b101c",
            text_color="#e2e8f0",
            corner_radius=10,
            wrap="none"
        )
        self.renamer_table_box.grid(row=3, column=0, sticky="nsew", padx=2)

        self._show_renamer_welcome_hint()

    def _show_renamer_welcome_hint(self):
        self.renamer_table_box.delete("1.0", "end")
        hint = (
            "========================================================================================================\n"
            " SURA Smart Bulk Renamer — Dry-Run Preview Table\n"
            "========================================================================================================\n\n"
            " 1. Select a folder and click '🔄 Scan Files'.\n"
            " 2. Configure your prefix, suffix, replace rules, or auto-numbering above.\n"
            " 3. The live preview below updates automatically to show: Original Name -> Target Name.\n"
            " 4. Click '🏷️ Execute Batch Rename' when you are satisfied with the preview.\n"
        )
        self.renamer_table_box.insert("1.0", hint)

    def _browse_renamer_directory(self):
        folder = filedialog.askdirectory(initialdir=self.renamer_folder_entry.get() or str(Path.home()))
        if folder:
            self.renamer_folder_entry.delete(0, "end")
            self.renamer_folder_entry.insert(0, str(Path(folder).resolve()))
            self._scan_renamer_files()

    def _scan_renamer_files(self):
        target_dir = self.renamer_folder_entry.get().strip()
        if not target_dir or not Path(target_dir).is_dir():
            messagebox.showwarning("Directory Error", "Please provide a valid directory.")
            return

        ext_filter = self.renamer_ext_entry.get().strip().lower()
        folder_path = Path(target_dir)

        try:
            entries = [f for f in folder_path.iterdir() if f.is_file() and not f.name.startswith(".")]
            if ext_filter and ext_filter not in ("*.*", "*"):
                if not ext_filter.startswith("."):
                    ext_filter = f".{ext_filter}"
                entries = [f for f in entries if f.suffix.lower() == ext_filter]

            self.renamer_staged_files = sorted(entries, key=lambda f: f.name.lower())
            self._generate_renamer_preview()
        except Exception as exc:
            messagebox.showerror("Scan Error", str(exc))

    def _generate_renamer_preview(self):
        if not self.renamer_staged_files:
            return

        prefix = self.prefix_entry.get()
        suffix = self.suffix_entry.get()
        find_val = self.find_entry.get()
        replace_val = self.replace_entry.get()
        use_regex = bool(self.opt_use_regex.get())
        add_numbering = bool(self.opt_add_numbering.get())
        case_opt = self.case_menu.get()

        try:
            pad = int(self.numbering_padding_entry.get().strip())
        except ValueError:
            pad = 2

        self.renamer_plan.clear()
        lines = [
            "========================================================================================================",
            f" SURA Bulk Renamer Preview — Staged Files: {len(self.renamer_staged_files)}",
            "========================================================================================================",
            f"{'ORIGINAL FILE NAME':<45} -> {'NEW FILE NAME'}",
            "-" * 100
        ]

        count = 1
        changed_count = 0
        for file_path in self.renamer_staged_files:
            stem = file_path.stem
            ext = file_path.suffix

            # 1. Find & Replace
            if find_val:
                try:
                    if use_regex:
                        stem = re.sub(find_val, replace_val, stem)
                    else:
                        stem = stem.replace(find_val, replace_val)
                except Exception:
                    pass

            # 2. Case transformation
            if case_opt == "lowercase":
                stem = stem.lower()
            elif case_opt == "UPPERCASE":
                stem = stem.upper()
            elif case_opt == "Title Case":
                stem = stem.title()

            # 3. Numbering
            num_str = f"_{str(count).zfill(pad)}" if add_numbering else ""

            # 4. Prefix & Suffix
            new_name = f"{prefix}{stem}{suffix}{num_str}{ext}"
            self.renamer_plan.append((file_path, new_name))

            if new_name != file_path.name:
                changed_count += 1
                lines.append(f"{file_path.name:<45} -> {new_name}")
            else:
                lines.append(f"{file_path.name:<45} -> [Unchanged]")

            count += 1

        lines.append("-" * 100)
        lines.append(f"Summary: {changed_count} files will be renamed, {len(self.renamer_staged_files) - changed_count} files unchanged.\n")

        self.renamer_table_box.delete("1.0", "end")
        self.renamer_table_box.insert("1.0", "\n".join(lines))

    def _execute_batch_rename(self):
        if not self.renamer_plan:
            messagebox.showwarning("No Plan", "Please scan a directory and check the preview first.")
            return

        changed_items = [(old, new) for old, new in self.renamer_plan if old.name != new]
        if not changed_items:
            messagebox.showinfo("Nothing to Rename", "All files in the current preview are already named accordingly.")
            return

        confirm = messagebox.askyesno(
            "Confirm Batch Rename",
            f"Are you sure you want to rename {len(changed_items)} files?\nThis operation will modify file names on disk."
        )
        if not confirm:
            return

        renamed_count = 0
        errors = []

        for old_path, new_name in changed_items:
            new_path = old_path.parent / new_name
            if new_path.exists() and new_path != old_path:
                errors.append(f"Skipped '{old_path.name}': Target '{new_name}' already exists.")
                continue

            try:
                old_path.rename(new_path)
                renamed_count += 1
            except Exception as exc:
                errors.append(f"Failed '{old_path.name}': {exc}")

        # Rescan to refresh UI state
        self._scan_renamer_files()

        msg = f"Successfully renamed {renamed_count} files!"
        if errors:
            msg += f"\n\nWarnings/Errors ({len(errors)}):\n" + "\n".join(errors[:5])
        messagebox.showinfo("Batch Rename Complete", msg)

    # =====================================================
    # TAB 3: BYOK Settings UI
    # =====================================================
    def _build_settings_tab(self):
        self.settings_frame.grid_columnconfigure(0, weight=1)

        title = ctk.CTkLabel(self.settings_frame, text="Bring Your Own Key (BYOK) Configuration", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", pady=(0, 4))

        desc = ctk.CTkLabel(
            self.settings_frame,
            text="Credentials are saved locally in config.json with POSIX 0o600 permissions. Zero telemetry sent to external servers.",
            font=ctk.CTkFont(size=12),
            text_color="#94a3b8"
        )
        desc.pack(anchor="w", pady=(0, 20))

        card = ctk.CTkFrame(self.settings_frame, fg_color="#161f30", corner_radius=12)
        card.pack(fill="x", padx=2, pady=(0, 16))

        prov_label = ctk.CTkLabel(card, text="Default Active AI Provider:", font=ctk.CTkFont(size=13, weight="bold"))
        prov_label.pack(anchor="w", padx=20, pady=(16, 6))

        self.provider_dropdown = ctk.CTkOptionMenu(
            card,
            values=["Groq", "OpenAI"],
            height=36,
            command=self._on_provider_changed
        )
        self.provider_dropdown.pack(fill="x", padx=20, pady=(0, 8))

        self.provider_hint = ctk.CTkLabel(
            card,
            text="⚡ Provider: Groq (Ultra-fast LPU inference)",
            font=ctk.CTkFont(size=11),
            text_color="#38bdf8"
        )
        self.provider_hint.pack(anchor="w", padx=20, pady=(0, 14))

        # Configurable & Auto-Discovered Model Selector
        model_sec_label = ctk.CTkLabel(card, text="AI Model Identifier (Auto-Discovered or Custom):", font=ctk.CTkFont(size=13, weight="bold"))
        model_sec_label.pack(anchor="w", padx=20, pady=(0, 6))

        model_box_frame = ctk.CTkFrame(card, fg_color="transparent")
        model_box_frame.pack(fill="x", padx=20, pady=(0, 6))
        model_box_frame.grid_columnconfigure(0, weight=1)

        self.model_combo = ctk.CTkComboBox(
            model_box_frame,
            values=[
                "llama-3.1-8b-instant",
                "llama-3.3-70b-versatile",
                "llama-3.1-70b-versatile",
                "mixtral-8x7b-32768",
                "gemma2-9b-it"
            ],
            height=36,
            font=ctk.CTkFont(family="Consolas", size=12),
            command=self._on_model_changed
        )
        self.model_combo.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        if hasattr(self.model_combo, "_entry"):
            self.model_combo._entry.bind("<FocusOut>", lambda e: self._on_model_entry_changed())
            self.model_combo._entry.bind("<Return>", lambda e: self._on_model_entry_changed())

        self.fetch_models_btn = ctk.CTkButton(
            model_box_frame,
            text="🔄 Fetch Available Models",
            width=180,
            height=36,
            fg_color="#334155",
            hover_color="#475569",
            command=self._fetch_available_models
        )
        self.fetch_models_btn.grid(row=0, column=1)

        self.model_status_label = ctk.CTkLabel(
            card,
            text="Tip: Click 'Fetch Available Models' to query live active models from Groq /models, or type any ID.",
            font=ctk.CTkFont(size=11),
            text_color="#94a3b8"
        )
        self.model_status_label.pack(anchor="w", padx=20, pady=(0, 16))

        key_label = ctk.CTkLabel(card, text="API Secret Key:", font=ctk.CTkFont(size=13, weight="bold"))
        key_label.pack(anchor="w", padx=20, pady=(0, 6))

        key_input_frame = ctk.CTkFrame(card, fg_color="transparent")
        key_input_frame.pack(fill="x", padx=20, pady=(0, 16))
        key_input_frame.grid_columnconfigure(0, weight=1)

        self.api_key_entry = ctk.CTkEntry(
            key_input_frame,
            placeholder_text="Enter gsk_... or sk-...",
            show="*",
            font=ctk.CTkFont(family="Consolas", size=12),
            height=36
        )
        self.api_key_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        self.show_key_btn = ctk.CTkButton(
            key_input_frame,
            text="👁️ Show",
            width=75,
            height=36,
            fg_color="#334155",
            hover_color="#475569",
            command=self._toggle_key_visibility
        )
        self.show_key_btn.grid(row=0, column=1)

        action_frame = ctk.CTkFrame(card, fg_color="transparent")
        action_frame.pack(fill="x", padx=20, pady=(0, 20))

        self.save_key_btn = ctk.CTkButton(
            action_frame,
            text="💾 Save & Validate Key",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            height=38,
            command=self._save_and_validate_key
        )
        self.save_key_btn.pack(side="left", padx=(0, 14))

        self.key_validation_status_label = ctk.CTkLabel(
            action_frame,
            text="Status: Unchecked",
            font=ctk.CTkFont(size=12),
            text_color="#94a3b8"
        )
        self.key_validation_status_label.pack(side="left")

        # Security & Architecture Card
        sec_card = ctk.CTkFrame(self.settings_frame, fg_color="#101726", corner_radius=12)
        sec_card.pack(fill="x", padx=2)

        sec_title = ctk.CTkLabel(sec_card, text="🛡️ BYOK Security Invariants & Model Details", font=ctk.CTkFont(size=13, weight="bold"))
        sec_title.pack(anchor="w", padx=20, pady=(16, 8))

        sec_text = (
            "• Groq Active Model: llama-3.1-8b-instant (128k context window, sub-200ms latency)\n"
            "• OpenAI Active Model: gpt-4o-mini\n"
            "• Local Path: config.json (chmod 0600 user-owner locked permissions)\n"
            "• Groq Console: Obtain free API keys from https://console.groq.com"
        )
        sec_desc = ctk.CTkLabel(sec_card, text=sec_text, font=ctk.CTkFont(size=11), text_color="#94a3b8", justify="left")
        sec_desc.pack(anchor="w", padx=20, pady=(0, 16))

    def _load_settings_into_ui(self):
        active_provider = self.config_manager.get_active_provider()
        self.provider_dropdown.set("OpenAI" if active_provider == "openai" else "Groq")

        saved_key = self.config_manager.get_api_key(active_provider) or ""
        self.api_key_entry.delete(0, "end")
        self.api_key_entry.insert(0, saved_key)

        current_model = self.config_manager.get_model(active_provider)
        self.model_combo.set(current_model)

        if active_provider == "groq":
            self.provider_hint.configure(text="⚡ Provider: Groq (Ultra-fast LPU inference)")
        else:
            self.provider_hint.configure(text="⚡ Provider: OpenAI")

        if self.config_manager.has_valid_key(active_provider):
            self.key_validation_status_label.configure(text="✓ Key is Configured & Ready", text_color="#10b981")
        else:
            self.key_validation_status_label.configure(text="○ No Valid Key Configured", text_color="#f59e0b")

    def _on_provider_changed(self, choice: str):
        provider = "openai" if "OpenAI" in choice else "groq"
        self.config_manager.set_active_provider(provider)
        saved_key = self.config_manager.get_api_key(provider) or ""
        self.api_key_entry.delete(0, "end")
        self.api_key_entry.insert(0, saved_key)

        model = self.config_manager.get_model(provider)
        if provider == "groq":
            self.model_combo.configure(values=[
                "llama-3.1-8b-instant",
                "llama-3.3-70b-versatile",
                "llama-3.1-70b-versatile",
                "mixtral-8x7b-32768",
                "gemma2-9b-it"
            ])
            self.provider_hint.configure(text="⚡ Provider: Groq (Ultra-fast LPU inference)")
        else:
            self.model_combo.configure(values=[
                "gpt-4o-mini",
                "gpt-4o",
                "gpt-3.5-turbo"
            ])
            self.provider_hint.configure(text="⚡ Provider: OpenAI")
        self.model_combo.set(model)
        self._update_sidebar_status()

    def _fetch_available_models(self):
        key = self.api_key_entry.get().strip()
        choice = self.provider_dropdown.get()
        provider = "openai" if "OpenAI" in choice else "groq"

        if not key:
            messagebox.showwarning("API Key Required", f"Please enter a {provider.upper()} API key first to discover available models.")
            return

        self.fetch_models_btn.configure(state="disabled", text="⏳ Querying...")
        self.model_status_label.configure(text=f"Querying {provider.upper()} /models endpoint...", text_color="#38bdf8")

        def worker():
            try:
                handler = AIHandler(api_key=key, provider=provider)
                models = handler.get_available_models()
                self.after(0, lambda m=models, p=provider: self._on_models_fetched(m, p))
            except Exception as exc:
                self.after(0, lambda e=str(exc): self._on_models_fetch_failed(e))

        threading.Thread(target=worker, daemon=True).start()

    def _on_models_fetched(self, models: list, provider: str):
        self.fetch_models_btn.configure(state="normal", text="🔄 Fetch Available Models")
        if models:
            self.model_combo.configure(values=models)
            current = self.model_combo.get().strip()
            if not current or current not in models:
                self.model_combo.set(models[0])
                self.config_manager.set_model(provider, models[0])
            else:
                self.config_manager.set_model(provider, current)
            self._update_ai_tab_badge()
            self.model_status_label.configure(
                text=f"✓ Discovered {len(models)} active chat models from {provider.upper()} /models (Saved choice)",
                text_color="#10b981"
            )
            sample_preview = "\n".join(models[:6]) + ("\n..." if len(models) > 6 else "")
            messagebox.showinfo("Models Discovered", f"Retrieved {len(models)} available models from {provider.upper()}:\n\n{sample_preview}")
        else:
            self.model_status_label.configure(text="No models returned from provider.", text_color="#f59e0b")

    def _on_model_changed(self, choice: str):
        choice = choice.strip()
        if choice:
            provider = "openai" if "OpenAI" in self.provider_dropdown.get() else "groq"
            self.config_manager.set_model(provider, choice)
            self._update_ai_tab_badge()

    def _on_model_entry_changed(self):
        val = self.model_combo.get().strip()
        if val:
            provider = "openai" if "OpenAI" in self.provider_dropdown.get() else "groq"
            self.config_manager.set_model(provider, val)
            self._update_ai_tab_badge()

    def _on_models_fetch_failed(self, error: str):
        self.fetch_models_btn.configure(state="normal", text="🔄 Fetch Available Models")
        self.model_status_label.configure(text=f"Failed to fetch models: {error}", text_color="#ef4444")
        messagebox.showerror("Discovery Error", f"Failed to fetch models:\n{error}")

    def _toggle_key_visibility(self):
        self.show_api_key = not self.show_api_key
        self.api_key_entry.configure(show="" if self.show_api_key else "*")
        self.show_key_btn.configure(text="🔒 Hide" if self.show_api_key else "👁️ Show")

    def _save_and_validate_key(self):
        key = self.api_key_entry.get().strip()
        choice = self.provider_dropdown.get()
        provider = "openai" if "OpenAI" in choice else "groq"
        chosen_model = self.model_combo.get().strip()

        if not key:
            messagebox.showwarning("Empty Key", "Please enter an API key.")
            return

        if not chosen_model:
            chosen_model = "llama-3.1-8b-instant" if provider == "groq" else "gpt-4o-mini"
            self.model_combo.set(chosen_model)

        try:
            self.config_manager.save_api_key(key, provider=provider)
            self.config_manager.set_model(provider, chosen_model)
            self._update_sidebar_status()
        except ConfigError as exc:
            messagebox.showerror("Config Error", str(exc))
            return

        self.key_validation_status_label.configure(text=f"⏳ Probing [{chosen_model}]...", text_color="#38bdf8")
        self.save_key_btn.configure(state="disabled")

        def worker():
            handler = AIHandler(api_key=key, provider=provider, model=chosen_model)
            is_valid = handler.validate_api_key()
            effective_model = handler.model
            self.after(0, lambda iv=is_valid, p=provider, em=effective_model: self._on_validation_result(iv, p, em))

        threading.Thread(target=worker, daemon=True).start()

    def _on_validation_result(self, is_valid: bool, provider: str, effective_model: str):
        self.save_key_btn.configure(state="normal")
        if is_valid:
            if effective_model != self.model_combo.get().strip():
                self.model_combo.set(effective_model)
                self.config_manager.set_model(provider, effective_model)
            self.key_validation_status_label.configure(text=f"✓ Key & Model Verified ({provider.upper()} [{effective_model}])", text_color="#10b981")
            messagebox.showinfo("Success", f"{provider.upper()} API Key saved and verified with model:\n{effective_model}")
        else:
            self.key_validation_status_label.configure(text=f"✗ Invalid Key / Model", text_color="#ef4444")
            messagebox.showerror("Error", "The API key or model was rejected by provider.")
        self._update_sidebar_status()
        self._update_ai_tab_badge()

    # =====================================================
    # TAB 4: AI Assistant UI
    # =====================================================
    def _build_ai_tab(self):
        self.ai_frame.grid_columnconfigure(0, weight=1)

        title = ctk.CTkLabel(self.ai_frame, text="AI Developer Assistant", font=ctk.CTkFont(size=20, weight="bold"))
        title.pack(anchor="w", pady=(0, 2))

        self.ai_model_badge = ctk.CTkLabel(
            self.ai_frame,
            text="Active Provider Engine: Groq [llama-3.1-8b-instant]",
            font=ctk.CTkFont(size=12),
            text_color="#38bdf8"
        )
        self.ai_model_badge.pack(anchor="w", pady=(0, 10))

        task_bar = ctk.CTkFrame(self.ai_frame, fg_color="#161f30", corner_radius=10)
        task_bar.pack(fill="x", padx=2, pady=(0, 12))

        bar_inner = ctk.CTkFrame(task_bar, fg_color="transparent")
        bar_inner.pack(fill="x", padx=14, pady=10)

        self.ai_task_choice = ctk.CTkSegmentedButton(
            bar_inner,
            values=["Summarize Code", "Commit Message", "File Renamer", "Custom Prompt"],
            font=ctk.CTkFont(size=12),
            command=self._on_task_choice_changed
        )
        self.ai_task_choice.set("Summarize Code")
        self.ai_task_choice.pack(side="left")

        self.run_ai_btn = ctk.CTkButton(
            bar_inner,
            text="🚀 Execute AI Task",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color="#8b5cf6",
            hover_color="#7c3aed",
            height=34,
            command=self._start_ai_task_thread
        )
        self.run_ai_btn.pack(side="right")

        split_frame = ctk.CTkFrame(self.ai_frame, fg_color="transparent")
        split_frame.pack(fill="both", expand=True, padx=2)
        split_frame.grid_columnconfigure(0, weight=1)
        split_frame.grid_columnconfigure(1, weight=1)
        split_frame.grid_rowconfigure(1, weight=1)

        in_header = ctk.CTkFrame(split_frame, fg_color="transparent")
        in_header.grid(row=0, column=0, sticky="ew", padx=(0, 8), pady=(0, 6))
        self.input_header_label = ctk.CTkLabel(in_header, text="Input Code / Prompt:", font=ctk.CTkFont(size=12, weight="bold"))
        self.input_header_label.pack(side="left")

        load_sample_btn = ctk.CTkButton(
            in_header,
            text="Load Sample",
            width=80,
            height=24,
            font=ctk.CTkFont(size=11),
            fg_color="#334155",
            hover_color="#475569",
            command=self._load_sample_ai_input
        )
        load_sample_btn.pack(side="right")

        self.ai_input_box = ctk.CTkTextbox(
            split_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color="#0b101c",
            text_color="#e2e8f0",
            corner_radius=10,
            wrap="word"
        )
        self.ai_input_box.grid(row=1, column=0, sticky="nsew", padx=(0, 8))

        out_header = ctk.CTkFrame(split_frame, fg_color="transparent")
        out_header.grid(row=0, column=1, sticky="ew", padx=(8, 0), pady=(0, 6))
        ctk.CTkLabel(out_header, text="AI Output:", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left")

        save_btn = ctk.CTkButton(
            out_header,
            text="💾 Save",
            width=65,
            height=24,
            font=ctk.CTkFont(size=11),
            fg_color="#334155",
            hover_color="#475569",
            command=self._save_ai_output_to_file
        )
        save_btn.pack(side="right", padx=(4, 0))

        copy_btn = ctk.CTkButton(
            out_header,
            text="📋 Copy",
            width=65,
            height=24,
            font=ctk.CTkFont(size=11),
            fg_color="#334155",
            hover_color="#475569",
            command=self._copy_ai_output
        )
        copy_btn.pack(side="right")

        self.ai_output_box = ctk.CTkTextbox(
            split_frame,
            font=ctk.CTkFont(family="Arial", size=12),
            fg_color="#0b101c",
            text_color="#e2e8f0",
            corner_radius=10,
            wrap="word"
        )
        self.ai_output_box.grid(row=1, column=1, sticky="nsew", padx=(8, 0))

        self._load_sample_ai_input()

    def _update_ai_tab_badge(self):
        prov = self.config_manager.get_active_provider()
        model = self.config_manager.get_model(prov)
        if hasattr(self, "ai_model_badge"):
            self.ai_model_badge.configure(text=f"Active Provider Engine: {prov.upper()} [{model}]")

    def _on_task_choice_changed(self, value: str):
        self._load_sample_ai_input()

    def _load_sample_ai_input(self):
        task = self.ai_task_choice.get()
        self.ai_input_box.delete("1.0", "end")

        if task == "Summarize Code":
            sample = (
                "def auto_disambiguate_filename(target_folder: Path, file_name: str) -> Path:\n"
                "    candidate = target_folder / file_name\n"
                "    if not candidate.exists():\n"
                "        return candidate\n"
                "    stem, suffix = candidate.stem, candidate.suffix\n"
                "    counter = 1\n"
                "    while True:\n"
                "        new_path = target_folder / f'{stem} ({counter}){suffix}'\n"
                "        if not new_path.exists():\n"
                "            return new_path\n"
                "        counter += 1\n"
            )
            self.ai_input_box.insert("1.0", sample)
        elif task == "Commit Message":
            sample = (
                "diff --git a/file_organizer.py b/file_organizer.py\n"
                "--- a/file_organizer.py\n"
                "+++ b/file_organizer.py\n"
                "@@ -134,3 +134,3 @@ class FileOrganizer:\n"
                "-    def organize(self, target_dir, dry_run=False, categorize_unknown=False, ...):\n"
                "+    def organize(self, target_dir: str | Path, dry_run: bool = False) -> OrganizationResult:\n"
            )
            self.ai_input_box.insert("1.0", sample)
        elif task == "File Renamer":
            self.ai_input_box.insert("1.0", "Screenshot 2026-03-29 at 11.23.41 PM.png\nContext: User dashboard showing authenticated session tokens and API keys.")
        else:
            self.ai_input_box.insert("1.0", "Explain the difference between threading and multiprocessing in Python when doing disk I/O vs CPU-bound tasks.")

    def _copy_ai_output(self):
        output = self.ai_output_box.get("1.0", "end").strip()
        if output:
            self.clipboard_clear()
            self.clipboard_append(output)
            messagebox.showinfo("Copied", "Copied to clipboard!")

    def _save_ai_output_to_file(self):
        output = self.ai_output_box.get("1.0", "end").strip()
        if not output:
            messagebox.showwarning("Empty Output", "No output to save.")
            return

        file_path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Text File", "*.txt"), ("Markdown", "*.md"), ("Python File", "*.py"), ("All Files", "*.*")]
        )
        if file_path:
            try:
                Path(file_path).write_text(output, encoding="utf-8")
                messagebox.showinfo("Saved", f"Output saved to:\n{file_path}")
            except Exception as exc:
                messagebox.showerror("Save Failed", str(exc))

    def _start_ai_task_thread(self):
        if self.is_processing:
            return

        provider = self.config_manager.get_active_provider()
        api_key = self.config_manager.get_api_key(provider)

        if not api_key:
            messagebox.showerror("Key Required", f"No API key configured for {provider.upper()}.\nGo to BYOK Settings to save your key.")
            self._select_tab("settings")
            return

        user_input = self.ai_input_box.get("1.0", "end").strip()
        if not user_input:
            messagebox.showwarning("Empty", "Please provide input.")
            return

        task = self.ai_task_choice.get()
        self.is_processing = True
        self.run_ai_btn.configure(state="disabled", text="⏳ Thinking...")
        active_model = self.config_manager.get_model(provider)
        self.ai_output_box.delete("1.0", "end")
        self.ai_output_box.insert("1.0", f"Querying {provider.upper()} [{active_model}] ({task})...\n")

        def worker():
            try:
                handler = AIHandler(api_key=api_key, provider=provider, model=active_model)
                if task == "Summarize Code":
                    result = handler.summarize_code(user_input)
                elif task == "Commit Message":
                    result = handler.generate_git_commit(user_input)
                elif task == "File Renamer":
                    result = handler.suggest_file_names("file", user_input)
                else:
                    result = handler.execute_prompt(user_input)
                effective_model = handler.model
                if effective_model != active_model:
                    self.config_manager.set_model(provider, effective_model)
                self.after(0, lambda rt=result, em=effective_model: self._on_ai_task_complete(rt, em))
            except Exception as exc:
                err_msg = str(exc)
                self.after(0, lambda m=err_msg: self._on_ai_task_error(m))

        threading.Thread(target=worker, daemon=True).start()

    def _on_ai_task_complete(self, result_text: str, effective_model: str = ""):
        self.is_processing = False
        self.run_ai_btn.configure(state="normal", text="🚀 Execute AI Task")
        self.ai_output_box.delete("1.0", "end")
        self.ai_output_box.insert("1.0", result_text)
        if effective_model:
            self._update_ai_tab_badge()

    def _on_ai_task_error(self, error_message: str):
        self.is_processing = False
        self.run_ai_btn.configure(state="normal", text="🚀 Execute AI Task")
        self.ai_output_box.delete("1.0", "end")
        self.ai_output_box.insert("1.0", f"Error:\n{error_message}")
        messagebox.showerror("AI Error", error_message)


def main():
    app = SuraDesktopApp()
    app.mainloop()


if __name__ == "__main__":
    main()