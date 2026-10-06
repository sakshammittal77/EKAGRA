"""
Verified Teachings Seed Data & Guardrail Verifier.
Canonical quotes and incidents from The Complete Works of Swami Vivekananda (CWSV).
Used to populate MongoDB's `verified_teachings` collection independently.
"""

# Quotes commonly misattributed to Swami Vivekananda on social media
KNOWN_MISATTRIBUTIONS = [
    {
        "spurious_quote": "In a day when you don't come across any problems, you can be sure that you are traveling in a wrong path.",
        "debunked_reason": "Widely shared on WhatsApp and Instagram, but nowhere in Complete Works of Swami Vivekananda (Vols 1-9) or official Belur Math records.",
        "belur_math_clarification": "Unverified popular aphorism misattributed to Vivekananda."
    },
    {
        "spurious_quote": "Take up one idea. Make that one idea your life...",
        "debunked_reason": "Often misquoted. The full passage is in CWSV Vol. 1, Raja-Yoga, 'Pratyahara and Dharana' (see quotes_library.py, id take_up_one_idea).",
        "belur_math_clarification": "Partially authentic, but frequently truncated on social media without correct citation."
    }
]

# Every teaching now comes from quotes_library.py (exact passages, checked against the source).
from quotes_library import QUOTES, as_teaching

VERIFIED_TEACHINGS_SEED = [as_teaching(q) for q in QUOTES]

def verify_quote_against_canon(quote_text: str) -> dict:
    """Checks if a quote is verified or a known misattribution."""
    q_clean = quote_text.strip().lower()
    for mis in KNOWN_MISATTRIBUTIONS:
        if mis["spurious_quote"].lower() in q_clean or q_clean in mis["spurious_quote"].lower():
            return {
                "is_authentic": False,
                "status": "SUSPECTED_MISATTRIBUTION",
                "reason": mis["debunked_reason"],
                "clarification": mis["belur_math_clarification"]
            }
            
    for t in VERIFIED_TEACHINGS_SEED:
        if t["quote"].lower() in q_clean or q_clean in t["quote"].lower():
            return {
                "is_authentic": True,
                "status": "VERIFIED_CANONICAL",
                "source": t["source"],
                "volume_page": t["volume_page"]
            }
            
    return {
        "is_authentic": False,
        "status": "UNVERIFIED_CUSTOM_QUOTE",
        "warning": "Quote not found in verified canonical database. Cannot verify authenticity."
    }
