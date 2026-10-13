from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import logger


class OllamaClient:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.timeout = settings.OLLAMA_TIMEOUT_SECONDS

    @property
    def default_model(self) -> str:
        return settings.OLLAMA_MODEL

    async def check_health(self) -> dict[str, Any]:
        """
        Check if local Ollama daemon is reachable and list installed models.
        """
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                    exact_present = any(
                        self.default_model in m or m.startswith(self.default_model) for m in models
                    )
                    active_model = (
                        self.default_model
                        if exact_present
                        else (models[0] if models else self.default_model)
                    )
                    return {
                        "connected": True,
                        "models": models,
                        "model_present": bool(models),
                        "active_model": active_model,
                    }
        except Exception as e:
            logger.debug("Ollama health check failed: %s", str(e))

        return {
            "connected": False,
            "models": [],
            "model_present": False,
            "active_model": None,
        }

    async def generate_json(
        self, prompt: str, system_prompt: str | None = None, model: str | None = None
    ) -> str | None:
        """
        Call Ollama /api/generate with JSON format mode.
        Returns the raw model response string or None if Ollama is unreachable.
        """
        target_model = model or self.default_model
        payload = {
            "model": target_model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.1,  # Low temperature for factual extraction
                "top_p": 0.9,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                res = await client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code != 200:
                    logger.warning("Ollama API returned HTTP %d: %s", res.status_code, res.text)
                    return None
                data = res.json()
                return data.get("response")
        except httpx.ConnectError:
            logger.info("Ollama service not running at %s.", self.base_url)
            return None
        except httpx.TimeoutException:
            logger.warning("Ollama inference timed out after %ds.", self.timeout)
            return None
        except Exception as e:
            logger.warning("Error invoking local Ollama: %s", str(e))
            return None


ollama_client = OllamaClient()
