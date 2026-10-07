"""
LLM Client Interface (Contract with LLM Teammate).
Decoupled module for AI reel generation.
Your LLM teammate can update the prompt or model logic here without breaking backend/database code.
"""

import os
import json
import re
import asyncio
import logging
from typing import Dict, Any, List, Optional

import requests

from services.ai_text import any_key, ask_json
from services.templates import lines_for, pick_hook
from services.captions import build_srt, time_label

logger = logging.getLogger("uvicorn.info")

# Tried in order; set GEMINI_MODEL to force one. Older names are fallbacks if a model is retired.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_FALLBACK_MODELS = ["gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"]
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu", "mr": "Marathi",
}

def format_timestamp(seconds: float) -> str:
    """Format seconds into SRT timestamp: HH:MM:SS,mmm"""
    millis = int((seconds - int(seconds)) * 1000)
    secs = int(seconds) % 60
    mins = (int(seconds) // 60) % 60
    hours = int(seconds) // 3600
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def calculate_scene_timings(duration_sec: int) -> List[Dict[str, Any]]:
    """Calculates standardized scene beat allocations for 30s, 45s, or 60s reels."""
    d = float(duration_sec)
    if d <= 35:
        return [
            {"scene_number": 1, "name": "Hook", "start": 0.0, "end": 4.0},
            {"scene_number": 2, "name": "Modern Situation", "start": 4.0, "end": 12.0},
            {"scene_number": 3, "name": "Authentic Teaching", "start": 12.0, "end": 22.0},
            {"scene_number": 4, "name": "Micro-Action", "start": 22.0, "end": 27.0},
            {"scene_number": 5, "name": "Outro & Reflection", "start": 27.0, "end": 30.0}
        ]
    elif d <= 50:
        return [
            {"scene_number": 1, "name": "Hook", "start": 0.0, "end": 5.0},
            {"scene_number": 2, "name": "Modern Situation", "start": 5.0, "end": 18.0},
            {"scene_number": 3, "name": "Authentic Teaching", "start": 18.0, "end": 32.0},
            {"scene_number": 4, "name": "Micro-Action", "start": 32.0, "end": 40.0},
            {"scene_number": 5, "name": "Outro & Reflection", "start": 40.0, "end": 45.0}
        ]
    else:
        return [
            {"scene_number": 1, "name": "Hook", "start": 0.0, "end": 6.0},
            {"scene_number": 2, "name": "Modern Situation", "start": 6.0, "end": 24.0},
            {"scene_number": 3, "name": "Authentic Teaching", "start": 24.0, "end": 44.0},
            {"scene_number": 4, "name": "Micro-Action", "start": 44.0, "end": 54.0},
            {"scene_number": 5, "name": "Outro & Reflection", "start": 54.0, "end": 60.0}
        ]

def _template_reel(
    user_context: Dict[str, Any],
    teaching: Dict[str, Any],
    situation: str,
    language: str,
    duration_sec: int,
    tone: str
) -> Dict[str, Any]:
    """
    Fixed template script, used when Gemini is not configured or fails.
    Lines are picked to match the quote's theme (fear, doubt, focus, learning, purpose)
    in the chosen language (en, hi, bn, ta). Same output shape as the Gemini path.
    """
    L = lines_for(teaching.get("themes") or [], language)
    situation = (situation or "").strip().rstrip(".")
    ai = {
        "hook": pick_hook(teaching.get("themes") or [], language, seed=situation),
        "modern_situation": f"{situation}. {L['suffix']}" if situation else L["suffix"],
        "quote_intro": L["intro"],
        "micro_action": L["action"],
        "outro": L["outro"],
        "on_screen": dict(zip(ON_SCREEN_FIELDS, L["screen"])),
        "visuals": dict(zip(["hook", "modern_situation", "teaching", "micro_action", "outro"], L["visuals"])),
    }
    return _assemble(ai, teaching, situation, calculate_scene_timings(duration_sec))


# ---------------------------------------------------------------------------
# Gemini (real AI script)
# ---------------------------------------------------------------------------

SCRIPT_FIELDS = ["hook", "modern_situation", "quote_intro", "micro_action", "outro"]
ON_SCREEN_FIELDS = ["hook", "modern_situation", "micro_action", "outro"]


def _build_prompt(user_context, teaching, situation, language, duration_sec, tone, timings) -> str:
    lang_name = LANGUAGE_NAMES.get(language, "English")
    words = {t["name"]: max(4, int((t["end"] - t["start"]) * 2.4)) for t in timings}
    return f"""You write scripts for 30-60 second vertical reels (Instagram/YouTube Shorts) that help
Indian students apply a real teaching of Swami Vivekananda to their own life.

STUDENT
- Life stage: {user_context.get("life_stage", "college_student")}
- Challenges: {", ".join(user_context.get("primary_challenges") or []) or "not stated"}
- What they are going through now: {situation}

THE TEACHING (verified, from The Complete Works of Swami Vivekananda)
- Title: {teaching.get("title", "")}
- Exact quote: "{teaching.get("quote", "")}"
- Context: {teaching.get("original_context", "")}

STRICT RULES
1. NEVER quote, paraphrase or invent words of Swami Vivekananda. Do not put any text in his mouth.
   The exact quote is inserted separately by our system right after your "quote_intro".
2. "quote_intro" is only a short lead-in such as "Swami Vivekananda said:" in the target language.
3. Write everything in {lang_name}, natural and spoken, the way a young Indian student talks.
   Keep English words that students commonly use (exam, presentation, phone) if that sounds natural.
4. Tone: {tone}. Warm, honest, no preaching, no exaggeration.
5. Hook: a question or line that grabs attention in the first 2 seconds and matches the student's situation.
6. Modern situation: a specific, relatable moment from student life, close to what the student described.
7. Micro action: ONE small, concrete thing the viewer can do today, in under a minute.
8. Outro: one short line inviting them to reflect or share.
9. Approximate spoken word counts: hook {words["Hook"]}, modern_situation {words["Modern Situation"]},
   micro_action {words["Micro-Action"]}, outro {words["Outro & Reflection"]}.
10. on_screen text: 2-5 punchy words per scene, in {lang_name}.
11. visuals: one short description per scene of what to show (in English), for a video editor.

Return ONLY JSON in exactly this shape:
{{
  "hook": "...", "modern_situation": "...", "quote_intro": "...", "micro_action": "...", "outro": "...",
  "on_screen": {{"hook": "...", "modern_situation": "...", "micro_action": "...", "outro": "..."}},
  "visuals": {{"hook": "...", "modern_situation": "...", "teaching": "...", "micro_action": "...", "outro": "..."}}
}}"""


def _call_gemini(api_key: str, prompt: str) -> Optional[Dict[str, Any]]:
    """Tries the configured model, then fallbacks if a model name is not found."""
    for model in [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]:
        result = _call_gemini_model(api_key, prompt, model)
        if result != "MODEL_NOT_FOUND":
            return result
    return None


def _call_gemini_model(api_key: str, prompt: str, model: str):
    """Blocking HTTP call to one Gemini model. Returns parsed JSON, None, or "MODEL_NOT_FOUND"."""
    try:
        resp = requests.post(
            GEMINI_URL.format(model=model),
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},  # key in header, not URL
            json={
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.9, "responseMimeType": "application/json"},
            },
            timeout=40,
        )
        if resp.status_code in (404, 429, 500, 503):
            logger.warning(f"Gemini model {model} gave HTTP {resp.status_code} (missing/busy/over limit); trying the next one.")
            return "MODEL_NOT_FOUND"
        if resp.status_code != 200:
            logger.warning(f"Gemini ({model}) returned HTTP {resp.status_code}; using template script.")
            return None
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        out = json.loads(text)
        if not all(isinstance(out.get(k), str) and out[k].strip() for k in SCRIPT_FIELDS):
            logger.warning("Gemini answer was missing fields; using template script.")
            return None
        return out
    except Exception as exc:  # network error, bad JSON, unexpected shape
        logger.warning(f"Gemini call failed ({type(exc).__name__}); using template script.")
        return None


