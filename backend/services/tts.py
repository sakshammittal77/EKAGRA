"""
Natural narration for reels and for Arya, using Microsoft's neural voices through edge-tts
(free, no API key, needs internet). Returns MP3 audio plus the start time of every word,
so the website can highlight words and mix the voice into exported videos.
"""

import base64
from collections import OrderedDict
from typing import Dict, List

import edge_tts

VOICES = {
    "en": {"female": "en-IN-NeerjaExpressiveNeural", "male": "en-IN-PrabhatNeural"},
    "hi": {"female": "hi-IN-SwaraNeural", "male": "hi-IN-MadhurNeural"},
    "bn": {"female": "bn-IN-TanishaaNeural", "male": "bn-IN-BashkarNeural"},
    "ta": {"female": "ta-IN-PallaviNeural", "male": "ta-IN-ValluvarNeural"},
}

_cache: "OrderedDict[tuple, Dict]" = OrderedDict()
CACHE_SIZE = 300


def _char_positions(text: str, words: List[str]) -> List[int]:
    """Where each spoken word starts in the original text (for highlighting)."""
    out, pos = [], 0
    for w in words:
        i = text.find(w, pos)
        if i == -1:
            out.append(pos)
            continue
        out.append(i)
        pos = i + len(w)
    return out


async def synthesize(text: str, lang: str = "en", voice: str = "female") -> Dict:
    voice_name = VOICES.get(lang, VOICES["en"]).get(voice, VOICES.get(lang, VOICES["en"])["female"])
    key = (text, voice_name)
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]

    audio = bytearray()
    marks = []
    comm = edge_tts.Communicate(text, voice_name, boundary="WordBoundary")
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            marks.append({"t": round(chunk["offset"] / 1e7, 3), "d": round(chunk["duration"] / 1e7, 3), "w": chunk["text"]})
    for m, c in zip(marks, _char_positions(text, [m["w"] for m in marks])):
        m["c"] = c

    result = {"voice": voice_name, "mime": "audio/mpeg", "audio": base64.b64encode(bytes(audio)).decode(), "marks": marks}
    _cache[key] = result
    if len(_cache) > CACHE_SIZE:
        _cache.popitem(last=False)
    return result
