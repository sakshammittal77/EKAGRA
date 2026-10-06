"""
Teaching-to-Reel Generator: Standalone FastAPI Backend with MongoDB.
Completely decoupled from frontend and raw LLM layers.
Serves Auth, Onboarding Questionnaire, User Query History, and Tailored Reel Generation.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId

from fastapi import FastAPI, HTTPException, Depends, status
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
from services.creatomate_service import render_video_with_creatomate
from seed_data import verify_quote_against_canon, VERIFIED_TEACHINGS_SEED

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

# Enable CORS for frontend website teammate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- 1. AUTHENTICATION & LOGIN -----------------

@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(payload: UserRegisterRequest, db=Depends(get_database)):
    """Registers a new user and sets up their initial personalization profile."""
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name": payload.name,
        "email": payload.email.lower(),
        "password": payload.password,
        "role": payload.role,
        "preferred_language": payload.preferred_language,
        "createdAt": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Initialize empty profile with default preferences
    await db.user_profiles.insert_one({
        "userId": user_id,
        "life_stage": payload.role,
        "primary_challenges": ["fear_of_failure", "stage_fear", "lack_of_focus"],
        "interests": ["mental_resilience", "courage", "concentration"],
        "reel_preferences": {
            "target_duration_sec": 45,
            "tone": "Energetic & Motivational",
            "include_micro_action": True
        },
        "questionnaire_responses": [],
        "updatedAt": datetime.now(timezone.utc)
    })

    return UserResponse(
        id=user_id,
        name=user_doc["name"],
        email=user_doc["email"],
        role=user_doc["role"],
        preferred_language=user_doc["preferred_language"],
        created_at=user_doc["createdAt"]
    )

@app.post("/api/auth/login", response_model=UserResponse)
async def login_user(payload: UserLoginRequest, db=Depends(get_database)):
    """Authenticates user and returns account details."""
    user = await db.users.find_one({"email": payload.email.lower(), "password": payload.password})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user.get("role", "college_student"),
        preferred_language=user.get("preferred_language", "hi"),
        created_at=user["createdAt"]
    )

# ----------------- 2. USER PROFILE & ONBOARDING QUESTIONNAIRE -----------------

@app.post("/api/users/{user_id}/questionnaire", status_code=status.HTTP_200_OK)
async def save_questionnaire(user_id: str, payload: UserProfileUpdateRequest, db=Depends(get_database)):
    """
    Saves onboarding questionnaire answers, personal hurdles, and preferences.
    Used by the AI to make every reel tailor-made.
    """
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
async def get_user_profile(user_id: str, db=Depends(get_database)):
    """Fetches user profile, interests, and questionnaire responses."""
    profile = await db.user_profiles.find_one({"userId": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile["_id"] = str(profile["_id"])
    return {"status": "success", "profile": profile}

# ----------------- 3. USER QUERY & SITUATION HISTORY -----------------

@app.post("/api/users/{user_id}/queries")
async def log_user_query(user_id: str, payload: UserQueryLogRequest, db=Depends(get_database)):
    """Logs a situation or challenge the user submits over time."""
    query_doc = {
        "userId": user_id,
        "queryText": payload.query_text,
        "currentMood": payload.current_mood,
        "createdAt": datetime.now(timezone.utc)
    }
    result = await db.user_queries.insert_one(query_doc)
    return {"status": "success", "query_id": str(result.inserted_id)}

@app.get("/api/users/{user_id}/queries")
async def get_user_queries(user_id: str, limit: int = 10, db=Depends(get_database)):
    """Fetches past questions asked by the user."""
    cursor = db.user_queries.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
    queries = await cursor.to_list(length=limit)
    for q in queries:
        q["_id"] = str(q["_id"])
    return {"status": "success", "count": len(queries), "queries": queries}

# ----------------- 4. TAILORED REEL GENERATION & PERSISTENCE -----------------

@app.post("/api/reels/generate-tailored")
async def generate_reel(payload: TailoredReelGenerationRequest, db=Depends(get_database)):
    """
    Combines:
    - User Profile & Demographics (MongoDB)
    - Onboarding Questionnaire (MongoDB)
    - Past Question History (MongoDB)
    - Canonical Swami Vivekananda Teaching (MongoDB)
    Then triggers LLM service and saves the reel document to MongoDB.
    """
    if not ObjectId.is_valid(payload.user_id):
        raise HTTPException(status_code=400, detail="Invalid User ID format")

    try:
        reel = await create_tailored_reel(
            db=db,
            user_id=payload.user_id,
            situation_override=payload.situation_override,
            teaching_id=payload.teaching_id,
            language=payload.language,
            duration_sec=payload.duration_sec
        )
        return {"status": "success", "reel": reel}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {str(e)}")

@app.post("/api/reels/{reel_id}/render-video")
async def render_reel_video_endpoint(reel_id: str, db=Depends(get_database)):
    """
    Online Video Rendering API: Uses Creatomate to generate a fast-paced 9:16 vertical video.
    Features: 4 acts, kinetic on-screen captions, b-roll cuts, and verified CWSV source citation badge.
    Updates the reel in MongoDB with the resulting MP4 videoUrl.
    """
    if not ObjectId.is_valid(reel_id):
        raise HTTPException(status_code=400, detail="Invalid Reel ID format")

    try:
        render_result = await render_video_with_creatomate(db, reel_id)
        return render_result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rendering error: {str(e)}")

@app.get("/api/reels/user/{user_id}")
async def get_user_reels(user_id: str, limit: int = 20, db=Depends(get_database)):
    """Fetches all past generated reels for this user from MongoDB."""
    cursor = db.generated_reels.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
    reels = await cursor.to_list(length=limit)
    for r in reels:
        r["_id"] = str(r["_id"])
    return {"status": "success", "count": len(reels), "reels": reels}

@app.get("/api/reels/{reel_id}")
async def get_single_reel(reel_id: str, db=Depends(get_database)):
    """Fetches a single reel by ID."""
    if not ObjectId.is_valid(reel_id):
        raise HTTPException(status_code=400, detail="Invalid Reel ID")
    reel = await db.generated_reels.find_one({"_id": ObjectId(reel_id)})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    reel["_id"] = str(reel["_id"])
    return {"status": "success", "reel": reel}

# ----------------- 5. CANONICAL TEACHINGS & VERIFIER -----------------

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