def _assemble(ai: Dict[str, Any], teaching: Dict[str, Any], situation: str, timings) -> Dict[str, Any]:
    """Turns the AI fields into the scenes format. The quote and source come only from the teaching."""
    quote_text = teaching.get("quote", "")
    source_text = teaching.get("source", "The Complete Works of Swami Vivekananda")
    on_screen = ai.get("on_screen") or {}
    visuals = ai.get("visuals") or {}

    plan = [
        ("Hook", ai["hook"].strip(), on_screen.get("hook"), visuals.get("hook"), False),
        ("Modern Situation", ai["modern_situation"].strip(), on_screen.get("modern_situation"), visuals.get("modern_situation"), False),
        ("Authentic Teaching", f'{ai["quote_intro"].strip()} "{quote_text}"', quote_text, visuals.get("teaching"), True),
        ("Micro-Action", ai["micro_action"].strip(), on_screen.get("micro_action"), visuals.get("micro_action"), False),
        ("Outro & Reflection", ai["outro"].strip(), on_screen.get("outro"), visuals.get("outro"), False),
    ]

    scenes = []
    for i, (t_info, (name, vo, ost, visual, is_teaching)) in enumerate(zip(timings, plan), 1):
        s_time, e_time = t_info["start"], t_info["end"]
        scenes.append({
            "scene_number": i,
            "name": name,
            "start_time": s_time,
            "end_time": e_time,
            "time_label": time_label(s_time, e_time),
            "visual_description": (visual or "").strip() or name,
            "voiceover_text": vo,
            "on_screen_text": (ost or "").strip() or None,
            "authentic_quote": quote_text if is_teaching else None,
            "source_citation": source_text if is_teaching else None,
        })

    return {
        "modern_scenario": situation,
        "scenes": scenes,
        "full_voiceover": " ".join(s["voiceover_text"] for s in scenes),
        "srt_subtitles": build_srt(scenes),
        "takeaway_action": ai["micro_action"].strip(),
    }


