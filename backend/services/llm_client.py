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
    
    Inputs provided by Backend:
    - user_context: dict with life_stage, past_challenges, past_questions
    - teaching: canonical verified teaching dict (quote, source, context)
    - situation: current life situation or problem entered by the user
    - language: target language code ('hi', 'en', 'bn', 'ta', 'te', 'mr')
    - duration_sec: 30, 45, or 60
    - tone: preferred narration style
    
    Output expected by Backend:
    Dict containing:
    - modern_scenario: str
    - scenes: list of scene dicts with visual_description, voiceover_text, on_screen_text
    - full_voiceover: str
    - srt_subtitles: str
    - takeaway_action: str
    """
    # 1. Standard Scene Timing Breakdown
    timings = calculate_scene_timings(duration_sec)
    
    # Language-aware default templates for robust fallback
    quote_text = teaching.get("quote", "")
    source_text = teaching.get("source", "The Complete Works of Swami Vivekananda")
    persona_label = user_context.get("life_stage", "youth")

    # If Hindi
    if language == "hi":
        hook_text = "क्या आप भी इस डर से भाग रहे हैं जो आपको बार-बार रोकता है?"
        modern_scene = f"{situation} - दिल की धड़कनें तेज हैं और मन कर रहा है कि पीछे हट जाएं।"
        bridge_text = f"स्वामी विवेकानंद ने कहा था: '{quote_text}'"
        action_text = "अगली बार जब डर सामने आए, 3 सेकंड रुकें और सीधे आगे बढ़ें। डर खुद पीछे हट जाएगा।"
        outro_text = "शेयर करें किसी ऐसे दोस्त के साथ जिसे आज इस साहस की जरूरत है।"
    else: # English default
        hook_text = "Ever felt the urge to run away when pressure hits you?"
        modern_scene = f"{situation} - palms sweating, heart racing, wanting an easy escape."
        bridge_text = f"Swami Vivekananda reminded us: '{quote_text}'"
        action_text = "Take 3 deep breaths, face the exact task you are avoiding, and take that single first step."
        outro_text = "Share this with someone who needs strength today."

    scenes = []
    srt_lines = []
    
    scene_scripts = [
        (timings[0], "Hook", "Fast paced visual, bold typography highlighting internal panic", hook_text, "Stop running away"),
        (timings[1], "Modern Situation", f"Relatable real-life scenario: {modern_scene}", modern_scene, "The struggle is real"),
        (timings[2], "Authentic Teaching", f"Visual of Swami Vivekananda with verified source badge ({source_text})", bridge_text, quote_text),
        (timings[3], "Micro-Action", "Clear modern action prompt, minimal focus visual", action_text, "Action Step"),
        (timings[4], "Outro & Reflection", "Call to reflect and share, calm closing aesthetic", outro_text, "Share the Strength")
    ]
    
    for i, (t_info, name, visual, vo, ost) in enumerate(scene_scripts, 1):
        s_time = t_info["start"]
        e_time = t_info["end"]
        time_label = f"{int(s_time):02d}:00 - {int(e_time):02d}:00"
        
        scenes.append({
            "scene_number": i,
            "name": name,
            "start_time": s_time,
            "end_time": e_time,
            "time_label": time_label,
            "visual_description": visual,
            "voiceover_text": vo,
            "on_screen_text": ost,
            "authentic_quote": quote_text if "Teaching" in name else None,
            "source_citation": source_text if "Teaching" in name else None
        })
        
        srt_lines.append(f"{i}\n{format_timestamp(s_time)} --> {format_timestamp(e_time)}\n{vo}\n")

    full_vo = " ".join([s["voiceover_text"] for s in scenes])
    srt_str = "\n".join(srt_lines)

    return {
        "modern_scenario": situation,
        "scenes": scenes,
        "full_voiceover": full_vo,
        "srt_subtitles": srt_str,
        "takeaway_action": action_text
    }


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

    scenes, srt_lines = [], []
    for i, (t_info, (name, vo, ost, visual, is_teaching)) in enumerate(zip(timings, plan), 1):
        s_time, e_time = t_info["start"], t_info["end"]
        scenes.append({
            "scene_number": i,
            "name": name,
            "start_time": s_time,
            "end_time": e_time,
            "time_label": f"{int(s_time):02d}:00 - {int(e_time):02d}:00",
            "visual_description": (visual or "").strip() or name,
            "voiceover_text": vo,
            "on_screen_text": (ost or "").strip() or None,
            "authentic_quote": quote_text if is_teaching else None,
            "source_citation": source_text if is_teaching else None,
        })
        srt_lines.append(f"{i}\n{format_timestamp(s_time)} --> {format_timestamp(e_time)}\n{vo}\n")

    return {
        "modern_scenario": situation,
        "scenes": scenes,
        "full_voiceover": " ".join(s["voiceover_text"] for s in scenes),
        "srt_subtitles": "\n".join(srt_lines),
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
