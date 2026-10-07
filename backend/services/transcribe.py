"""
Speech to text for Arya's mic button. Works in every browser (Brave, Safari, Chrome...):
the website records the student's voice and sends it here.

1st choice: Whisper on Groq (GROQ_API_KEY) — fast, good with Hindi and Indian English.
Backup:     Gemini (GEMINI_API_KEY) listening to the audio.
"""

import base64
import logging
import os
from typing import Optional, Tuple

import requests

from services.ai_text import GEMINI_MODELS, GEMINI_URL

logger = logging.getLogger("uvicorn.info")

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_STT_MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"]
EXT = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a"}


def _groq(audio: bytes, mime: str, lang: Optional[str]) -> Tuple[Optional[str], str]:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        return None, "no_groq_key"
    base = (mime or "audio/webm").split(";")[0].strip()
    name = f"speech.{EXT.get(base, 'webm')}"
    reason = "groq_failed"
    for model in GROQ_STT_MODELS:
        try:
            data = {"model": model, "response_format": "json", "temperature": "0"}
            if lang in ("en", "hi"):
                data["language"] = lang
            r = requests.post(GROQ_STT_URL, headers={"Authorization": f"Bearer {key}"},
                              files={"file": (name, audio, base)}, data=data, timeout=40)
            if r.status_code != 200:
                reason = f"groq_http_{r.status_code}"
                logger.warning(f"STT: Groq {model} HTTP {r.status_code}: {r.text[:160]}")
                continue
            return (r.json().get("text") or "").strip(), f"groq:{model}"
        except Exception as exc:
            reason = f"groq_{type(exc).__name__}"
            logger.warning(f"STT: Groq {model} failed ({type(exc).__name__})")
    return None, reason


def _gemini(audio: bytes, mime: str, lang: Optional[str]) -> Tuple[Optional[str], str]:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        return None, "no_gemini_key"
    hint = {"hi": "The speaker is probably speaking Hindi; write Hindi in Devanagari.",
            "en": "The speaker is probably speaking English."}.get(lang or "", "")
    prompt = f"Transcribe this recording exactly as spoken. {hint} Output only the transcript, nothing else."
    reason = "gemini_failed"
    for model in dict.fromkeys(GEMINI_MODELS):
        try:
            r = requests.post(GEMINI_URL.format(model=model), timeout=40,
                              headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                              json={"contents": [{"role": "user", "parts": [
                                  {"inline_data": {"mime_type": (mime or "audio/webm").split(";")[0], "data": base64.b64encode(audio).decode()}},
                                  {"text": prompt}]}],
                                  "generationConfig": {"temperature": 0}})
            if r.status_code != 200:
                reason = f"gemini_http_{r.status_code}"
                continue
            text = r.json()["candidates"][0]["content"]["parts"][0].get("text", "")
            return text.strip(), f"gemini:{model}"
        except Exception as exc:
            reason = f"gemini_{type(exc).__name__}"
    return None, reason


def transcribe(audio: bytes, mime: str = "audio/webm", lang: Optional[str] = None) -> Tuple[Optional[str], str]:
    text, why = _groq(audio, mime, lang)
    if text is not None:
        return text, why
    text2, why2 = _gemini(audio, mime, lang)
    if text2 is not None:
        return text2, why2
    return None, f"{why} / {why2}"
