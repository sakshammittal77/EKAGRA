"""
Chooses the best exact quote for a student's situation.

The AI (Gemini) only sees the list of quotes and answers with an ID.
Our code then looks that ID up and uses the stored text exactly, so the AI can never
change, shorten or invent his words. Without an API key (or if the AI fails or gives
an unknown ID) a simple word-matching score is used instead.
"""

import asyncio
import random
import json
import logging
import math
import os
import re
from typing import List, Optional

import requests

from quotes_library import APP_THEMES, QUOTES, QUOTES_BY_ID
from services.ai_text import any_key, ask_json

logger = logging.getLogger("uvicorn.info")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_MODELS = [os.getenv("GEMINI_MODEL", "gemini-3.8-flash"), "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"]  # lite models have higher free limits

# Extra words students use, mapped to quote themes, for the no-AI fallback.
_HINTS = {
    "courage": "fear scared afraid nervous stage presentation speak viva interview anxious anxiety panic darr exam exams test tomorrow",
    "strength": "weak tired drained exhausted burnout health stress",
    "self-confidence": "confidence believe myself faith doubt smarter inferior compare comparison useless worthless average imposter not good enough",
    "failure": "fail failed failure rejected rejection marks result low grade mistake regret backlog attempt",
    "goal": "goal give up quit consistent consistency procrastinate lazy motivation dream target prep",
    "concentration": "focus concentrate distracted distraction phone instagram reels scrolling attention mind wander study",
    "thoughts": "habit habits thoughts overthinking scrolling social media jealous",
    "character": "character discipline friends values",
    "education": "education learning cramming rote memorise memorize pointless why study college degree skills",
    "work": "work duty career job placement internship result results rank credit project team",
    "service": "help helping service volunteer meaningful others society thanks grateful",
    "calm": "calm anger angry fight roommate parents irritated noisy peace stress lonely alone",
}


def candidates_for(app_theme: Optional[str]) -> List[dict]:
    wanted = APP_THEMES.get((app_theme or "").lower())
    if not wanted:
        return list(QUOTES)
    return [q for q in QUOTES if any(t in wanted for t in q["themes"])]


_STOP = set("the and for you your are was were but not with that this have has had from they them what when who how all can just very too into out about our its it's i'm i've don't can't".split())


def _stem(w: str) -> str:
    w = w.replace("'s", "")
    for suf in ("ing", "ed", "es", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def _words(text: str) -> set:
    return {_stem(w) for w in re.findall(r"[a-z']+", (text or "").lower()) if len(w) > 2 and w not in _STOP}


def score_match(situation: str, q: dict) -> float:
    s = _words(situation)
    score = 2.0 * len(s & _words(q["situations"])) + 0.3 * len(s & _words(q["text"]))
    for i, t in enumerate(q["themes"]):
        # What the student's words say about the topic matters most; the quote's main theme counts double.
        score += (3.0 if i == 0 else 1.5) * len(s & _words(_HINTS.get(t, "") + " " + t))
    return score


def pick_by_keywords(situation: str, cands: List[dict], avoid: set) -> dict:
    fresh = [q for q in cands if q["id"] not in avoid] or cands
    scored = [(score_match(situation, q), q) for q in fresh]
    best = max(s for s, _ in scored)
    # Several quotes fit about equally well: pick one of them at random for variety.
    close = [q for s, q in scored if s >= best - 1.0]
    return random.choice(close)


def _ask_ai(situation: str, cands: List[dict], avoid: set) -> Optional[str]:
    listing = "\n".join(
        f'- id: {q["id"]}\n  fits: {q["situations"]}\n  text: {q["text"]}' for q in cands
    )
    recent = ", ".join(sorted(avoid)) or "none"
    prompt = f"""You help a student by choosing ONE passage of Swami Vivekananda that best speaks to their situation.

Student's situation: "{situation}"

Passages (choose only from these ids):
{listing}

Rules:
- Choose the passage whose meaning most directly helps with this exact situation.
- Prefer not to repeat these recently used ids unless clearly the best: {recent}.
- Do not write or rewrite any passage. Answer only with JSON:
{{"quote_id": "<one id from the list>", "reason": "<one short sentence>"}}"""

    out, why = ask_json(prompt, temperature=0.2, timeout=25,
                        validate=lambda o: str(o.get("quote_id", "")).strip() in {q["id"] for q in cands})
    if out is None:
        logger.warning(f"Quote choice: no AI answer ({why}); using word matching.")
        return None
    return str(out["quote_id"]).strip()


async def choose_quote(situation: str, app_theme: Optional[str] = None, avoid_ids=()) -> dict:
    """Returns one quote dict from the library (never AI-written). Adds 'chosen_by'."""
    avoid = {a for a in (avoid_ids or ()) if a}
    all_cands = candidates_for(app_theme)
    # Never offer the quotes this student got recently (when enough others remain),
    # and shuffle so the AI doesn't keep picking whatever is listed first.
    fresh = [q for q in all_cands if q["id"] not in avoid]
    cands = fresh if len(fresh) >= 3 else list(all_cands)
    random.shuffle(cands)
    if any_key() and situation:
        qid = await asyncio.to_thread(_ask_ai, situation, cands, avoid)
        allowed = {q["id"] for q in cands}
        if qid in allowed:
            return {**QUOTES_BY_ID[qid], "chosen_by": "ai"}
        if qid:
            logger.warning(f"Quote choice: AI answered unknown id {qid!r}; using word matching.")
    return {**pick_by_keywords(situation or "", cands, avoid), "chosen_by": "keywords"}


def top_matches(situation: str, app_theme: Optional[str] = None, k: int = 3) -> List[dict]:
    """Best k quotes for a situation by word matching, with the words that matched (for the UI)."""
    cands = candidates_for(app_theme)
    s = _words(situation)
    ranked = sorted(cands, key=lambda q: score_match(situation, q), reverse=True)[:k]
    out = []
    for q in ranked:
        hint_words = set()
        for t in q["themes"]:
            hint_words |= _words(_HINTS.get(t, "") + " " + t)
        matched = sorted(s & (_words(q["situations"]) | hint_words))
        out.append({"id": q["id"], "score": round(score_match(situation, q), 1),
                    # 0-100 "how well it fits" for the meter; saturates around a score of 15
                    "strength": round(100 * (1 - math.exp(-score_match(situation, q) / 6))), "matched": matched[:6]})
    return out
