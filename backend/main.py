"""
Teaching-to-Reel Generator: Standalone FastAPI Backend with MongoDB.
Completely decoupled from frontend and raw LLM layers.
Serves Auth, Onboarding Questionnaire, User Query History, and Tailored Reel Generation.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId

import os

from fastapi import FastAPI, HTTPException, Depends, status, Response
from fastapi.middleware.cors import CORSMiddleware

from database import connect_to_mongo, close_mongo_connection, get_database
from models import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    UserProfileUpdateRequest,
    UserProfileResponse,
    TailoredReelGenerationRequest,
    UserQueryLogRequest
)
from services.personalization_service import create_tailored_reel, get_or_seed_teachings
from services.creatomate_service import render_video_with_creatomate, get_render_status
from seed_data import verify_quote_against_canon, VERIFIED_TEACHINGS_SEED
from auth import get_current_user, require_same_user

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to MongoDB on startup & seed default teachings
    await connect_to_mongo()
    db = get_database()
    if db is not None:
        await get_or_seed_teachings(db)
    yield
    # Close connection on shutdown
    await close_mongo_connection()

app = FastAPI(
    title="Teaching-to-Reel Backend API",
    description="Standalone Backend Service: Auth, User Profile Questionnaire, History & Reel Persistence.",
    version="2.0.0",
    lifespan=lifespan
)

# Only the EKAGRA website may call this API from a browser.
# Set ALLOWED_ORIGINS (comma-separated) to add the deployed site, e.g. https://ekagra.vercel.app
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,  # we use Authorization: Bearer tokens, not cookies
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ----------------- 1. AUTHENTICATION (FIREBASE) -----------------
# Sign-up, login, Google sign-in and password resets all happen in Firebase on the website.
# The website sends the Firebase ID token as "Authorization: Bearer <token>" on every request.

@app.post("/api/auth/session", response_model=UserResponse)
async def start_session(current_user: dict = Depends(get_current_user)):
    """Call right after login. Creates the user's record on first visit and returns their backend id."""
    return UserResponse(
        id=current_user["id"],
        name=current_user.get("name") or "Student",
        email=current_user.get("email") or "",
        role=current_user.get("role", "college_student"),
        preferred_language=current_user.get("preferred_language", "en"),
        created_at=current_user["createdAt"],
    )

@app.post("/api/auth/register", status_code=status.HTTP_410_GONE)
async def register_user_retired():
    """Retired: accounts are created with Firebase on the website."""
    raise HTTPException(status_code=410, detail="Sign up on the website (Firebase). Then call POST /api/auth/session.")

@app.post("/api/auth/login", status_code=status.HTTP_410_GONE)
async def login_user_retired():
    """Retired: login happens with Firebase on the website."""
    raise HTTPException(status_code=410, detail="Log in on the website (Firebase). Then call POST /api/auth/session.")

# ----------------- 2. USER PROFILE & ONBOARDING QUESTIONNAIRE -----------------

