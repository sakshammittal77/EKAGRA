"""
"How are you feeling?" assistant.

The student writes how they feel; we answer with:
  - a short, kind reply (AI-written, in the student's language)
  - ONE exact passage from quotes_library.py (the AI picks only an ID; code inserts the text)
  - one small thing to try today
  - a theme, so the website can offer "Make a reel about this"

Safety: messages that suggest self-harm get a fixed, caring reply with Indian helplines
(no AI, no quote). The AI is told it is not a therapist and must not diagnose.
"""

import asyncio
import json
import logging
import os
import re
from typing import Dict, List, Optional

import requests

from quotes_library import QUOTES, QUOTES_BY_ID, source_line
from services.llm_client import _QUOTED
from services.quote_selector import GEMINI_MODELS, GEMINI_URL, pick_by_keywords, score_match

logger = logging.getLogger("uvicorn.info")

APP_THEMES = ["courage", "concentration", "self-confidence", "education", "service"]

HELPLINES = [
    {"name": "Tele-MANAS (Govt. of India, free, 24×7, many languages)", "phone": "14416", "alt": "1-800-891-4416"},
    {"name": "Emergency", "phone": "112", "alt": ""},
]

_CRISIS = re.compile(
    r"suicid|kill myself|end my life|want to die|wanna die|don'?t want to live|no reason to live|"
    r"self[- ]?harm|hurt myself|cut myself|better off dead|end it all|"
    r"marna chahta|marna chahti|jeena nahi|khudkushi|aatmahatya|आत्महत्या|मरना चाहत|जीना नहीं",
    re.I,
)

CRISIS_REPLY = {
    "en": ("I'm really glad you told me. What you're feeling sounds very heavy, and you don't have to carry it alone. "
           "Please talk to someone right now — a person you trust, or a trained counsellor on the free helpline below. "
           "They're there for exactly this, any time of day or night."),
    "hi": ("मुझे खुशी है कि आपने यह बताया। जो आप महसूस कर रहे हैं वह बहुत भारी लगता है, और आपको इसे अकेले नहीं उठाना है। "
           "कृपया अभी किसी से बात करें — किसी भरोसेमंद व्यक्ति से, या नीचे दी गई मुफ़्त हेल्पलाइन पर प्रशिक्षित काउंसलर से। "
           "वे दिन-रात कभी भी आपके लिए हैं।"),
}

_THEME_OF_QUOTE_THEME = {
    "courage": "courage", "strength": "self-confidence", "self-confidence": "self-confidence",
    "failure": "self-confidence", "goal": "concentration", "concentration": "concentration",
    "thoughts": "concentration", "calm": "concentration", "character": "education",
    "education": "education", "work": "service", "service": "service",
}


def is_crisis(text: str) -> bool:
    return bool(_CRISIS.search(text or ""))


def _looks_hindi(text: str) -> bool:
    return bool(re.search(r"[ऀ-ॿ]", text or ""))


def _quote_payload(q: dict) -> dict:
    return {"id": q["id"], "text": q["text"], "source": source_line(q), "url": q["url"]}


def _fallback(last: str, avoid: set) -> dict:
    q = pick_by_keywords(last, QUOTES, avoid)
    theme = _THEME_OF_QUOTE_THEME.get(q["themes"][0], "courage")
    hi = _looks_hindi(last)
    return {
        "reply": ("आपने जो बताया उसके लिए धन्यवाद। ऐसा महसूस होना स्वाभाविक है, और आप इससे बाहर निकल सकते हैं। "
                  "स्वामी विवेकानंद के ये शब्द शायद आज आपकी मदद करें।") if hi else
                 ("Thank you for sharing that. What you're feeling is completely human, and it can change. "
                  "Here are some words of Swami Vivekananda that may help you today."),
        "feeling": "",
        "action": ("आज सिर्फ़ 10 मिनट के लिए एक छोटा कदम उठाइए और फिर खुद को शाबाशी दीजिए।" if hi else
                   "Pick one tiny step you can do in the next 10 minutes, do it, and notice how it feels."),
        "theme": theme,
        "quote": _quote_payload(q),
        "chosen_by": "keywords",
    }


