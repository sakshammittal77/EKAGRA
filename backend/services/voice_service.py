"""
Voiceover with Gemini text-to-speech (uses the same GEMINI_API_KEY as the scripts).

One audio file per reel, made from the scenes' voiceover text. The quote scene's text is
his exact words (inserted by our code), so the voice reads them exactly as written.
The audio is stored in MongoDB and served at a secret link so Creatomate can download it.
"""

import asyncio
import base64
import io
import logging
import os
import secrets
import wave
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import requests
from bson import Binary

logger = logging.getLogger("uvicorn.info")

INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
LEGACY_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

TTS_MODELS = [os.getenv("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts"), "gemini-3.8-flash-lite-tts"]
LEGACY_TTS_MODEL = "gemini-2.5-flash-preview-tts"
VOICE = os.getenv("GEMINI_TTS_VOICE", "Charon")  # Informative; try Sadaltager, Orus, Sulafat
STYLE = "warm, calm and inspiring, like a thoughtful narrator of a short motivational reel; clear pacing"


def _pcm_to_wav(pcm: bytes, rate: int = 24000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def wav_seconds(wav_bytes: bytes) -> float:
    with wave.open(io.BytesIO(wav_bytes)) as w:
        return w.getnframes() / float(w.getframerate())


def _as_wav(raw: bytes) -> bytes:
    return raw if raw[:4] == b"RIFF" else _pcm_to_wav(raw)


def _try_interactions(api_key: str, text: str, model: str) -> Optional[bytes]:
    r = requests.post(
        INTERACTIONS_URL,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={
            "model": model,
            "input": [{"type": "user_input", "content": [{
                "type": "text", "text": text,
                "annotations": [{"type": "speech_metadata", "style": STYLE}],
            }]}],
            "response_format": {"type": "audio"},
            "generation_config": {"speech_config": [{"voice": VOICE}]},
        },
        timeout=90,
    )
    if r.status_code != 200:
        logger.warning(f"Gemini TTS ({model}) HTTP {r.status_code}: {r.text[:200]}")
        return None
    audio = None
    for step in r.json().get("steps", []):
        for c in step.get("content", []) or []:
            if c.get("type") == "audio" and c.get("data"):
                audio = c["data"]
    return _as_wav(base64.b64decode(audio)) if audio else None


def _try_legacy(api_key: str, text: str) -> Optional[bytes]:
    r = requests.post(
        LEGACY_URL.format(model=LEGACY_TTS_MODEL),
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
        json={
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}},
            },
        },
        timeout=90,
    )
    if r.status_code != 200:
        logger.warning(f"Gemini TTS (legacy) HTTP {r.status_code}: {r.text[:200]}")
        return None
    part = r.json()["candidates"][0]["content"]["parts"][0]
    data = (part.get("inlineData") or part.get("inline_data") or {}).get("data")
    return _as_wav(base64.b64decode(data)) if data else None


def synthesize(text: str) -> Optional[bytes]:
    """Returns WAV bytes, or None if every model failed (reel is then made without voice)."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key or not text.strip():
        return None
    for model in dict.fromkeys(TTS_MODELS):
        try:
            wav = _try_interactions(api_key, text, model)
            if wav:
                return wav
        except Exception as exc:
            logger.warning(f"Gemini TTS ({model}) failed: {type(exc).__name__}")
    try:
        return _try_legacy(api_key, text)
    except Exception as exc:
        logger.warning(f"Gemini TTS (legacy) failed: {type(exc).__name__}")
        return None


def scene_texts(reel: dict) -> List[str]:
    return [(s.get("voiceover_text") or "").strip() for s in reel.get("scenes", [])]


def split_timings(texts: List[str], total: float) -> List[Tuple[float, float]]:
    """Gives each scene a share of the audio, in proportion to how much it says."""
    weights = [max(len(t), 12) for t in texts]
    s = float(sum(weights)) or 1.0
    out, t = [], 0.0
    for w in weights:
        d = total * w / s
        out.append((round(t, 2), round(d, 2)))
        t += d
    return out


async def ensure_voiceover(db, reel: dict) -> Optional[dict]:
    """Makes (once) and stores the voiceover. Returns {'token', 'seconds'} or None."""
    existing = reel.get("voiceover")
    if existing and existing.get("token"):
        return existing
    texts = scene_texts(reel)
    # A blank line between scenes gives a natural pause.
    wav = await asyncio.to_thread(synthesize, "\n\n".join(t for t in texts if t))
    if not wav:
        return None
    token = secrets.token_urlsafe(24)
    seconds = wav_seconds(wav)
    await db.voiceovers.insert_one({
        "token": token, "reelId": str(reel["_id"]), "audio": Binary(wav),
        "seconds": seconds, "createdAt": datetime.now(timezone.utc),
    })
    info = {"token": token, "seconds": seconds}
    await db.generated_reels.update_one({"_id": reel["_id"]}, {"$set": {"voiceover": info}})
    return info


def public_audio_url(token: str) -> str:
    base = (os.getenv("PUBLIC_BACKEND_URL") or os.getenv("RENDER_EXTERNAL_URL") or "").rstrip("/")
    return f"{base}/api/voiceovers/{token}.wav"
