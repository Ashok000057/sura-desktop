"""
DevPulse Productivity Tool - AI Integration Handler (BYOK Model)
Module: ai_handler.py

Provides lightweight, direct HTTP integration using Python's standard `requests` library
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
    """Base exception for AI integration errors."""
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
    
    Uses standard requests with timeout, connection retries, and comprehensive error mapping.
    """

    PROVIDERS = {
        "groq": {
            "base_url": "https://api.groq.com/openai/v1/chat/completions",
            "models_url": "https://api.groq.com/openai/v1/models",
            "default_model": "llama-3.1-8b-instant",
            "fallback_models": [
                "llama-3.1-8b-instant",
                "llama-3.3-70b-versatile",
                "llama-3.1-70b-versatile",
                "mixtral-8x7b-32768",
                "gemma2-9b-it"
            ],
            "name": "Groq"
        },
        "openai": {
            "base_url": "https://api.openai.com/v1/chat/completions",
            "models_url": "https://api.openai.com/v1/models",
            "default_model": "gpt-4o-mini",
            "fallback_models": [
                "gpt-4o-mini",
                "gpt-4o",
                "gpt-3.5-turbo"
            ],
            "name": "OpenAI"
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
        """
        Initialize the AI integration handler.
        
        Args:
            api_key: User's BYOK secret key.
            provider: 'groq' or 'openai'.
            model: Optional model override (defaults to llama-3.1-8b-instant or gpt-4o-mini).
            custom_base_url: Optional override for local models (e.g. Ollama, LM Studio).
            timeout: Network request timeout in seconds.
        """
        if not api_key or not api_key.strip():
            raise AuthenticationError("API key cannot be empty. Please configure your BYOK key first.")

        self.api_key = api_key.strip()
        self.provider = provider.lower().strip()
        self.timeout = timeout

        prov_meta = self.PROVIDERS.get(self.provider, self.PROVIDERS["groq"])
        self.endpoint_url = custom_base_url or prov_meta["base_url"]
        self.models_url = prov_meta.get("models_url", "")

        # If model is unspecified or references decommissioned llama3-8b-8192, use default
        if not model or (self.provider == "groq" and "8192" in str(model)):
            self.model = prov_meta["default_model"]
        else:
            self.model = str(model).strip()

    def _get_headers(self) -> Dict[str, str]:
        """Construct standard HTTP bearer headers."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "DevPulse-Desktop-Toolkit/1.0"
        }

    def get_available_models(self) -> List[str]:
        """
        Dynamically fetch available active chat models from provider's /models endpoint.
        Calls https://api.groq.com/openai/v1/models using the API key.
        Filters for chat-capable models containing llama, mixtral, etc.
        Returns fallback list if network or query fails.
        """
        prov_meta = self.PROVIDERS.get(self.provider, self.PROVIDERS["groq"])
        models_url = prov_meta.get("models_url", "")
        fallback_list = list(prov_meta.get("fallback_models", [self.model]))

        if not models_url or not self.api_key:
            return fallback_list

        try:
            response = requests.get(
                models_url,
                headers=self._get_headers(),
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                raw_list = data.get("data", [])
                models = []
                for item in raw_list:
                    mid = item.get("id") if isinstance(item, dict) else str(item)
                    if not mid:
                        continue
                    m_lower = mid.lower()
                    # Filter out non-chat / whisper / guard / embedding / decommissioned models
                    if any(x in m_lower for x in ["whisper", "embed", "guard", "vision", "safetensor", "tts", "8192"]):
                        continue
                    if self.provider == "groq":
                        # Chat models: llama, mixtral, gemma, qwen, deepseek
                        if any(x in m_lower for x in ["llama", "mixtral", "gemma", "qwen", "deepseek"]):
                            models.append(mid)
                    elif self.provider == "openai":
                        if any(x in m_lower for x in ["gpt-4", "gpt-3.5", "o1", "o3"]):
                            models.append(mid)
                    else:
                        models.append(mid)

                if models:
                    # Remove duplicates while preserving discovery order
                    seen = set()
                    unique_models = []
                    for m in models:
                        if m not in seen:
                            seen.add(m)
                            unique_models.append(m)

                    # Prioritize models containing llama or mixtral (e.g. llama-3.3-70b-versatile, llama-3.1-8b-instant)
                    def sort_key(m: str) -> tuple:
                        ml = m.lower()
                        is_cur = 0 if (self.model and m == self.model) else 1
                        is_llama_mixtral = 0 if ("llama" in ml or "mixtral" in ml) else 1
                        priority = 2
                        if "llama-3.3-70b-versatile" in ml:
                            priority = 0
                        elif "llama-3.1-8b-instant" in ml:
                            priority = 0.4
                        elif "llama-3.1-70b-versatile" in ml:
                            priority = 0.8
                        elif "mixtral" in ml:
                            priority = 1.2
                        return (is_cur, is_llama_mixtral, priority, m)

                    unique_models.sort(key=sort_key)
                    return unique_models
        except Exception as exc:
            logger.warning("Could not dynamically query %s models endpoint: %s", self.provider, exc)

        return fallback_list

    def auto_pick_model(self) -> str:
        """
        Automatically pick the first available active chat model from the provider's /models endpoint.
        Falls back to default model if unreachable.
        """
        try:
            available = self.get_available_models()
            if available:
                self.model = available[0]
                return self.model
        except Exception as exc:
            logger.debug("auto_pick_model error: %s", exc)

        prov_meta = self.PROVIDERS.get(self.provider, self.PROVIDERS["groq"])
        self.model = prov_meta["default_model"]
        return self.model

    def execute_prompt(
        self,
        prompt: str,
        system_instruction: str = "You are an expert developer productivity assistant. Provide concise, clear, and actionable responses.",
        temperature: float = 0.5,
        max_tokens: int = 1024
    ) -> str:
        """
        Send a completion request to the AI provider.
        
        Args:
            prompt: User task or prompt content.
            system_instruction: Behavior guidance for the LLM.
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative).
            max_tokens: Upper ceiling for response token length.
            
        Returns:
            str: Generated text content.
            
        Raises:
            AuthenticationError: If API key is rejected (401).
            RateLimitError: If rate limit is hit (429).
            AIHandlerError: For all other network or parsing errors.
        """
        if not prompt or not prompt.strip():
            raise AIHandlerError("Prompt cannot be empty.")

        # Ensure valid model before execution
        if not self.model or (self.provider == "groq" and "8192" in self.model):
            self.auto_pick_model()

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
            raise AIHandlerError(
                f"Failed to connect to {self.endpoint_url}. Please check your internet connection: {exc}"
            ) from exc
        except requests.exceptions.RequestException as exc:
            raise AIHandlerError(f"Unexpected network transport error: {exc}") from exc

        # Process HTTP status codes
        if response.status_code == 200:
            try:
                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    raise AIHandlerError("Provider returned 200 OK but with no response choices.")
                content = choices[0]["message"]["content"]
                return content.strip()
            except (json.JSONDecodeError, KeyError, IndexError) as exc:
                raise AIHandlerError(f"Failed to parse provider response: {exc}. Raw: {response.text[:200]}") from exc

        # Handle specific error status codes
        error_msg = f"API Error (HTTP {response.status_code})"
        try:
            err_json = response.json()
            if "error" in err_json:
                error_msg = err_json["error"].get("message", error_msg)
        except Exception:
            error_msg = response.text[:300] or error_msg

        # Auto-fallback recovery if model is decommissioned, missing, or rejected (HTTP 400 or 404)
        is_model_failure = (response.status_code in (400, 404)) or any(
            x in error_msg.lower() for x in ["model", "decommissioned", "not exist", "not found", "not supported", "invalid_request_error"]
        )

        if is_model_failure:
            logger.warning("Configured model '%s' failed (%s). Auto-discovering candidate models...", self.model, error_msg)
            discovered = []
            try:
                discovered = self.get_available_models()
            except Exception as exc:
                logger.debug("Failed to query models endpoint during error recovery: %s", exc)

            prov_meta = self.PROVIDERS.get(self.provider, self.PROVIDERS["groq"])
            fallbacks = prov_meta.get("fallback_models", [])

            # Compile candidates without duplicate and avoiding the failed model
            candidates = []
            for cand in (discovered + fallbacks):
                if cand and cand not in candidates and cand != self.model:
                    candidates.append(cand)

            for candidate in candidates:
                try:
                    logger.info("Attempting auto-recovery with candidate model '%s'...", candidate)
                    retry_payload = dict(payload)
                    retry_payload["model"] = candidate
                    retry_resp = requests.post(
                        self.endpoint_url,
                        headers=self._get_headers(),
                        json=retry_payload,
                        timeout=self.timeout
                    )
                    if retry_resp.status_code == 200:
                        res_data = retry_resp.json()
                        choices = res_data.get("choices", [])
                        if choices:
                            logger.info("Auto-recovery successful with model '%s'!", candidate)
                            self.model = candidate
                            return choices[0]["message"]["content"].strip()
                except Exception as retry_exc:
                    logger.debug("Candidate model '%s' failed: %s", candidate, retry_exc)
                    continue

        if response.status_code == 401:
            raise AuthenticationError(
                f"Authentication failed: Invalid {self.provider.title()} API key. Details: {error_msg}",
                status_code=401
            )
        elif response.status_code == 429:
            raise RateLimitError(
                f"Rate limit exceeded or quota exhausted for {self.provider.title()}. Details: {error_msg}",
                status_code=429
            )
        elif response.status_code in (500, 502, 503, 504):
            raise AIHandlerError(
                f"{self.provider.title()} service is temporarily unavailable ({response.status_code}). Try again later.",
                status_code=response.status_code
            )
        else:
            raise AIHandlerError(
                f"Provider returned error HTTP {response.status_code}: {error_msg}",
                status_code=response.status_code
            )

    def summarize_code(self, code_snippet: str, language: str = "python") -> str:
        """
        Specialized developer task: Analyzes and concisely explains a code snippet.
        """
        system_instruction = (
            "You are a Senior Principal Software Engineer. Analyze the user's code snippet. "
            "Provide: 1) A 2-sentence executive summary of its function, "
            "2) Key logic breakdown in bullet points, "
            "3) Complexity / performance observations (Big-O if relevant), "
            "4) Potential edge cases or bugs. Keep it terse and engineering-focused."
        )
        prompt = f"```{language}\n{code_snippet}\n```\n\nPlease summarize and review this code."
        return self.execute_prompt(prompt, system_instruction=system_instruction, temperature=0.2)

    def generate_git_commit(self, diff_text: str) -> str:
        """
        Specialized developer task: Generates a Conventional Commit message from a git diff.
        """
        system_instruction = (
            "You are an automated Git commit assistant following the Conventional Commits specification "
            "(e.g. feat:, fix:, refactor:, chore:, docs:). Generate a concise 1-line subject line (<= 72 chars), "
            "followed by 2-3 bullet points describing what changed and why. Do not wrap in markdown quotes."
        )
        prompt = f"Generate a commit message for the following git diff:\n\n{diff_text[:4000]}"
        return self.execute_prompt(prompt, system_instruction=system_instruction, temperature=0.3)

    def suggest_file_names(self, original_filename: str, context_or_preview: str) -> str:
        """
        Specialized developer task: Proposes clean, kebab-case or snake-case filenames.
        """
        system_instruction = (
            "You are a file naming normalization agent. Suggest 3 clean, unambiguous, and "
            "well-structured filenames for the given file based on its current name and content preview. "
            "Use lowercase with hyphens or underscores. Output only the 3 suggested filenames with extensions."
        )
        prompt = f"Original filename: {original_filename}\nPreview/Context:\n{context_or_preview[:1500]}"
        return self.execute_prompt(prompt, system_instruction=system_instruction, temperature=0.2)

    def validate_api_key(self) -> bool:
        """
        Performs a minimal 1-token probe to verify the API key is active without burning quota.
        """
        try:
            self.execute_prompt("Ping", max_tokens=1, temperature=0.0)
            return True
        except AuthenticationError:
            return False
        except Exception as exc:
            logger.warning("Validation probe encountered non-auth warning: %s", exc)
            return True


# Convenience standalone helper function as requested in specification
def process_ai_text(api_key: str, prompt: str, provider: str = "groq") -> str:
    """
    Convenience function that takes user's saved API key and prompt,
    then executes the request using AIHandler.
    """
    handler = AIHandler(api_key=api_key, provider=provider)
    return handler.execute_prompt(prompt)


if __name__ == "__main__":
    print("[AIHandler] AI integration handler module loaded.")
    print("Available providers:", list(AIHandler.PROVIDERS.keys()))
