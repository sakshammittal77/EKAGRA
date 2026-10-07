"""
Subtitles for a reel: each scene's voiceover is split into short caption lines
(about 7 words) spread evenly across the scene, as SRT or WebVTT.
"""

from typing import Any, Dict, List

WORDS_PER_CAPTION = 7


def _stamp(seconds: float, sep: str) -> str:
    ms = int(round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def time_label(start: float, end: float) -> str:
    """'00:05 - 00:18' style label for the editor."""
    mmss = lambda t: f"{int(t) // 60:02d}:{int(t) % 60:02d}"
    return f"{mmss(start)} - {mmss(end)}"


def cues(scenes: List[Dict[str, Any]]) -> List[tuple]:
    """(start, end, text) for every caption line."""
    out = []
    for s in scenes:
        words = (s.get("voiceover_text") or "").split()
        if not words:
            continue
        start, end = float(s.get("start_time", 0)), float(s.get("end_time", 0))
        n = -(-len(words) // WORDS_PER_CAPTION)
        size = -(-len(words) // n)  # even chunks, no one-word orphans
        chunks = [words[i:i + size] for i in range(0, len(words), size)]
        step = (end - start) / len(chunks)
        for k, chunk in enumerate(chunks):
            out.append((start + k * step, start + (k + 1) * step, " ".join(chunk)))
    return out


def build_srt(scenes: List[Dict[str, Any]]) -> str:
    return "\n".join(
        f"{i}\n{_stamp(a, ',')} --> {_stamp(b, ',')}\n{text}\n"
        for i, (a, b, text) in enumerate(cues(scenes), 1)
    )


def build_vtt(scenes: List[Dict[str, Any]]) -> str:
    body = "\n".join(f"{_stamp(a, '.')} --> {_stamp(b, '.')}\n{text}\n" for a, b, text in cues(scenes))
    return "WEBVTT\n\n" + body
