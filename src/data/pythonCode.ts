export interface CodeFile {
  name: string;
  language: string;
  description: string;
  content: string;
}

export const PYTHON_FILES: Record<string, CodeFile> = {
  "productivity_toolkit.py": {
    name: "productivity_toolkit.py",
    language: "python",
    description: "Main unified CLI entrypoint orchestrating config, organizer, and AI tasks.",
    content: `#!/usr/bin/env python3
"""
DevPulse Developer Productivity Toolkit
=======================================
A modular, production-ready desktop productivity backend following the
Bring-Your-Own-Key (BYOK) paradigm.

Components:
- ConfigManager: Secure credential persistence and validation.
- FileOrganizer: Resilient file sorting with duplicate disambiguation.
- AIHandler: Lightweight Groq/OpenAI client for developer workflows.

Usage Examples:
    python productivity_toolkit.py config --set-key gsk_abc123... --provider groq
    python productivity_toolkit.py config --status
    python productivity_toolkit.py organize ~/Downloads --dry-run
    python productivity_toolkit.py organize ~/Downloads
    python productivity_toolkit.py organize ~/Downloads --revert
    python productivity_toolkit.py ai summarize --file my_script.py
    python productivity_toolkit.py ai commit --diff "$(git diff)"
    python productivity_toolkit.py ai prompt "Explain Python memory management"
"""

from __future__ import annotations
import argparse
import sys
from pathlib import Path

# Local module imports
try:
    from config_manager import ConfigError, ConfigManager
    from file_organizer import FileOrganizer, FileOrganizerError
    from ai_handler import (
        AIHandler,
        AIHandlerError,
        AuthenticationError,
        RateLimitError,
        process_ai_text
    )
except ImportError:
    from .config_manager import ConfigError, ConfigManager
    from .file_organizer import FileOrganizer, FileOrganizerError
    from .ai_handler import (
        AIHandler,
        AIHandlerError,
        AuthenticationError,
        RateLimitError,
        process_ai_text
    )


def handle_config_command(args: argparse.Namespace, config_mgr: ConfigManager) -> int:
    """Handle config subcommand actions."""
    if args.set_key:
        provider = args.provider or "groq"
        try:
            config_mgr.save_api_key(args.set_key, provider=provider)
            print(f"✓ Successfully saved API key for provider: {provider.upper()}")
            print(f"  Configuration file: {config_mgr.config_file}")
            return 0
        except ConfigError as exc:
            print(f"✗ Failed to save API key: {exc}", file=sys.stderr)
            return 1

    if args.delete_key:
        provider = args.delete_key.lower()
        if config_mgr.delete_api_key(provider):
            print(f"✓ Removed API key for {provider.upper()}.")
        else:
            print(f"! No key found for {provider.upper()}.")
        return 0

    if args.status:
        active = config_mgr.get_active_provider()
        has_groq = config_mgr.has_valid_key("groq")
        has_openai = config_mgr.has_valid_key("openai")
        print("\\n--- DevPulse BYOK Configuration Status ---")
        print(f"Config Directory : {config_mgr.config_dir}")
        print(f"Active Provider  : {active.upper()}")
        print(f"Groq API Key     : {'[Configured & Validated]' if has_groq else '[Not Set]'}")
        print(f"OpenAI API Key   : {'[Configured & Validated]' if has_openai else '[Not Set]'}")
        print("-------------------------------------------\\n")
        return 0

    print("Please specify an action (e.g., --status, --set-key <KEY>). Use --help for options.")
    return 1


def handle_organize_command(args: argparse.Namespace) -> int:
    """Handle directory organization actions."""
    organizer = FileOrganizer()
    target_path = Path(args.path).expanduser().resolve()

    if args.revert:
        print(f"Reverting last organization run in {target_path}...")
        try:
            restored, errors = organizer.revert_last_run(target_path)
            print(f"✓ Reverted {restored} files back to source positions.")
            if errors:
                print("Warnings encountered during rollback:")
                for err in errors:
                    print(f"  - {err}")
            return 0
        except FileOrganizerError as exc:
            print(f"✗ Rollback failed: {exc}", file=sys.stderr)
            return 1

    mode_label = "[DRY RUN PREVIEW]" if args.dry_run else "[LIVE RUN]"
    print(f"\\n{mode_label} Scanning and organizing: {target_path}")

    try:
        result = organizer.organize(
            target_dir=target_path,
            dry_run=args.dry_run,
            categorize_unknown=args.include_unknown
        )

        print("\\n" + "=" * 55)
        print(f"  ORGANIZATION REPORT ({mode_label})")
        print("=" * 55)
        print(f"Files Scanned   : {result.total_files_scanned}")
        print(f"Files Moved     : {result.total_files_moved}")
        print(f"Files Skipped   : {result.total_files_skipped}")
        print(f"Categories Made : {', '.join(result.categories_created) if result.categories_created else 'None'}")
        
        if result.moved_records:
            print("\\nMove Details:")
            for rec in result.moved_records[:15]:
                src_name = Path(rec.source_path).name
                dest_name = Path(rec.destination_path).name
                renamed_flag = f" [Renamed from '{rec.original_target_name}']" if rec.was_renamed else ""
                print(f"  • {src_name} -> [{rec.category}]/{dest_name}{renamed_flag}")
            if len(result.moved_records) > 15:
                print(f"  ... and {len(result.moved_records) - 15} more files.")

        if result.errors:
            print("\\nEncountered Errors (Handled Gracefully):")
            for err in result.errors:
                print(f"  ✗ {err['file']}: {err['error']}")

        print("=" * 55)
        if args.dry_run:
            print("Note: No files were touched. Re-run without --dry-run to apply changes.")
        return 0

    except FileOrganizerError as exc:
        print(f"✗ Organization failed: {exc}", file=sys.stderr)
        return 1


def handle_ai_command(args: argparse.Namespace, config_mgr: ConfigManager) -> int:
    """Handle AI-powered developer utilities."""
    provider = args.provider or config_mgr.get_active_provider()
    
    if not config_mgr.has_valid_key(provider):
        print(f"✗ Error: No valid API key configured for provider '{provider}'.", file=sys.stderr)
        print(f"  Run: python {Path(__file__).name} config --set-key <YOUR_KEY> --provider {provider}", file=sys.stderr)
        return 1

    api_key = config_mgr.get_api_key(provider)
    if not api_key:
        print("✗ Internal Error: Unable to retrieve key from configuration.", file=sys.stderr)
        return 1

    handler = AIHandler(api_key=api_key, provider=provider)

    try:
        if args.summarize:
            file_path = Path(args.summarize)
            if not file_path.exists():
                print(f"✗ File not found: {file_path}", file=sys.stderr)
                return 1
            code_content = file_path.read_text(encoding="utf-8", errors="replace")
            print(f"\\nAnalyzing code in {file_path.name} via {provider.upper()}...\\n")
            summary = handler.summarize_code(code_content, language=file_path.suffix.lstrip("."))
            print(summary)
            return 0

        if args.commit:
            diff_text = args.commit
            print(f"\\nGenerating Conventional Commit message via {provider.upper()}...\\n")
            msg = handler.generate_git_commit(diff_text)
            print(msg)
            return 0

        if args.prompt:
            print(f"\\nExecuting prompt via {provider.upper()}...\\n")
            output = handler.execute_prompt(args.prompt)
            print(output)
            return 0

        print("Please provide an AI action: --prompt, --summarize <FILE>, or --commit <DIFF>.")
        return 1

    except AuthenticationError as exc:
        print(f"\\n✗ Authentication Failed: {exc}", file=sys.stderr)
        return 1
    except RateLimitError as exc:
        print(f"\\n✗ Rate Limit Exceeded: {exc}", file=sys.stderr)
        return 1
    except AIHandlerError as exc:
        print(f"\\n✗ AI Task Error: {exc}", file=sys.stderr)
        return 1


def main() -> int:
    """Master CLI parser routing."""
    config_mgr = ConfigManager()

    parser = argparse.ArgumentParser(
        prog="productivity_toolkit",
        description="DevPulse Developer Productivity Toolkit (BYOK Model)"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # Config Subcommand
    config_parser = subparsers.add_parser("config", help="Manage API keys and settings")
    config_parser.add_argument("--set-key", help="Save user API key")
    config_parser.add_argument("--provider", choices=["groq", "openai"], default="groq", help="AI provider")
    config_parser.add_argument("--delete-key", help="Delete API key for provider")
    config_parser.add_argument("--status", action="store_true", help="Print configuration status")

    # File Organizer Subcommand
    organize_parser = subparsers.add_parser("organize", help="Scan and sort files by extension")
    organize_parser.add_argument("path", help="Target directory (e.g. ~/Downloads)")
    organize_parser.add_argument("--dry-run", action="store_true", help="Preview moves without touching files")
    organize_parser.add_argument("--revert", action="store_true", help="Undo previous organization run")
    organize_parser.add_argument("--include-unknown", action="store_true", help="Group unmapped files in Miscellaneous")

    # AI Subcommand
    ai_parser = subparsers.add_parser("ai", help="Run BYOK AI-powered productivity tasks")
    ai_parser.add_argument("--prompt", help="Direct text prompt to LLM")
    ai_parser.add_argument("--summarize", help="Path to code file to summarize")
    ai_parser.add_argument("--commit", help="Git diff text to generate commit message")
    ai_parser.add_argument("--provider", choices=["groq", "openai"], help="Override active AI provider")

    args = parser.parse_args()

    if args.command == "config":
        return handle_config_command(args, config_mgr)
    elif args.command == "organize":
        return handle_organize_command(args)
    elif args.command == "ai":
        return handle_ai_command(args, config_mgr)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
`
  },

  "config_manager.py": {
    name: "config_manager.py",
    language: "python",
    description: "Config & API Key Manager with file security (chmod 0600) and regex format verification.",
    content: `"""
DevPulse Productivity Tool - Configuration & API Key Manager
Module: config_manager.py

Handles secure local storage, retrieval, and validation of user API keys (BYOK model)
and desktop application preferences.
"""

from __future__ import annotations
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional


class ConfigError(Exception):
    """Base exception for configuration and key management errors."""
    pass


class ConfigManager:
    """
    Manages local application configuration and BYOK (Bring Your Own Key) credentials.
    """

    DEFAULT_CONFIG: Dict[str, Any] = {
        "api_keys": {
            "groq": "",
            "openai": "",
            "gemini": ""
        },
        "active_provider": "groq",
        "file_organizer": {
            "dry_run_default": False,
            "auto_disambiguate_duplicates": True,
            "skip_hidden_files": True,
            "custom_extensions": {}
        },
        "theme": "dark"
    }

    KEY_PATTERNS = {
        "groq": r"^gsk_[a-zA-Z0-9]{30,}$",
        "openai": r"^sk-[a-zA-Z0-9_\\-]{30,}$",
        "gemini": r"^[a-zA-Z0-9_\\-]{30,}$"
    }

    def __init__(self, config_dir: Optional[str | Path] = None, filename: str = "config.json"):
        if config_dir:
            self.config_dir = Path(config_dir).resolve()
        else:
            self.config_dir = Path(__file__).parent.resolve()
            
        self.config_file = self.config_dir / filename
        self._ensure_config_exists()

    def _ensure_config_exists(self) -> None:
        try:
            self.config_dir.mkdir(parents=True, exist_ok=True)
            if not self.config_file.exists():
                self._write_raw_config(self.DEFAULT_CONFIG)
                self._apply_file_security()
        except OSError as exc:
            raise ConfigError(f"Failed to initialize configuration at {self.config_file}: {exc}") from exc

    def _apply_file_security(self) -> None:
        if os.name != 'nt' and self.config_file.exists():
            try:
                os.chmod(self.config_file, 0o600)
            except OSError:
                pass

    def _read_raw_config(self) -> Dict[str, Any]:
        if not self.config_file.exists():
            return self.DEFAULT_CONFIG.copy()

        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else self.DEFAULT_CONFIG.copy()
        except json.JSONDecodeError as exc:
            raise ConfigError(f"Corrupted config file at {self.config_file}. Invalid JSON: {exc}") from exc
        except OSError as exc:
            raise ConfigError(f"Permission or I/O error reading {self.config_file}: {exc}") from exc

    def _write_raw_config(self, data: Dict[str, Any]) -> None:
        temp_file = self.config_file.with_suffix(".tmp")
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            temp_file.replace(self.config_file)
            self._apply_file_security()
        except OSError as exc:
            if temp_file.exists():
                temp_file.unlink(missing_ok=True)
            raise ConfigError(f"Failed to write configuration: {exc}") from exc

    def save_api_key(self, api_key: str, provider: str = "groq") -> bool:
        provider = provider.lower().strip()
        cleaned_key = api_key.strip()
        
        if not cleaned_key:
            raise ConfigError("API Key cannot be blank.")

        config = self._read_raw_config()
        if "api_keys" not in config or not isinstance(config["api_keys"], dict):
            config["api_keys"] = {}

        config["api_keys"][provider] = cleaned_key
        config["active_provider"] = provider
        self._write_raw_config(config)
        return True

    def get_api_key(self, provider: Optional[str] = None) -> Optional[str]:
        config = self._read_raw_config()
        active = provider.lower().strip() if provider else config.get("active_provider", "groq")
        
        keys = config.get("api_keys", {})
        key = keys.get(active, "").strip()
        if key:
            return key

        env_map = {
            "groq": "GROQ_API_KEY",
            "openai": "OPENAI_API_KEY",
            "gemini": "GEMINI_API_KEY"
        }
        env_var = env_map.get(active)
        if env_var and os.environ.get(env_var):
            return os.environ[env_var].strip()

        return None

    def has_valid_key(self, provider: Optional[str] = None) -> bool:
        key = self.get_api_key(provider)
        if not key or len(key) < 12:
            return False

        config = self._read_raw_config()
        prov = (provider or config.get("active_provider", "groq")).lower().strip()
        pattern = self.KEY_PATTERNS.get(prov)
        if pattern:
            return bool(re.match(pattern, key))
            
        return len(key) >= 16

    def delete_api_key(self, provider: str) -> bool:
        provider = provider.lower().strip()
        config = self._read_raw_config()
        if "api_keys" in config and provider in config["api_keys"]:
            config["api_keys"][provider] = ""
            self._write_raw_config(config)
            return True
        return False

    def get_active_provider(self) -> str:
        config = self._read_raw_config()
        return config.get("active_provider", "groq")

    def set_active_provider(self, provider: str) -> None:
        provider = provider.lower().strip()
        config = self._read_raw_config()
        config["active_provider"] = provider
        self._write_raw_config(config)
`
  },

  "file_organizer.py": {
    name: "file_organizer.py",
    language: "python",
    description: "Resilient file sorting engine with duplicate disambiguation, dry-run, and rollback.",
    content: `"""
DevPulse Productivity Tool - Intelligent File Organization Engine
Module: file_organizer.py

Scans target directories (e.g., Downloads, Desktop) and sorts files into categorized
subdirectories based on file extensions. Engineered to withstand missing folders,
permission locks, duplicate naming conflicts, and hidden system files.
"""

from __future__ import annotations
import json
import logging
import os
import shutil
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger("DevPulse.FileOrganizer")


class FileOrganizerError(Exception):
    """Custom exception raised for unrecoverable organizer errors."""
    pass


@dataclass
class MoveRecord:
    source_path: str
    destination_path: str
    category: str
    file_size_bytes: int
    was_renamed: bool = False
    original_target_name: Optional[str] = None


@dataclass
class OrganizationResult:
    target_directory: str
    total_files_scanned: int = 0
    total_files_moved: int = 0
    total_files_skipped: int = 0
    moved_records: List[MoveRecord] = field(default_factory=list)
    errors: List[Dict[str, str]] = field(default_factory=list)
    dry_run: bool = False
    categories_created: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


class FileOrganizer:
    """
    Production-ready file sorter with resilient error handling and duplicate disambiguation.
    """

    DEFAULT_CATEGORIES: Dict[str, Set[str]] = {
        "Images": {
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff", ".heic"
        },
        "Documents": {
            ".pdf", ".docx", ".doc", ".txt", ".md", ".xlsx", ".xls", ".pptx", ".ppt",
            ".csv", ".rtf", ".odt", ".epub", ".pages"
        },
        "Code": {
            ".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".json", ".rs", ".go",
            ".cpp", ".c", ".h", ".hpp", ".java", ".sql", ".sh", ".bash", ".yaml", ".yml",
            ".toml", ".xml", ".lua", ".swift", ".kt", ".dart"
        },
        "Archives": {
            ".zip", ".tar", ".gz", ".rar", ".7z", ".bz2", ".xz", ".iso", ".tgz"
        },
        "Audio": {
            ".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma", ".aiff"
        },
        "Video": {
            ".mp4", ".mkv", ".mov", ".avi", ".webm", ".flv", ".wmv", ".m4v"
        },
        "Executables": {
            ".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm", ".appimage"
        }
    }

    def __init__(
        self,
        custom_categories: Optional[Dict[str, Set[str]]] = None,
        skip_hidden: bool = True,
        undo_log_name: str = ".devpulse_organize_history.json"
    ):
        self.categories = self.DEFAULT_CATEGORIES.copy()
        if custom_categories:
            for cat, exts in custom_categories.items():
                self.categories[cat] = {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in exts}

        self.skip_hidden = skip_hidden
        self.undo_log_name = undo_log_name

        self._extension_map: Dict[str, str] = {}
        for category, extensions in self.categories.items():
            for ext in extensions:
                self._extension_map[ext.lower()] = category

    def determine_category(self, file_path: Path) -> Optional[str]:
        suffix = file_path.suffix.lower()
        return self._extension_map.get(suffix)

    def _resolve_unique_destination(self, target_folder: Path, file_name: str) -> Tuple[Path, bool]:
        """
        Handles duplicate name collisions cleanly:
        If 'report.pdf' exists, creates 'report (1).pdf', 'report (2).pdf'.
        """
        candidate = target_folder / file_name
        if not candidate.exists():
            return candidate, False

        stem = candidate.stem
        suffix = candidate.suffix
        counter = 1

        while True:
            new_name = f"{stem} ({counter}){suffix}"
            candidate = target_folder / new_name
            if not candidate.exists():
                return candidate, True
            counter += 1

    def organize(
        self,
        target_dir: str | Path,
        dry_run: bool = False,
        categorize_unknown: bool = False,
        unknown_folder_name: str = "Miscellaneous"
    ) -> OrganizationResult:
        source_path = Path(target_dir).expanduser().resolve()

        if not source_path.exists():
            raise FileOrganizerError(f"Target directory does not exist: {source_path}")
        if not source_path.is_dir():
            raise FileOrganizerError(f"Target path is a file, not a directory: {source_path}")

        result = OrganizationResult(
            target_directory=str(source_path),
            dry_run=dry_run
        )

        try:
            entries = list(source_path.iterdir())
        except PermissionError as exc:
            raise FileOrganizerError(f"Permission denied accessing directory {source_path}: {exc}") from exc
        except OSError as exc:
            raise FileOrganizerError(f"OS error scanning directory {source_path}: {exc}") from exc

        for item in entries:
            if item.is_dir():
                continue

            if self.skip_hidden and item.name.startswith("."):
                result.total_files_skipped += 1
                continue

            if item.name == self.undo_log_name:
                continue

            result.total_files_scanned += 1

            category = self.determine_category(item)
            if not category:
                if categorize_unknown:
                    category = unknown_folder_name
                else:
                    result.total_files_skipped += 1
                    continue

            dest_folder = source_path / category
            dest_file, was_renamed = self._resolve_unique_destination(dest_folder, item.name)

            try:
                file_size = item.stat().st_size
            except (OSError, PermissionError):
                file_size = 0

            record = MoveRecord(
                source_path=str(item),
                destination_path=str(dest_file),
                category=category,
                file_size_bytes=file_size,
                was_renamed=was_renamed,
                original_target_name=item.name if was_renamed else None
            )

            if dry_run:
                result.moved_records.append(record)
                result.total_files_moved += 1
                if category not in result.categories_created:
                    result.categories_created.append(category)
                continue

            try:
                dest_folder.mkdir(parents=True, exist_ok=True)
                if category not in result.categories_created:
                    result.categories_created.append(category)

                shutil.move(str(item), str(dest_file))
                result.moved_records.append(record)
                result.total_files_moved += 1

            except PermissionError as exc:
                result.errors.append({
                    "file": item.name,
                    "error": "Permission Denied (File may be locked or open in another program)"
                })
                result.total_files_skipped += 1

            except OSError as exc:
                result.errors.append({
                    "file": item.name,
                    "error": f"I/O Error: {str(exc)}"
                })
                result.total_files_skipped += 1

        if not dry_run and result.moved_records:
            self._write_undo_manifest(source_path, result)

        return result

    def _write_undo_manifest(self, base_dir: Path, result: OrganizationResult) -> None:
        history_path = base_dir / self.undo_log_name
        try:
            payload = {
                "moves": [asdict(m) for m in result.moved_records]
            }
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except OSError:
            pass

    def revert_last_run(self, target_dir: str | Path) -> Tuple[int, List[str]]:
        source_path = Path(target_dir).expanduser().resolve()
        history_path = source_path / self.undo_log_name

        if not history_path.exists():
            raise FileOrganizerError(f"No undo history file found at {history_path}")

        try:
            with open(history_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            raise FileOrganizerError(f"Failed to read undo history: {exc}") from exc

        moves = data.get("moves", [])
        restored_count = 0
        errors: List[str] = []

        for item in reversed(moves):
            src = Path(item["destination_path"])
            dest = Path(item["source_path"])

            if not src.exists():
                errors.append(f"Cannot revert: File '{src.name}' missing from organized folder.")
                continue

            try:
                dest_file, _ = self._resolve_unique_destination(dest.parent, dest.name)
                shutil.move(str(src), str(dest_file))
                restored_count += 1
            except Exception as exc:
                errors.append(f"Failed to restore '{src.name}': {exc}")

        history_path.unlink(missing_ok=True)
        return restored_count, errors
`
  },

  "ai_handler.py": {
    name: "ai_handler.py",
    language: "python",
    description: "Lightweight BYOK AI caller using requests library for Groq and OpenAI models.",
    content: `"""
DevPulse Productivity Tool - AI Integration Handler (BYOK Model)
Module: ai_handler.py

Provides lightweight, direct HTTP integration using Python's standard \`requests\` library
to execute AI tasks (code summarization, text generation, git commits) using the user's
own API key (Groq or OpenAI).
"""

from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, Optional
import requests

logger = logging.getLogger("DevPulse.AIHandler")


class AIHandlerError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class AuthenticationError(AIHandlerError):
    """Raised when the provided API key is invalid or unauthorized (HTTP 401)."""
    pass


class RateLimitError(AIHandlerError):
    """Raised when provider rate limits or token quotas are exceeded (HTTP 429)."""
    pass


class AIHandler:
    """
    Lightweight client for Groq, OpenAI, and compatible AI completion endpoints.
    """

    PROVIDERS = {
        "groq": {
            "base_url": "https://api.groq.com/openai/v1/chat/completions",
            "default_model": "llama-3.3-70b-versatile",
            "name": "Groq Llama 3.3 (High Speed)"
        },
        "openai": {
            "base_url": "https://api.openai.com/v1/chat/completions",
            "default_model": "gpt-4o-mini",
            "name": "OpenAI GPT-4o Mini"
        }
    }

    def __init__(
        self,
        api_key: str,
        provider: str = "groq",
        model: Optional[str] = None,
        custom_base_url: Optional[str] = None,
        timeout: int = 25
    ):
        if not api_key or not api_key.strip():
            raise AuthenticationError("API key cannot be empty. Please configure your BYOK key first.")

        self.api_key = api_key.strip()
        self.provider = provider.lower().strip()
        self.timeout = timeout

        prov_meta = self.PROVIDERS.get(self.provider, self.PROVIDERS["groq"])
        self.endpoint_url = custom_base_url or prov_meta["base_url"]
        self.model = model or prov_meta["default_model"]

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "DevPulse-Desktop-Toolkit/1.0"
        }

    def execute_prompt(
        self,
        prompt: str,
        system_instruction: str = "You are an expert developer productivity assistant.",
        temperature: float = 0.5,
        max_tokens: int = 1024
    ) -> str:
        if not prompt or not prompt.strip():
            raise AIHandlerError("Prompt cannot be empty.")

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        try:
            response = requests.post(
                self.endpoint_url,
                headers=self._get_headers(),
                json=payload,
                timeout=self.timeout
            )
        except requests.exceptions.Timeout as exc:
            raise AIHandlerError(f"Request to {self.provider.title()} timed out after {self.timeout}s: {exc}") from exc
        except requests.exceptions.ConnectionError as exc:
            raise AIHandlerError(f"Failed to connect to {self.endpoint_url}. Check internet connection: {exc}") from exc
        except requests.exceptions.RequestException as exc:
            raise AIHandlerError(f"Unexpected network transport error: {exc}") from exc

        if response.status_code == 200:
            try:
                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    raise AIHandlerError("Provider returned 200 OK but with no response choices.")
                return choices[0]["message"]["content"].strip()
            except Exception as exc:
                raise AIHandlerError(f"Failed to parse provider response: {exc}") from exc

        error_msg = f"API Error (HTTP {response.status_code})"
        try:
            err_json = response.json()
            if "error" in err_json:
                error_msg = err_json["error"].get("message", error_msg)
        except Exception:
            error_msg = response.text[:300] or error_msg

        if response.status_code == 401:
            raise AuthenticationError(f"Authentication failed: Invalid {self.provider.title()} API key.", status_code=401)
        elif response.status_code == 429:
            raise RateLimitError(f"Rate limit exceeded or quota exhausted for {self.provider.title()}.", status_code=429)
        else:
            raise AIHandlerError(f"Provider error HTTP {response.status_code}: {error_msg}", status_code=response.status_code)

    def summarize_code(self, code_snippet: str, language: str = "python") -> str:
        system_instruction = (
            "You are a Senior Principal Software Engineer. Analyze the code snippet. "
            "Provide: 1) Executive summary (2 sentences), "
            "2) Key logic breakdown, "
            "3) Complexity / performance observations, "
            "4) Potential edge cases or bugs."
        )
        prompt = f"\`\`\`{language}\\n{code_snippet}\\n\`\`\`\\n\\nPlease summarize and review this code."
        return self.execute_prompt(prompt, system_instruction=system_instruction, temperature=0.2)

    def generate_git_commit(self, diff_text: str) -> str:
        system_instruction = (
            "You are a Git commit assistant. Follow the Conventional Commits specification "
            "(feat:, fix:, refactor:, chore:, docs:). Generate a concise 1-line subject line (<= 72 chars), "
            "followed by 2-3 bullet points."
        )
        prompt = f"Generate a commit message for the following git diff:\\n\\n{diff_text[:4000]}"
        return self.execute_prompt(prompt, system_instruction=system_instruction, temperature=0.3)


def process_ai_text(api_key: str, prompt: str, provider: str = "groq") -> str:
    handler = AIHandler(api_key=api_key, provider=provider)
    return handler.execute_prompt(prompt)
`
  },

  "requirements.txt": {
    name: "requirements.txt",
    language: "text",
    description: "Lightweight pip dependencies required to run the Python backend.",
    content: `requests>=2.31.0
# Optional enhancement packages:
# rich>=13.7.0          # For colorful terminal tables and progress spinners
# cryptography>=42.0.0  # For enterprise-grade AES config file encryption
`
  },

  "README.md": {
    name: "README.md",
    language: "markdown",
    description: "Complete architectural breakdown, CLI guide, and desktop GUI integration.",
    content: `# DevPulse Desktop Productivity Backend (BYOK Architecture)

A modular, production-ready Python backend engine for developer desktop productivity tools. Follows the **Bring Your Own Key (BYOK)** paradigm for local AI capabilities and includes a resilient, self-healing file organization engine.

---

## 1. System Requirements & Pip Installation

\`\`\`bash
# Minimal required package (for HTTP AI API calls)
pip install requests>=2.31.0

# Optional enhancements
pip install rich>=13.7.0
pip install cryptography>=42.0.0
\`\`\`

---

## 2. Architecture & File Breakdown

| File | Purpose | Key Classes & Methods |
| :--- | :--- | :--- |
| \`config_manager.py\` | Secure local credential & settings management | \`ConfigManager\`, \`save_api_key()\`, \`get_api_key()\`, \`has_valid_key()\` |
| \`file_organizer.py\` | Extension-based sorting & duplicate collision resolution | \`FileOrganizer\`, \`organize()\`, \`revert_last_run()\` |
| \`ai_handler.py\` | Lightweight Groq & OpenAI requests client | \`AIHandler\`, \`execute_prompt()\`, \`summarize_code()\` |
| \`productivity_toolkit.py\` | Master CLI interface and orchestrator | \`main()\`, \`handle_config_command()\`, \`handle_organize_command()\` |

---

## 3. Quick Start & CLI Usage

\`\`\`bash
# 1. Save your Groq API Key
python productivity_toolkit.py config --set-key gsk_yourGroqKey... --provider groq

# 2. Preview changes first without moving any files (Dry Run)
python productivity_toolkit.py organize ~/Downloads --dry-run

# 3. Execute live reorganization
python productivity_toolkit.py organize ~/Downloads

# 4. Undo / Rollback
python productivity_toolkit.py organize ~/Downloads --revert

# 5. Summarize code with AI
python productivity_toolkit.py ai summarize --file config_manager.py
\`\`\`
`
  }
};
