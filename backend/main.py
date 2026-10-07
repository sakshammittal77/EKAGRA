"""
Teaching-to-Reel Generator: Standalone FastAPI Backend with MongoDB.
Completely decoupled from frontend and raw LLM layers.
Serves Auth, Onboarding Questionnaire, User Query History, and Tailored Reel Generation.
"""

from contextlib import asynccontextmanager
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from bson import ObjectId

import os

from fastapi import FastAPI, HTTPException, Depends, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from database import connect_to_mongo, close_mongo_connection, get_database
from models import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    UserProfileUpdateRequest,
    UserProfileResponse,
    TailoredReelGenerationRequest,
    UserQueryLogRequest,
    QuoteMatchRequest,
    FactCheckRequest,
    ReelEditRequest,
    TTSRequest,
)
from services.personalization_service import create_tailored_reel, get_or_seed_teachings
from services.creatomate_service import render_video_with_creatomate, get_render_status
from services.assistant_service import answer as assistant_answer
from pydantic import BaseModel, Field
from seed_data import verify_quote_against_canon, VERIFIED_TEACHINGS_SEED
from auth import get_current_user, require_same_user
from quotes_library import QUOTES, QUOTES_BY_ID, APP_THEMES, THEME_TITLES, as_teaching
from services.quote_selector import top_matches
from services.fact_check import check as fact_check_text
from services.care import care_check
from services.tts import synthesize
from services.captions import build_srt, build_vtt
from services.llm_client import generate_hook_variants, contains_quoted_passage

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
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
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

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    text: str = Field(..., max_length=2000)

class AssistantChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=20)
    shown_quote_ids: List[str] = Field(default_factory=list, max_length=20)
    language: Optional[str] = Field(None, pattern="^(en|hi)$")  # reply language chosen in Arya

class TranscribeRequest(BaseModel):
    audio: str = Field(..., max_length=8_000_000)  # base64, about 6 MB / 60 s of speech at most
    mime: str = Field("audio/webm", max_length=60)
    language: Optional[str] = Field(None, pattern="^(en|hi)$")

