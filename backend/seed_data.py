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
        "debunked_reason": "Often misquoted. The authentic quote in CWSV Vol. 1, Raja Yoga, p. 177 is: 'Take up one idea. Make that one idea your life — think of it, dream of it, live on that idea. Let the brain, muscles, nerves, every part of your body, be full of that idea, and just leave every other idea alone. This is the way to success.'",
        "belur_math_clarification": "Partially authentic, but frequently truncated on social media without correct citation."
    }
]

VERIFIED_TEACHINGS_SEED = [
    {
        "id": "courage_fear_v1",
        "theme": "Courage & Fearlessness",
        "title": "Face the Brutes (Overcoming What Intimidates You)",
        "type": "Incident & Teaching",
        "quote": "If you ever face danger, do not run away. Turn round and face the danger! The moment you fear, you are nobody. Face the brutes!",
        "original_context": "Varanasi temple incident where young Naren was chased by monkeys. An old sannyasin shouted 'Face the brutes!' He stopped, turned back, and the monkeys fled.",
        "source": "Complete Works of Swami Vivekananda (CWSV), Vol. 1, 'Raja Yoga'",
        "volume_page": "CWSV Vol. 1, p. 338",
        "authenticity_status": "VERIFIED_CANONICAL",
        "keywords": ["fear", "courage", "run away", "danger", "face the brutes", "stage fear"],
        "suitable_for_challenges": ["fear_of_failure", "stage_fear", "anxiety", "avoidance"]
    },
    {
        "id": "concentration_dhyana_v1",
        "theme": "Concentration & Mind Control",
        "title": "The Power of Concentration",
        "type": "Core Teaching",
        "quote": "The powers of the mind are like the rays of the light dissipated; when they are concentrated, they illumine everything.",
        "original_context": "Discourse on Raja Yoga regarding overcoming distractions and developing single-minded focus.",
        "source": "Complete Works of Swami Vivekananda (CWSV), Vol. 1, 'Raja Yoga'",
        "volume_page": "CWSV Vol. 1, p. 129",
        "authenticity_status": "VERIFIED_CANONICAL",
        "keywords": ["concentration", "focus", "distraction", "mind", "power", "study"],
        "suitable_for_challenges": ["lack_of_focus", "distraction", "exam_anxiety", "procrastination"]
    },
    {
        "id": "strength_life_v1",
        "theme": "Self-Confidence & Inner Strength",
        "title": "Strength is Life, Weakness is Death",
        "type": "Core Teaching",
        "quote": "Strength is life, weakness is death. Strength is felicity, life eternal, immortal; weakness is constant strain and misery.",
        "original_context": "Address to youth on cultivating physical and moral stamina.",
        "source": "Complete Works of Swami Vivekananda (CWSV), Vol. 2, 'Practical Vedanta'",
        "volume_page": "CWSV Vol. 2, p. 3",
        "authenticity_status": "VERIFIED_CANONICAL",
        "keywords": ["strength", "weakness", "confidence", "misery", "stamina"],
        "suitable_for_challenges": ["low_self_esteem", "self_doubt", "burnout", "laziness"]
    },
    {
        "id": "education_manifestation_v1",
        "theme": "Education & Self-Discovery",
        "title": "Manifestation of Perfection Within",
        "type": "Core Teaching",
        "quote": "Education is the manifestation of the perfection already in man.",
        "original_context": "Discussions on true education being character building and discovering one's latent power rather than rote memorization.",
        "source": "Complete Works of Swami Vivekananda (CWSV), Vol. 4, 'Writings - Prose'",
        "volume_page": "CWSV Vol. 4, p. 358",
        "authenticity_status": "VERIFIED_CANONICAL",
        "keywords": ["education", "perfection", "student", "learning", "skills"],
        "suitable_for_challenges": ["exam_stress", "career_uncertainty", "imposter_syndrome"]
    }
]

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
