"""
One place to ask an AI for a JSON answer.

Tries Gemini first (GEMINI_API_KEY); if it is missing, busy, over its free limit or broken,
tries Groq (GROQ_API_KEY). Returns (dict_or_None, reason) — reason is for debugging only.
"""

import json
import logging
import os
from typing import Optional, Tuple

import requests

logger = logging.getLogger("uvicorn.info")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_MODELS = [os.getenv("GEMINI_MODEL", "gemini-3.8-flash"), "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"]

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODELS = [os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"), "openai/gpt-oss-20b"]

_RETRY_NEXT = (404, 429, 500, 502, 503)


def _parse(text: str) -> Optional[dict]:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    try:
        out = json.loads(text)
    except Exception:
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            out = json.loads(text[start:end + 1])
        except Exception:
            return None
    return out if isinstance(out, dict) else None


def _gemini(prompt: str, temperature: float, timeout: int) -> Tuple[Optional[dict], str]:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        return None, "no_gemini_key"
    reason = "gemini_no_model"
    for model in dict.fromkeys(GEMINI_MODELS):
        try:
            r = requests.post(
                GEMINI_URL.format(model=model), timeout=timeout,
                headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                json={"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                      "generationConfig": {"temperature": temperature, "responseMimeType": "application/json"}},
            )
            if r.status_code != 200:
                reason = f"gemini_http_{r.status_code}"
                logger.warning(f"AI: Gemini {model} HTTP {r.status_code}")
                if r.status_code in _RETRY_NEXT:
                    continue
                return None, reason
            out = _parse(r.json()["candidates"][0]["content"]["parts"][0]["text"])
            if out is not None:
                return out, f"gemini:{model}"
            reason = "gemini_bad_json"
        except Exception as exc:
            reason = f"gemini_{type(exc).__name__}"
            logger.warning(f"AI: Gemini {model} failed ({type(exc).__name__})")
    return None, reason


def _groq(prompt: str, temperature: float, timeout: int) -> Tuple[Optional[dict], str]:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return None, "no_groq_key"
    reason = "groq_no_model"
    for model in dict.fromkeys(GROQ_MODELS):
        try:
            r = requests.post(
                GROQ_URL, timeout=timeout,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "temperature": temperature,
                      "response_format": {"type": "json_object"},
                      "messages": [
                          {"role": "system", "content": "You always answer with one valid JSON object and nothing else."},
                          {"role": "user", "content": prompt}]},
            )
            if r.status_code != 200:
                reason = f"groq_http_{r.status_code}"
                logger.warning(f"AI: Groq {model} HTTP {r.status_code}: {r.text[:160]}")
                if r.status_code in _RETRY_NEXT or r.status_code == 400:
                    continue
                return None, reason
            out = _parse(r.json()["choices"][0]["message"]["content"])
            if out is not None:
                return out, f"groq:{model}"
            reason = "groq_bad_json"
        except Exception as exc:
            reason = f"groq_{type(exc).__name__}"
            logger.warning(f"AI: Groq {model} failed ({type(exc).__name__})")
    return None, reason


def ask_json(prompt: str, temperature: float = 0.7, timeout: int = 40,
             validate=None) -> Tuple[Optional[dict], str]:
    """Gemini, then Groq. `validate(dict) -> bool` can reject an answer so the next AI is tried."""
    reasons = []
    for fn in (_gemini, _groq):
        out, why = fn(prompt, temperature, timeout)
        if out is not None and (validate is None or validate(out)):
            return out, why
        reasons.append(why if out is None else f"{why}_rejected")
    return None, " / ".join(reasons)


def any_key() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GROQ_API_KEY", "").strip())