_QUOTED = re.compile(r'["\u201c\u201d\u00ab\u00bb\u201e]([^"\u201c\u201d\u00ab\u00bb\u201e]{0,400})["\u201c\u201d\u00ab\u00bb\u201e]')


def _has_invented_quote(ai: Dict[str, Any]) -> bool:
    """True if any AI-written text contains a quoted passage of 6+ words.
    Only our code may put Vivekananda's words in the reel, so such scripts are rejected."""
    texts = [ai.get(k, "") for k in SCRIPT_FIELDS]
    for group in ("on_screen", "visuals"):
        texts += [v for v in (ai.get(group) or {}).values() if isinstance(v, str)]
    for t in texts:
        for m in _QUOTED.finditer(t or ""):
            if len(m.group(1).split()) >= 6:
                return True
    return False


async def call_llm_for_reel(
    user_context: Dict[str, Any],
    teaching: Dict[str, Any],
    situation: str,
    language: str,
    duration_sec: int,
    tone: str
) -> Dict[str, Any]:
    """
    Writes the reel script. Uses Gemini when GEMINI_API_KEY is set; otherwise, or if Gemini
    fails, falls back to the fixed template so reel making always works.

    Output (unchanged contract): modern_scenario, scenes, full_voiceover, srt_subtitles, takeaway_action.
    The quote and its source are never written by the AI: they are copied from `teaching`.
    """
    if any_key():
        timings = calculate_scene_timings(duration_sec)
        prompt = _build_prompt(user_context, teaching, situation, language, duration_sec, tone, timings)

        def valid(o):
            ok = all(isinstance(o.get(k), str) and o[k].strip() for k in SCRIPT_FIELDS)
            return ok and not _has_invented_quote(o)  # only our code may put his words in the reel
        ai, why = await asyncio.to_thread(ask_json, prompt, 0.9, 40, valid)
        if not ai:
            logger.warning(f"Reel script: no usable AI answer ({why}); using the template.")
        else:
            return _assemble(ai, teaching, situation, timings)
    return _template_reel(user_context, teaching, situation, language, duration_sec, tone)


def contains_quoted_passage(text: str) -> bool:
    """True if text holds a quoted run of 6+ words (only our code may put his words in a reel)."""
    return any(len(m.group(1).split()) >= 6 for m in _QUOTED.finditer(text or ""))


def _hooks_prompt(teaching, situation, language, current) -> str:
    lang_name = LANGUAGE_NAMES.get(language, "English")
    return f"""Write 3 different opening hooks (the first 2-4 seconds) for a vertical reel for Indian students.
Student's situation: {situation}
The reel later shares this verified teaching of Swami Vivekananda (do NOT quote or paraphrase it): "{teaching.get("quote", "")}"
Current hook (write different ones): {current}

Rules: in {lang_name}; max 14 words each; one question, one bold statement, one relatable moment;
never put words in Swami Vivekananda's mouth; no quotation marks.
Return ONLY JSON: {{"hooks": ["...", "...", "..."]}}"""


async def generate_hook_variants(teaching: Dict[str, Any], situation: str, language: str, current: str = "") -> Dict[str, Any]:
    """Three alternative hooks for a reel: AI (Gemini, then Groq) if configured, otherwise the template pool."""
    if any_key():
        def valid(o):
            return isinstance(o.get("hooks"), list)
        out, _why = await asyncio.to_thread(ask_json, _hooks_prompt(teaching, situation, language, current), 1.0, 30, valid)
        hooks = [h.strip() for h in ((out or {}).get("hooks") or []) if isinstance(h, str) and h.strip()]
        hooks = [h for h in hooks if not contains_quoted_passage(h)][:3]
        if len(hooks) >= 2:
            return {"source": "ai", "hooks": hooks}
    pool = lines_for(teaching.get("themes") or [], language)["hooks"]
    return {"source": "template", "hooks": [h for h in pool if h != current] or pool}
