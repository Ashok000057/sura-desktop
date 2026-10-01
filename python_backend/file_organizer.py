"""
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

# Configure lightweight internal logger
logger = logging.getLogger("DevPulse.FileOrganizer")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


class FileOrganizerError(Exception):
    """Custom exception raised for unrecoverable organizer errors."""
    pass


@dataclass
class MoveRecord:
    """Represents a single file migration event for reporting and undo capability."""
    source_path: str
    destination_path: str
    category: str
    file_size_bytes: int
    was_renamed: bool = False
    original_target_name: Optional[str] = None


@dataclass
class OrganizationResult:
    """Summary result returned after directory scan and sorting operation."""
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

    # Standard industry extension-to-category directory mappings
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
        """
        Initialize the file organizer.
        
        Args:
            custom_categories: Optional dict overriding or augmenting default extension maps.
            skip_hidden: If True, skips dotfiles and hidden system files.
            undo_log_name: File name where move manifests are recorded for rollback.
        """
        self.categories = self.DEFAULT_CATEGORIES.copy()
        if custom_categories:
            for cat, exts in custom_categories.items():
                self.categories[cat] = {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in exts}

        self.skip_hidden = skip_hidden
        self.undo_log_name = undo_log_name

        # Invert category map for O(1) extension lookup: { '.png': 'Images', ... }
        self._extension_map: Dict[str, str] = {}
        for category, extensions in self.categories.items():
            for ext in extensions:
                self._extension_map[ext.lower()] = category

    def determine_category(self, file_path: Path) -> Optional[str]:
        """
        Determine target category based on file suffix. Returns None if unmapped.
        """
        suffix = file_path.suffix.lower()
        return self._extension_map.get(suffix)

    def _resolve_unique_destination(self, target_folder: Path, file_name: str) -> Tuple[Path, bool]:
        """
        Handles duplicate name collisions cleanly.
        If 'report.pdf' exists, generates 'report (1).pdf', 'report (2).pdf', etc.
        
        Returns:
            Tuple[Path, bool]: (unique_destination_path, was_renamed)
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
        """
        Scan target directory and move files into organized category folders.
        
        Args:
            target_dir: Target path (e.g. ~/Downloads or ~/Desktop).
            dry_run: If True, simulates moves without touching the filesystem.
            categorize_unknown: If True, moves unmapped files into 'Miscellaneous'.
            unknown_folder_name: Folder name for unmapped files.
            
        Returns:
            OrganizationResult: Full metrics and operational audit log.
            
        Raises:
            FileOrganizerError: If directory is missing or unreadable.
        """
        source_path = Path(target_dir).expanduser().resolve()

        # Edge Case 1: Missing Source Directory
        if not source_path.exists():
            raise FileOrganizerError(f"Target directory does not exist: {source_path}")
        if not source_path.is_dir():
            raise FileOrganizerError(f"Target path is a file, not a directory: {source_path}")

        result = OrganizationResult(
            target_directory=str(source_path),
            dry_run=dry_run
        )

        # Set of folder names that we create or manage, to avoid sorting folders into themselves
        reserved_folder_names = set(self.categories.keys())
        if categorize_unknown:
            reserved_folder_names.add(unknown_folder_name)

        # Edge Case 2: Read permissions error on source directory
        try:
            entries = list(source_path.iterdir())
        except PermissionError as exc:
            raise FileOrganizerError(f"Permission denied accessing directory {source_path}: {exc}") from exc
        except OSError as exc:
            raise FileOrganizerError(f"OS error scanning directory {source_path}: {exc}") from exc

        # Iterate only files in the root of target directory (non-recursive to avoid corrupting nested projects)
        for item in entries:
            # Skip subdirectories (especially our own category folders)
            if item.is_dir():
                continue

            # Skip hidden / system files if configured
            if self.skip_hidden and item.name.startswith("."):
                result.total_files_skipped += 1
                continue

            # Skip the undo log file itself
            if item.name == self.undo_log_name:
                continue

            result.total_files_scanned += 1

            # Determine category
            category = self.determine_category(item)
            if not category:
                if categorize_unknown:
                    category = unknown_folder_name
                else:
                    # Unrecognized file remains untouched in root
                    result.total_files_skipped += 1
                    continue

            dest_folder = source_path / category

            # Edge Case 3: Destination collision resolution
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

            # If dry run, record expected move and continue
            if dry_run:
                result.moved_records.append(record)
                result.total_files_moved += 1
                if category not in result.categories_created:
                    result.categories_created.append(category)
                continue

            # Execute real migration
            try:
                # Edge Case 4: Destination folder creation
                dest_folder.mkdir(parents=True, exist_ok=True)
                if category not in result.categories_created:
                    result.categories_created.append(category)

                # Move file safely
                shutil.move(str(item), str(dest_file))
                result.moved_records.append(record)
                result.total_files_moved += 1

            except PermissionError as exc:
                # Edge Case 5: Permission error on specific file (file in use or read-only)
                logger.warning("Permission denied moving %s: %s", item.name, exc)
                result.errors.append({
                    "file": item.name,
                    "error": "Permission Denied (File may be open in another application or locked)"
                })
                result.total_files_skipped += 1

            except OSError as exc:
                # Edge Case 6: Generic disk/OS error on single file
                logger.error("OS error moving %s: %s", item.name, exc)
                result.errors.append({
                    "file": item.name,
                    "error": f"I/O Error: {str(exc)}"
                })
                result.total_files_skipped += 1

        # Save undo log if real files were moved
        if not dry_run and result.moved_records:
            self._write_undo_manifest(source_path, result)

        return result

    def _write_undo_manifest(self, base_dir: Path, result: OrganizationResult) -> None:
        """Save history file to allow rolling back the organization run."""
        history_path = base_dir / self.undo_log_name
        try:
            payload = {
                "timestamp": str(Path().stat().st_mtime if hasattr(Path(), "stat") else ""),
                "moves": [asdict(m) for m in result.moved_records]
            }
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except OSError:
            # Non-critical failure: don't crash if undo log cannot be written
            pass

    def revert_last_run(self, target_dir: str | Path) -> Tuple[int, List[str]]:
        """
        Reverts the last organization run using the local undo manifest.
        
        Returns:
            Tuple[int, List[str]]: (count_of_files_restored, list_of_errors)
        """
        source_path = Path(target_dir).expanduser().resolve()
        history_path = source_path / self.undo_log_name

        if not history_path.exists():
            raise FileOrganizerError(f"No undo history file found at {history_path}")

        try:
            with open(history_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as exc:
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

        # Remove undo log after reversion
        history_path.unlink(missing_ok=True)
        return restored_count, errors


# Self-test block when executed directly
if __name__ == "__main__":
    import tempfile
    
    print("[FileOrganizer] Running self-test in temporary directory...")
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        # Create test mock files
        (tmp / "test_script.py").write_text("print('hello')", encoding="utf-8")
        (tmp / "sample_doc.pdf").write_text("%PDF-1.4 dummy", encoding="utf-8")
        (tmp / "sample_doc (1).pdf").write_text("%PDF-1.4 duplicate", encoding="utf-8")
        (tmp / "holiday.jpg").write_text("image_bytes", encoding="utf-8")
        (tmp / "archive.zip").write_text("zip_bytes", encoding="utf-8")

        organizer = FileOrganizer()
        res = organizer.organize(tmp)
        print(f"Scanned: {res.total_files_scanned}, Moved: {res.total_files_moved}")
        print(f"Categories: {res.categories_created}")
        for m in res.moved_records:
            print(f"  -> {Path(m.source_path).name} => [{m.category}]/{Path(m.destination_path).name}")
