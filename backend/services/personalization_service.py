"""
Personalization Engine Service (Pure Backend).
Combines User Profile, Past Questions, and Verified Teachings from MongoDB,
then calls the LLM interface to create a tailor-made 30-60s reel document.
"""

from datetime import datetime, timezone
from bson import ObjectId
from typing import Dict, Any, Optional

from seed_data import VERIFIED_TEACHINGS_SEED
from services.llm_client import call_llm_for_reel

async def get_or_seed_teachings(db):
    """Ensures verified canonical teachings exist in MongoDB."""
    count = await db.verified_teachings.count_documents({})
    if count == 0:
        for t in VERIFIED_TEACHINGS_SEED:
            await db.verified_teachings.update_one({"id": t["id"]}, {"$set": t}, upsert=True)

async def select_best_teaching(db, user_profile: dict, situation: str) -> dict:
    """Matches the user's specific challenge/situation against verified teachings in MongoDB."""
    await get_or_seed_teachings(db)
    
    situation_lower = (situation or "").lower()
    challenges = user_profile.get("primary_challenges", [])

    cursor = db.verified_teachings.find({})
    teachings = await cursor.to_list(length=100)
    
    if not teachings:
        return VERIFIED_TEACHINGS_SEED[0]

    # 1. Match by situation keywords
    for t in teachings:
        for kw in t.get("keywords", []):
            if kw.lower() in situation_lower:
                return t

    # 2. Match by user challenges from profile
    for t in teachings:
        theme_lower = t.get("theme", "").lower()
        for ch in challenges:
            if "fear" in ch and "courage" in theme_lower:
                return t
            if "focus" in ch and "concentration" in theme_lower:
                return t
            if "strength" in ch or "laziness" in ch:
                if "strength" in theme_lower:
                    return t

    return teachings[0]

async def create_tailored_reel(
    db,
    user_id: str,
    situation_override: Optional[str] = None,
    teaching_id: Optional[str] = None,
    language: Optional[str] = None,
    duration_sec: Optional[int] = None
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

    # 5. Fetch Canonical Teaching
    if teaching_id:
        teaching = await db.verified_teachings.find_one({"id": teaching_id})
    else:
        teaching = await select_best_teaching(db, profile, effective_situation)

    if not teaching:
        teaching = VERIFIED_TEACHINGS_SEED[0]

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
        "teachingId": teaching.get("id", "courage_fear_v1"),
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
