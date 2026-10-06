"""
Personalization Engine Service (Pure Backend).
Combines User Profile, Past Questions, and Verified Teachings from MongoDB,
then calls the LLM interface to create a tailor-made 30-60s reel document.
"""

from datetime import datetime, timezone
from bson import ObjectId
from typing import Dict, Any, Optional

from seed_data import VERIFIED_TEACHINGS_SEED
from quotes_library import QUOTES_BY_ID, as_teaching
from services.llm_client import call_llm_for_reel
from services.quote_selector import choose_quote

async def get_or_seed_teachings(db):
    """Keeps MongoDB's `verified_teachings` identical to quotes_library.py (the source of truth)."""
    ids = [t["id"] for t in VERIFIED_TEACHINGS_SEED]
    for t in VERIFIED_TEACHINGS_SEED:
        await db.verified_teachings.update_one({"id": t["id"]}, {"$set": t}, upsert=True)
    # Remove older entries that were not checked word for word.
    await db.verified_teachings.delete_many({"id": {"$nin": ids}})

async def create_tailored_reel(
    db,
    user_id: str,
    situation_override: Optional[str] = None,
    teaching_id: Optional[str] = None,
    language: Optional[str] = None,
    duration_sec: Optional[int] = None,
    theme: Optional[str] = None
) -> dict:
    """
    1. Loads user login & profile data from MongoDB.
    2. Fetches user's past query/question history.
    3. Finds authentic verified teaching from Swami Vivekananda.
    4. Invokes LLM service with user context.
    5. Saves tailor-made reel into MongoDB.
    """
    # 1. Retrieve User
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise ValueError("User not found")

    # 2. Retrieve User Profile & Questionnaire
    profile = await db.user_profiles.find_one({"userId": user_id}) or {}

    # 3. Retrieve Past Questions (last 3 questions)
    recent_queries_cursor = db.user_queries.find({"userId": user_id}).sort("createdAt", -1).limit(3)
    recent_queries = await recent_queries_cursor.to_list(length=3)
    past_situations = [q.get("queryText") for q in recent_queries if q.get("queryText")]

    # 4. Resolve Parameters
    user_lang = language or user.get("preferred_language", "hi")
    reel_pref = profile.get("reel_preferences", {})
    user_duration = duration_sec or reel_pref.get("target_duration_sec", 45)
    user_tone = reel_pref.get("tone", "Energetic & Motivational")
    user_persona = profile.get("life_stage", user.get("role", "college_student"))

    effective_situation = situation_override
    if not effective_situation and past_situations:
        effective_situation = past_situations[0]
    if not effective_situation:
        effective_situation = "Dealing with anxiety and self-doubt before an important challenge."

    # 5. Choose an exact quote. The AI may only pick an ID; the text comes from quotes_library.py.
    chosen_by = "requested"
    if teaching_id and teaching_id in QUOTES_BY_ID:
        quote = QUOTES_BY_ID[teaching_id]
    else:
        recent_cursor = db.generated_reels.find({"userId": user_id}, {"teachingId": 1}).sort("createdAt", -1).limit(8)
        recent_ids = [r.get("teachingId") for r in await recent_cursor.to_list(length=8)]
        quote = await choose_quote(effective_situation, theme, recent_ids)
        chosen_by = quote.get("chosen_by", "keywords")
    teaching = as_teaching(quote)

    # 6. Call LLM Module (Contract with LLM Teammate)
    user_context = {
        "user_name": user.get("name"),
        "life_stage": user_persona,
        "primary_challenges": profile.get("primary_challenges", []),
        "past_situations": past_situations
    }

    generated_output = await call_llm_for_reel(
        user_context=user_context,
        teaching=teaching,
        situation=effective_situation,
        language=user_lang,
        duration_sec=user_duration,
        tone=user_tone
    )

    # 7. Construct & Persist MongoDB Document
    reel_doc = {
        "userId": user_id,
        "userName": user.get("name"),
        "language": user_lang,
        "durationSeconds": user_duration,
        "personalizationContext": {
            "lifeStage": user_persona,
            "primaryChallenges": profile.get("primary_challenges", []),
            "situationAddressed": effective_situation,
            "pastQuestionsConsidered": len(past_situations)
        },
        "teachingId": teaching["id"],
        "quoteChosenBy": chosen_by,
        "sourceUrl": teaching["source_url"],
        "teachingTitle": teaching.get("title", ""),
        "authenticQuote": teaching.get("quote", ""),
        "sourceCitation": teaching.get("source", "The Complete Works of Swami Vivekananda"),
        "modernScenario": generated_output["modern_scenario"],
        "scenes": generated_output["scenes"],
        "fullVoiceover": generated_output["full_voiceover"],
        "srtSubtitles": generated_output["srt_subtitles"],
        "takeawayAction": generated_output["takeaway_action"],
        "createdAt": datetime.now(timezone.utc)
    }

    insert_result = await db.generated_reels.insert_one(reel_doc)
    reel_doc["_id"] = str(insert_result.inserted_id)

    # 8. Log the Current Situation into User Query History
    if situation_override:
        await db.user_queries.insert_one({
            "userId": user_id,
            "queryText": situation_override,
            "matchedTeachingId": teaching.get("id"),
            "generatedReelId": reel_doc["_id"],
            "createdAt": datetime.now(timezone.utc)
        })

    return reel_doc
