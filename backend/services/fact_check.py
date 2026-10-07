"""
Fact-check a "Vivekananda quote" seen on social media against the verified library.

Verdicts (honest about what we can and cannot know):
  verified       word for word inside a verified passage
  near_exact     almost the same words: probably this passage, misquoted slightly
  paraphrase     a similar idea in different words: not his words as written
  misattributed  a known misattribution
  not_found      not in our library; that alone does not prove it is fake
"""

import re
from difflib import SequenceMatcher
from typing import Optional

from quotes_library import QUOTES, as_teaching
from seed_data import KNOWN_MISATTRIBUTIONS

BELUR_MATH_FACT_CHECK = "https://belurmath.org/fact-check-and-clarifications/"


def _norm(text: str) -> str:
    text = (text or "").lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s']", " ", text)).strip()


def _sentences(text: str):
    return [s for s in re.split(r"(?<=[.!?;])\s+", text) if s.strip()]


def _windows(text: str):
    """Every run of 1-3 consecutive sentences, so a partial quote can match its part of a passage."""
    sents = _sentences(text)
    for size in (1, 2, 3):
        for i in range(len(sents) - size + 1):
            yield " ".join(sents[i:i + size])


_STOP = set("""a an the and or but if of to in on at by for with from as is are was were be been being it its this that
these those i you he she we they me him her us them my your his our their what which who whom not no so do does did
have has had all any can will would shall should may might must then than there here up out into about over very just
one same also only own such more most""".split())


def _content(text: str) -> set:
    return {w for w in text.split() if w not in _STOP and len(w) > 2}


def _overlap(a: str, b: str) -> float:
    """Share of the pasted text's meaningful words that also appear in the passage."""
    wa, wb = _content(a), _content(b)
    if len(wa) < 4:
        return 0.0
    return len(wa & wb) / len(wa)


def check(text: str) -> dict:
    q = _norm(text)
    if len(q.split()) < 3:
        return {"verdict": "too_short", "similarity": 0, "message": "Paste at least a full sentence to check."}

    for mis in KNOWN_MISATTRIBUTIONS:
        m = _norm(mis["spurious_quote"])
        if SequenceMatcher(None, q, m).ratio() > 0.8 or (len(q) > 20 and q in m):
            return {"verdict": "misattributed", "similarity": 0, "reason": mis["debunked_reason"],
                    "clarification": mis["belur_math_clarification"], "fact_check_url": BELUR_MATH_FACT_CHECK}

    best: Optional[dict] = None
    for quote in QUOTES:
        passage = _norm(quote["text"])
        if q in passage:
            best = {"quote": quote, "excerpt": text.strip(), "score": 1.0}
            break
        for win in _windows(quote["text"]):
            w = _norm(win)
            score = max(SequenceMatcher(None, q, w).ratio(), 0.9 * _overlap(q, w))
            if not best or score > best["score"]:
                best = {"quote": quote, "excerpt": win, "score": score}

    score = best["score"] if best else 0
    if score >= 0.999:
        verdict = "verified"
    elif score >= 0.85:
        verdict = "near_exact"
    elif score >= 0.55:
        verdict = "paraphrase"
    else:
        verdict = "not_found"

    out = {"verdict": verdict, "similarity": round(score * 100), "library_size": len(QUOTES),
           "fact_check_url": BELUR_MATH_FACT_CHECK}
    if best and verdict != "not_found":
        t = as_teaching(best["quote"])
        out["match"] = {"id": t["id"], "excerpt": best["excerpt"], "passage": t["quote"],
                        "source": t["source"], "source_url": t["source_url"], "theme": t["theme"]}
    return out