def _prompt(messages: List[dict], cands: List[dict]) -> str:
    convo = "\n".join(f'{"Student" if m["role"] == "user" else "EKAGRA"}: {m["text"]}' for m in messages[-8:])
    listing = "\n".join(f'- {q["id"]} | fits: {q["situations"]}' for q in cands)
    return f"""You are EKAGRA, a warm, calm companion for Indian college students, inspired by Swami Vivekananda's teachings.
A student is telling you how they feel. Conversation so far:
{convo}

Write a short, kind response to the student's LAST message.

Rules:
1. Reply in the same language and script the student used (English, Hindi, Hinglish, Bengali, Tamil...).
2. "reply": 2-4 short sentences. Acknowledge the feeling first, then one gentle, practical thought. Talk like a caring senior, not a lecture. If you need more detail, you may end with ONE simple question.
3. You are not a doctor or therapist: never diagnose, never mention medicines. If things sound heavy or long-lasting, gently suggest talking to a trusted person or a college counsellor.
4. NEVER write or paraphrase words of Swami Vivekananda, and do not put anything in quotation marks. We show his exact words separately.
5. "quote_id": choose the ONE passage id below whose meaning best helps this student right now.
6. "action": one small, specific thing they can do today (one sentence, same language).
7. "feeling": 1-3 words naming the feeling (e.g. "exam anxiety").
8. "theme": one of {APP_THEMES}.

Passages (choose only from these ids):
{listing}

Answer ONLY with JSON: {{"reply": "...", "feeling": "...", "action": "...", "theme": "...", "quote_id": "..."}}"""


def _ask_gemini(api_key: str, prompt: str) -> Optional[dict]:
    for model in dict.fromkeys(GEMINI_MODELS):
        try:
            r = requests.post(
                GEMINI_URL.format(model=model),
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json={"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                      "generationConfig": {"temperature": 0.7, "responseMimeType": "application/json"}},
                timeout=40,
            )
            if r.status_code == 404:
                continue
            if r.status_code != 200:
                logger.warning(f"Assistant: Gemini HTTP {r.status_code}")
                return None
            return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
        except Exception as exc:
            logger.warning(f"Assistant: Gemini failed ({type(exc).__name__})")
            return None
    return None


async def answer(messages: List[Dict[str, str]], avoid_ids=()) -> dict:
    messages = [m for m in messages if m.get("text", "").strip()][-8:]
    last = messages[-1]["text"].strip() if messages else ""
    avoid = set(avoid_ids or ())

    if is_crisis(" ".join(m["text"] for m in messages if m["role"] == "user")):
        return {"crisis": True, "reply": CRISIS_REPLY["hi" if _looks_hindi(last) else "en"],
                "helplines": HELPLINES, "quote": None, "action": "", "theme": None, "feeling": ""}

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        # Shortlist the passages that best fit, so the prompt stays small.
        ranked = sorted(QUOTES, key=lambda q: score_match(" ".join(m["text"] for m in messages), q), reverse=True)
        cands = [q for q in ranked if q["id"] not in avoid][:18] or ranked[:18]
        ai = await asyncio.to_thread(_ask_gemini, api_key, _prompt(messages, cands))
        ok = (isinstance(ai, dict) and isinstance(ai.get("reply"), str) and ai["reply"].strip()
              and not any(len(m.group(1).split()) >= 6 for m in _QUOTED.finditer(ai["reply"] + " " + str(ai.get("action", "")))))
        if ok:
            qid = str(ai.get("quote_id", "")).strip()
            q = QUOTES_BY_ID.get(qid) if qid in {c["id"] for c in cands} else None
            chosen_by = "ai"
            if not q:
                q, chosen_by = pick_by_keywords(last, cands, avoid), "keywords"
            theme = ai.get("theme") if ai.get("theme") in APP_THEMES else _THEME_OF_QUOTE_THEME.get(q["themes"][0], "courage")
            return {"crisis": False, "reply": ai["reply"].strip(), "feeling": str(ai.get("feeling", ""))[:40],
                    "action": str(ai.get("action", "")).strip(), "theme": theme,
                    "quote": _quote_payload(q), "chosen_by": chosen_by}
        if ai is not None:
            logger.warning("Assistant: AI answer rejected (missing fields or contained a quotation).")

    return {"crisis": False, **_fallback(last, avoid)}