@app.post("/api/users/{user_id}/questionnaire", status_code=status.HTTP_200_OK)
async def save_questionnaire(user_id: str, payload: UserProfileUpdateRequest, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """
    Saves onboarding questionnaire answers, personal hurdles, and preferences.
    Used by the AI to make every reel tailor-made.
    """
    require_same_user(user_id, current_user)
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid User ID format")

    profile_data = {
        "userId": user_id,
        "life_stage": payload.life_stage,
        "primary_challenges": payload.primary_challenges,
        "interests": payload.interests,
        "reel_preferences": payload.reel_preferences.model_dump() if payload.reel_preferences else {
            "target_duration_sec": 45,
            "tone": "Energetic & Motivational",
            "include_micro_action": True
        },
        "questionnaire_responses": [q.model_dump() for q in payload.questionnaire_responses],
        "updatedAt": datetime.now(timezone.utc)
    }

    await db.user_profiles.update_one(
        {"userId": user_id},
        {"$set": profile_data},
        upsert=True
    )

    return {"status": "success", "message": "Questionnaire profile updated in MongoDB"}

@app.get("/api/users/{user_id}/profile")
async def get_user_profile(user_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Fetches user profile, interests, and questionnaire responses."""
    require_same_user(user_id, current_user)
    profile = await db.user_profiles.find_one({"userId": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile["_id"] = str(profile["_id"])
    return {"status": "success", "profile": profile}

# ----------------- 3. USER QUERY & SITUATION HISTORY -----------------

@app.post("/api/users/{user_id}/queries")
async def log_user_query(user_id: str, payload: UserQueryLogRequest, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Logs a situation or challenge the user submits over time."""
    require_same_user(user_id, current_user)
    query_doc = {
        "userId": user_id,
        "queryText": payload.query_text,
        "currentMood": payload.current_mood,
        "createdAt": datetime.now(timezone.utc)
    }
    result = await db.user_queries.insert_one(query_doc)
    return {"status": "success", "query_id": str(result.inserted_id)}

@app.get("/api/users/{user_id}/queries")
async def get_user_queries(user_id: str, limit: int = 10, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Fetches past questions asked by the user."""
    require_same_user(user_id, current_user)
    cursor = db.user_queries.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
    queries = await cursor.to_list(length=limit)
    for q in queries:
        q["_id"] = str(q["_id"])
    return {"status": "success", "count": len(queries), "queries": queries}

# ----------------- 4. TAILORED REEL GENERATION & PERSISTENCE -----------------

@app.post("/api/reels/generate-tailored")
async def generate_reel(payload: TailoredReelGenerationRequest, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """
    Combines:
    - User Profile & Demographics (MongoDB)
    - Onboarding Questionnaire (MongoDB)
    - Past Question History (MongoDB)
    - Canonical Swami Vivekananda Teaching (MongoDB)
    Then triggers LLM service and saves the reel document to MongoDB.
    """
    require_same_user(payload.user_id, current_user)

    try:
        reel = await create_tailored_reel(
            db=db,
            user_id=payload.user_id,
            situation_override=payload.situation_override,
            teaching_id=payload.teaching_id,
            language=payload.language,
            duration_sec=payload.duration_sec,
            theme=payload.theme
        )
        return {"status": "success", "reel": reel}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {str(e)}")

@app.post("/api/reels/{reel_id}/render-video")
async def render_reel_video_endpoint(reel_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """
    Online Video Rendering API: Uses Creatomate to generate a fast-paced 9:16 vertical video.
    Features: 4 acts, kinetic on-screen captions, b-roll cuts, and verified CWSV source citation badge.
    Updates the reel in MongoDB with the resulting MP4 videoUrl.
    """
    if not ObjectId.is_valid(reel_id):
        raise HTTPException(status_code=400, detail="Invalid Reel ID format")
    reel = await db.generated_reels.find_one({"_id": ObjectId(reel_id)}, {"userId": 1})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    require_same_user(reel.get("userId"), current_user)

    try:
        render_result = await render_video_with_creatomate(db, reel_id)
        return render_result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rendering error: {str(e)}")

@app.get("/api/voiceovers/{token}.wav")
async def get_voiceover(token: str, db=Depends(get_database)):
    """Voiceover audio for Creatomate. The long random token in the link is the only key."""
    if db is None or len(token) < 20:
        raise HTTPException(status_code=404, detail="Not found")
    doc = await db.voiceovers.find_one({"token": token}, {"audio": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(content=bytes(doc["audio"]), media_type="audio/wav")

@app.get("/api/reels/{reel_id}/render-status")
async def render_status_endpoint(reel_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """The website asks this every few seconds until the video is ready."""
    if not ObjectId.is_valid(reel_id):
        raise HTTPException(status_code=400, detail="Invalid Reel ID format")
    reel = await db.generated_reels.find_one({"_id": ObjectId(reel_id)}, {"userId": 1})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    require_same_user(reel.get("userId"), current_user)
    try:
        return await get_render_status(db, reel_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not check the video: {str(e)}")

@app.get("/api/reels/user/{user_id}")
async def get_user_reels(user_id: str, limit: int = 20, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Fetches all past generated reels for this user from MongoDB."""
    require_same_user(user_id, current_user)
    cursor = db.generated_reels.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
    reels = await cursor.to_list(length=limit)
    for r in reels:
        r["_id"] = str(r["_id"])
    return {"status": "success", "count": len(reels), "reels": reels}

@app.get("/api/reels/{reel_id}")
async def get_single_reel(reel_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Fetches a single reel by ID."""
    if not ObjectId.is_valid(reel_id):
        raise HTTPException(status_code=400, detail="Invalid Reel ID")
    reel = await db.generated_reels.find_one({"_id": ObjectId(reel_id)})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    require_same_user(reel.get("userId"), current_user)
    reel["_id"] = str(reel["_id"])
    return {"status": "success", "reel": reel}

# ----------------- 5. CANONICAL TEACHINGS & VERIFIER -----------------

@app.get("/api/health")
async def health():
    """Lets the hosting service (and the website) check the backend is awake."""
    return {"status": "ok"}

@app.get("/api/teachings")
async def list_teachings(db=Depends(get_database)):
    """Retrieves verified teachings stored in MongoDB."""
    cursor = db.verified_teachings.find({})
    teachings = await cursor.to_list(length=100)
    for t in teachings:
        t["_id"] = str(t["_id"])
    return {"status": "success", "count": len(teachings), "teachings": teachings}

@app.post("/api/verify-quote")
async def verify_quote(payload: dict):
    """Guardrail: Verifies if a quote is genuinely from Swami Vivekananda."""
    quote = payload.get("quote", "").strip()
    if not quote:
        raise HTTPException(status_code=400, detail="Quote text required")
    res = verify_quote_against_canon(quote)
    return {"status": "success", "quote": quote, "result": res}
