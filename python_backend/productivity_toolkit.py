#!/usr/bin/env python3
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
    # Support running from parent directory or packaging
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
        print("\n--- DevPulse BYOK Configuration Status ---")
        print(f"Config Directory : {config_mgr.config_dir}")
        print(f"Active Provider  : {active.upper()}")
        print(f"Groq API Key     : {'[Configured & Validated]' if has_groq else '[Not Set]'}")
        print(f"OpenAI API Key   : {'[Configured & Validated]' if has_openai else '[Not Set]'}")
        print("-------------------------------------------\n")
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
    print(f"\n{mode_label} Scanning and organizing: {target_path}")

    try:
        result = organizer.organize(
            target_dir=target_path,
            dry_run=args.dry_run,
            categorize_unknown=args.include_unknown
        )

        print("\n" + "=" * 55)
        print(f"  ORGANIZATION REPORT ({mode_label})")
        print("=" * 55)
        print(f"Files Scanned   : {result.total_files_scanned}")
        print(f"Files Moved     : {result.total_files_moved}")
        print(f"Files Skipped   : {result.total_files_skipped}")
        print(f"Categories Made : {', '.join(result.categories_created) if result.categories_created else 'None'}")
        
        if result.moved_records:
            print("\nMove Details:")
            for rec in result.moved_records[:15]:  # Preview first 15
                src_name = Path(rec.source_path).name
                dest_name = Path(rec.destination_path).name
                renamed_flag = f" [Renamed from '{rec.original_target_name}']" if rec.was_renamed else ""
                print(f"  • {src_name} -> [{rec.category}]/{dest_name}{renamed_flag}")
            if len(result.moved_records) > 15:
                print(f"  ... and {len(result.moved_records) - 15} more files.")

        if result.errors:
            print("\nEncountered Errors (Handled Gracefully):")
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
    
    # Requirement 1 Check: Verify valid key exists before running AI tasks
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
        # Task A: Code Summarization
        if args.summarize:
            file_path = Path(args.summarize)
            if not file_path.exists():
                print(f"✗ File not found: {file_path}", file=sys.stderr)
                return 1
            code_content = file_path.read_text(encoding="utf-8", errors="replace")
            print(f"\nAnalyzing code in {file_path.name} via {provider.upper()}...\n")
            summary = handler.summarize_code(code_content, language=file_path.suffix.lstrip("."))
            print(summary)
            return 0

        # Task B: Git Commit Generation
        if args.commit:
            diff_text = args.commit
            print(f"\nGenerating Conventional Commit message via {provider.upper()}...\n")
            msg = handler.generate_git_commit(diff_text)
            print(msg)
            return 0

        # Task C: General Prompt
        if args.prompt:
            print(f"\nExecuting prompt via {provider.upper()}...\n")
            output = handler.execute_prompt(args.prompt)
            print(output)
            return 0

        print("Please provide an AI action: --prompt, --summarize <FILE>, or --commit <DIFF>.")
        return 1

    except AuthenticationError as exc:
        print(f"\n✗ Authentication Failed: {exc}", file=sys.stderr)
        print("  Please verify your API key in config.json.", file=sys.stderr)
        return 1
    except RateLimitError as exc:
        print(f"\n✗ Rate Limit Exceeded: {exc}", file=sys.stderr)
        return 1
    except AIHandlerError as exc:
        print(f"\n✗ AI Task Error: {exc}", file=sys.stderr)
        return 1


def main() -> int:
    """Master CLI parser routing."""
    config_mgr = ConfigManager()

    parser = argparse.ArgumentParser(
        prog="productivity_toolkit",
        description="DevPulse Developer Productivity Toolkit (BYOK Model)"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # 1. Config Subcommand
    config_parser = subparsers.add_parser("config", help="Manage API keys and settings")
    config_parser.add_argument("--set-key", help="Save user API key")
    config_parser.add_argument("--provider", choices=["groq", "openai"], default="groq", help="AI provider")
    config_parser.add_argument("--delete-key", help="Delete API key for provider")
    config_parser.add_argument("--status", action="store_true", help="Print configuration status")

    # 2. File Organizer Subcommand
    organize_parser = subparsers.add_parser("organize", help="Scan and sort files by extension")
    organize_parser.add_argument("path", help="Target directory (e.g. ~/Downloads)")
    organize_parser.add_argument("--dry-run", action="store_true", help="Preview moves without touching files")
    organize_parser.add_argument("--revert", action="store_true", help="Undo previous organization run")
    organize_parser.add_argument("--include-unknown", action="store_true", help="Group unmapped files in Miscellaneous")

    # 3. AI Subcommand
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
