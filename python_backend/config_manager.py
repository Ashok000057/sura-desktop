"""
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
    
    Attributes:
        app_name (str): Identifier used for directory resolution.
        config_dir (Path): Resolved directory path where configuration is stored.
        config_file (Path): Absolute path to the config.json file.
    """

    DEFAULT_CONFIG: Dict[str, Any] = {
        "api_keys": {
            "groq": "",
            "openai": "",
            "gemini": ""
        },
        "active_provider": "groq",
        "provider_models": {
            "groq": "llama-3.1-8b-instant",
            "openai": "gpt-4o-mini"
        },
        "file_organizer": {
            "dry_run_default": False,
            "auto_disambiguate_duplicates": True,
            "skip_hidden_files": True,
            "custom_extensions": {}
        },
        "theme": "dark"
    }

    # Standard prefix regexes for sanity checking keys prior to network dispatch
    KEY_PATTERNS = {
        "groq": r"^gsk_[a-zA-Z0-9]{30,}$",
        "openai": r"^sk-[a-zA-Z0-9_\-]{30,}$",
        "gemini": r"^[a-zA-Z0-9_\-]{30,}$"
    }

    def __init__(self, config_dir: Optional[str | Path] = None, filename: str = "config.json"):
        """
        Initialize the ConfigManager.
        
        Args:
            config_dir: Optional explicit directory. If None, defaults to current app directory
                        or user home config (~/.devpulse).
            filename: Configuration file name (default: 'config.json').
        """
        if config_dir:
            self.config_dir = Path(config_dir).resolve()
        else:
            # Default to the application directory adjacent to this script
            self.config_dir = Path(__file__).parent.resolve()
            
        self.config_file = self.config_dir / filename
        self._ensure_config_exists()

    def _ensure_config_exists(self) -> None:
        """Create config directory and initialize config.json with secure file permissions."""
        try:
            self.config_dir.mkdir(parents=True, exist_ok=True)
            if not self.config_file.exists():
                self._write_raw_config(self.DEFAULT_CONFIG)
                self._apply_file_security()
        except OSError as exc:
            raise ConfigError(f"Failed to initialize configuration at {self.config_file}: {exc}") from exc

    def _apply_file_security(self) -> None:
        """Apply strict file permissions (read/write by owner only - 0o600) on POSIX platforms."""
        if os.name != 'nt' and self.config_file.exists():
            try:
                os.chmod(self.config_file, 0o600)
            except OSError:
                # Silently ignore if filesystem does not support standard POSIX chmod
                pass

    def _read_raw_config(self) -> Dict[str, Any]:
        """Read and parse the local JSON configuration file."""
        if not self.config_file.exists():
            return self.DEFAULT_CONFIG.copy()

        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if not isinstance(data, dict):
                    return self.DEFAULT_CONFIG.copy()
                # Migrate any legacy/decommissioned groq model references to llama-3.1-8b-instant
                if isinstance(data.get("provider_models"), dict):
                    groq_model = str(data["provider_models"].get("groq", ""))
                    if not groq_model or "8192" in groq_model:
                        data["provider_models"]["groq"] = "llama-3.1-8b-instant"
                return data
        except json.JSONDecodeError as exc:
            raise ConfigError(f"Corrupted config file at {self.config_file}. Invalid JSON: {exc}") from exc
        except OSError as exc:
            raise ConfigError(f"Permission or I/O error reading {self.config_file}: {exc}") from exc

    def _write_raw_config(self, data: Dict[str, Any]) -> None:
        """Persist dictionary to config.json safely with atomic write and permissions check."""
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
        """
        Save an API key for a specified AI provider.
        
        Args:
            api_key: The secret key string provided by the user.
            provider: Provider identifier ('groq', 'openai', 'gemini').
            
        Returns:
            bool: True on successful save.
            
        Raises:
            ConfigError: If key is empty or cannot be saved.
        """
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
        """
        Retrieve saved API key for provider. Defaults to active provider if unspecified.
        Also checks environmental variables as a fallback (e.g., GROQ_API_KEY, OPENAI_API_KEY).
        """
        config = self._read_raw_config()
        active = provider.lower().strip() if provider else config.get("active_provider", "groq")
        
        # 1. Check local config file
        keys = config.get("api_keys", {})
        key = keys.get(active, "").strip()
        if key:
            return key

        # 2. Check environment variable fallback
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
        """
        Check if a non-empty API key exists and meets minimum structural expectations.
        
        Args:
            provider: Optional provider name.
            
        Returns:
            bool: True if key is stored and passes validation.
        """
        key = self.get_api_key(provider)
        if not key or len(key) < 12:
            return False

        config = self._read_raw_config()
        prov = (provider or config.get("active_provider", "groq")).lower().strip()
        pattern = self.KEY_PATTERNS.get(prov)
        if pattern:
            # If pattern is known, verify format
            return bool(re.match(pattern, key))
            
        return len(key) >= 16

    def delete_api_key(self, provider: str) -> bool:
        """Remove a stored API key for security/sign-out."""
        provider = provider.lower().strip()
        config = self._read_raw_config()
        if "api_keys" in config and provider in config["api_keys"]:
            config["api_keys"][provider] = ""
            self._write_raw_config(config)
            return True
        return False

    def get_active_provider(self) -> str:
        """Get currently configured default AI provider."""
        config = self._read_raw_config()
        return config.get("active_provider", "groq")

    def set_active_provider(self, provider: str) -> None:
        """Set currently active default AI provider."""
        provider = provider.lower().strip()
        config = self._read_raw_config()
        config["active_provider"] = provider
        self._write_raw_config(config)

    def get_model(self, provider: Optional[str] = None) -> str:
        """Get currently configured model for provider (defaults to llama-3.1-8b-instant for Groq)."""
        config = self._read_raw_config()
        prov = (provider or config.get("active_provider", "groq")).lower().strip()
        models = config.get("provider_models", {})
        if isinstance(models, dict) and prov in models and models[prov]:
            saved_model = str(models[prov]).strip()
            # Decommissioned model migration
            if prov == "groq" and (not saved_model or "8192" in saved_model):
                return "llama-3.1-8b-instant"
            if saved_model:
                return saved_model
        return "llama-3.1-8b-instant" if prov == "groq" else "gpt-4o-mini"

    def set_model(self, provider: str, model_name: str) -> None:
        """Set active model for provider."""
        provider = provider.lower().strip()
        config = self._read_raw_config()
        if "provider_models" not in config or not isinstance(config["provider_models"], dict):
            config["provider_models"] = {}
        config["provider_models"][provider] = model_name.strip()
        self._write_raw_config(config)

    def get_setting(self, key_path: str, default: Any = None) -> Any:
        """
        Retrieve arbitrary nested setting by dot notation, e.g. 'file_organizer.dry_run_default'.
        """
        config = self._read_raw_config()
        keys = key_path.split(".")
        current = config
        for k in keys:
            if isinstance(current, dict) and k in current:
                current = current[k]
            else:
                return default
        return current


# Self-test block when executed directly
if __name__ == "__main__":
    print("[ConfigManager] Testing configuration subsystem...")
    mgr = ConfigManager()
    print(f"Config path: {mgr.config_file}")
    has_key = mgr.has_valid_key("groq")
    print(f"Has valid Groq key: {has_key}")