@app.post("/api/assistant/transcribe")
async def assistant_transcribe(payload: TranscribeRequest, current_user: dict = Depends(get_current_user)):
    """Arya's mic: turns the recorded voice into text (Whisper on Groq, Gemini as backup)."""
    import asyncio as _asyncio, base64 as _b64
    from services.transcribe import transcribe
    try:
        audio = _b64.b64decode(payload.audio, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Audio is not valid base64")
    if len(audio) < 800:
        return {"text": "", "why": "too_short"}
    text, why = await _asyncio.to_thread(transcribe, audio, payload.mime, payload.language)
    if text is None:
        raise HTTPException(status_code=503, detail=f"Could not understand the recording right now ({why})")
    return {"text": text, "why": why}

@app.post("/api/assistant/chat")
async def assistant_chat(payload: AssistantChatRequest, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """'How are you feeling?' assistant: kind reply + one exact quote (picked by ID) + one small action."""
    msgs = [m.model_dump() for m in payload.messages]
    if msgs[-1]["role"] != "user":
        raise HTTPException(status_code=400, detail="The last message must be from the student")
    result = await assistant_answer(msgs, payload.shown_quote_ids, payload.language)
    # Remember what the student shared, so their reels can be personalised later.
    await db.user_queries.insert_one({
        "userId": current_user["id"],
        "queryText": msgs[-1]["text"],
        "currentMood": result.get("feeling") or None,
        "source": "assistant",
        "matchedTeachingId": (result.get("quote") or {}).get("id"),
        "crisis": bool(result.get("crisis")),
        "createdAt": datetime.now(timezone.utc),
    })
    return result

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
        return {"status": "success", "reel": reel, "care": care_check(payload.situation_override)}
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

@app.get("/api/health/ai")
async def health_ai():
    """Tiny test call to every Gemini and Groq model; shows only status codes (never the keys)."""
    import requests as _rq
    from services.ai_text import GEMINI_MODELS, GEMINI_URL, GROQ_MODELS, GROQ_URL

    def _msg(r):
        if r.status_code == 200:
            return ""
        try:
            return str(r.json().get("error", {}).get("message", ""))[:160]
        except Exception:
            return r.text[:160]

    out = {}
    gkey = os.getenv("GEMINI_API_KEY", "").strip()
    out["gemini_key_set"] = bool(gkey)
    if gkey:
        res = {}
        for model in dict.fromkeys(GEMINI_MODELS):
            try:
                r = _rq.post(GEMINI_URL.format(model=model), timeout=20,
                             headers={"x-goog-api-key": gkey, "Content-Type": "application/json"},
                             json={"contents": [{"role": "user", "parts": [{"text": "Say OK"}]}]})
                res[model] = {"http": r.status_code, "message": _msg(r)}
            except Exception as exc:
                res[model] = {"http": None, "message": type(exc).__name__}
        out["gemini_models"] = res
    qkey = os.getenv("GROQ_API_KEY", "").strip()
    out["groq_key_set"] = bool(qkey)
    if qkey:
        res = {}
        for model in dict.fromkeys(GROQ_MODELS):
            try:
                r = _rq.post(GROQ_URL, timeout=20,
                             headers={"Authorization": f"Bearer {qkey}", "Content-Type": "application/json"},
                             json={"model": model, "max_tokens": 20,
                                   "messages": [{"role": "user", "content": "Say OK"}]})
                res[model] = {"http": r.status_code, "message": _msg(r)}
            except Exception as exc:
                res[model] = {"http": None, "message": type(exc).__name__}
        out["groq_models"] = res
        try:  # speech-to-text models available to this key (for Arya's mic)
            r = _rq.get("https://api.groq.com/openai/v1/models", timeout=20, headers={"Authorization": f"Bearer {qkey}"})
            ids = [m.get("id") for m in (r.json().get("data") or [])] if r.status_code == 200 else []
            out["groq_speech_models"] = [i for i in ids if i and "whisper" in i] or f"http {r.status_code}"
        except Exception as exc:
            out["groq_speech_models"] = type(exc).__name__
    return out

@app.get("/api/health")
async def health():
    """Lets the hosting service (and the website) check the backend is awake.
    Also says WHETHER each key is set (true/false only, never the key itself)."""
    return {
        "status": "ok",
        "version": (os.getenv("RENDER_GIT_COMMIT") or "local")[:7],
        "video_key_set": bool(os.getenv("CREATOMATE_API_KEY", "").strip()),
        "gemini_key_set": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "groq_key_set": bool(os.getenv("GROQ_API_KEY", "").strip()),
        "backend_address_known": bool(os.getenv("PUBLIC_BACKEND_URL") or os.getenv("RENDER_EXTERNAL_URL")),
    }

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

@app.post("/api/tts")
async def text_to_speech(payload: TTSRequest):
    """Natural narration (neural voice) as base64 MP3 + word timings. Used by reels and Arya."""
    try:
        return {"status": "success", **await synthesize(payload.text, payload.lang, payload.voice)}
    except Exception as e:  # no internet, service unavailable
        raise HTTPException(status_code=503, detail=f"Voice service unavailable: {type(e).__name__}")

@app.post("/api/fact-check")
async def fact_check(payload: FactCheckRequest):
    """Checks a quote seen online against the verified library: verified, near-exact, paraphrase or not found."""
    return {"status": "success", **fact_check_text(payload.text)}

# ----------------- 6. VERIFIED LIBRARY (PUBLIC) -----------------

def _public_quote(q: dict) -> dict:
    t = as_teaching(q)
    return {"id": t["id"], "text": t["quote"], "themes": q["themes"], "theme": t["theme"],
            "app_themes": [a for a, wanted in APP_THEMES.items() if any(x in wanted for x in q["themes"])],
            "situations": q["situations"], "source": t["source"], "source_url": t["source_url"],
            "volume": q["volume"], "chapter": q["chapter"]}

@app.get("/api/quotes")
async def list_quotes(theme: Optional[str] = None):
    """The whole verified library (or one app theme), straight from quotes_library.py."""
    quotes = [_public_quote(q) for q in QUOTES]
    if theme:
        quotes = [q for q in quotes if theme in q["app_themes"]]
    return {"status": "success", "count": len(quotes), "theme_titles": THEME_TITLES, "quotes": quotes}

@app.get("/api/quotes/daily")
async def daily_quote():
    """Same passage for everyone on a given day."""
    q = QUOTES[date.today().toordinal() % len(QUOTES)]
    return {"status": "success", "date": date.today().isoformat(), "quote": _public_quote(q)}

@app.post("/api/quotes/match")
async def match_quotes(payload: QuoteMatchRequest):
    """Live preview while typing: the passages that best fit a situation, and which words matched."""
    matches = top_matches(payload.situation, payload.theme, k=payload.limit)
    return {"status": "success", "care": care_check(payload.situation),
            "matches": [{**_public_quote(QUOTES_BY_ID[m["id"]]), **m} for m in matches]}

# ----------------- 7. REEL EDITING, HOOKS, CAPTIONS, STATS -----------------

async def _own_reel(db, reel_id: str, current_user: dict) -> dict:
    if not ObjectId.is_valid(reel_id):
        raise HTTPException(status_code=400, detail="Invalid Reel ID format")
    reel = await db.generated_reels.find_one({"_id": ObjectId(reel_id)})
    if not reel:
        raise HTTPException(status_code=404, detail="Reel not found")
    require_same_user(reel.get("userId"), current_user)
    return reel

@app.patch("/api/reels/{reel_id}")
async def edit_reel(reel_id: str, payload: ReelEditRequest, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """
    Edits the AI-written scenes (hook, situation, action, outro). The scene with his words is locked,
    and edits may not contain quoted passages, so nobody can put new words in his mouth.
    """
    reel = await _own_reel(db, reel_id, current_user)
    scenes = reel.get("scenes", [])
    by_num = {s["scene_number"]: s for s in scenes}
    for edit in payload.scenes:
        scene = by_num.get(edit.scene_number)
        if not scene:
            raise HTTPException(status_code=404, detail=f"Scene {edit.scene_number} not found")
        if scene.get("authentic_quote"):
            raise HTTPException(status_code=400, detail="The scene with Swami Vivekananda's words is locked and cannot be edited.")
        for field in ("on_screen_text", "voiceover_text", "visual_description"):
            value = getattr(edit, field)
            if value is None:
                continue
            if contains_quoted_passage(value):
                raise HTTPException(status_code=422, detail="Edits can't contain quoted passages. His words are only added from the verified library.")
            scene[field] = value.strip()
    update = {
        "scenes": scenes,
        "fullVoiceover": " ".join(s.get("voiceover_text", "") for s in scenes),
        "srtSubtitles": build_srt(scenes),
        "takeawayAction": next((s["voiceover_text"] for s in scenes if s.get("name") == "Micro-Action"), reel.get("takeawayAction")),
        "editedAt": datetime.now(timezone.utc),
    }
    # The old video no longer matches the script.
    await db.generated_reels.update_one({"_id": reel["_id"]}, {"$set": update, "$unset": {"videoUrl": "", "renderStatus": "", "renderId": ""}})
    for k in ("videoUrl", "renderStatus", "renderId"):
        reel.pop(k, None)
    reel.update(update)
    reel["_id"] = str(reel["_id"])
    return {"status": "success", "reel": reel}

@app.delete("/api/reels/{reel_id}")
async def delete_reel(reel_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    reel = await _own_reel(db, reel_id, current_user)
    await db.generated_reels.delete_one({"_id": reel["_id"]})
    return {"status": "success", "deleted": reel_id}

@app.post("/api/reels/{reel_id}/hooks")
async def hook_variants(reel_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Three alternative opening hooks to choose from (then saved with PATCH)."""
    reel = await _own_reel(db, reel_id, current_user)
    quote = QUOTES_BY_ID.get(reel.get("teachingId"))
    teaching = as_teaching(quote) if quote else {"quote": reel.get("authenticQuote", ""), "themes": []}
    current = next((s.get("voiceover_text", "") for s in reel.get("scenes", []) if s.get("name") == "Hook"), "")
    situation = (reel.get("personalizationContext") or {}).get("situationAddressed", "")
    return {"status": "success", **await generate_hook_variants(teaching, situation, reel.get("language", "en"), current)}

@app.get("/api/reels/{reel_id}/captions", response_class=PlainTextResponse)
async def reel_captions(reel_id: str, format: str = "srt", db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Subtitles file for the reel: ?format=srt (default) or vtt."""
    reel = await _own_reel(db, reel_id, current_user)
    scenes = reel.get("scenes", [])
    if format == "vtt":
        return PlainTextResponse(build_vtt(scenes), media_type="text/vtt")
    return PlainTextResponse(build_srt(scenes), media_type="application/x-subrip")

@app.get("/api/users/{user_id}/stats")
async def user_stats(user_id: str, db=Depends(get_database), current_user: dict = Depends(get_current_user)):
    """Numbers for the dashboard: reels made, languages, passages used, day streak, last 7 days."""
    require_same_user(user_id, current_user)
    reels = await db.generated_reels.find(
        {"userId": user_id}, {"language": 1, "teachingId": 1, "createdAt": 1, "durationSeconds": 1}
    ).to_list(length=1000)
    days = Counter(r["createdAt"].date() for r in reels if r.get("createdAt"))
    today = datetime.now(timezone.utc).date()
    streak, d = 0, (today if today in days else today - timedelta(days=1))
    while d in days:
        streak, d = streak + 1, d - timedelta(days=1)
    themes = Counter(QUOTES_BY_ID[r["teachingId"]]["themes"][0] for r in reels if r.get("teachingId") in QUOTES_BY_ID)
    return {
        "status": "success",
        "reels": len(reels),
        "seconds": sum(r.get("durationSeconds", 0) for r in reels),
        "passages": len({r.get("teachingId") for r in reels if r.get("teachingId")}),
        "library_size": len(QUOTES),
        "languages": dict(Counter(r.get("language", "en") for r in reels)),
        "themes": {THEME_TITLES.get(k, k): v for k, v in themes.most_common()},
        "streak": streak,
        "last7": [{"date": (today - timedelta(days=i)).isoformat(), "count": days.get(today - timedelta(days=i), 0)}
                  for i in range(6, -1, -1)],
    }
