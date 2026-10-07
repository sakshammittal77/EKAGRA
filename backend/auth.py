"""
Firebase Authentication bridge.

The website signs people in with Firebase (Google or email + password).
Every request to this API carries the user's Firebase ID token:

    Authorization: Bearer <firebase-id-token>

`get_current_user` checks that token with Google's public keys and returns the
matching user document from MongoDB (creating it on first visit). Passwords are
never sent to or stored by this backend.
"""

import os
import logging
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from database import get_database

logger = logging.getLogger("uvicorn.info")

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "ekagra-dfe37")

# Reuse one HTTP session so Google's signing keys are not re-downloaded on every request.
_google_request = google_requests.Request()

DEFAULT_PROFILE = {
    "life_stage": "college_student",
    "primary_challenges": [],
    "interests": [],
    "reel_preferences": {
        "target_duration_sec": 45,
        "tone": "Energetic & Motivational",
        "include_micro_action": True,
    },
    "questionnaire_responses": [],
}


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


# Local development only: DEV_AUTH=true accepts "Bearer dev:<name>" instead of a Firebase token,
# so the whole app runs on one computer without Firebase. Never set this on a hosted server.
DEV_AUTH = os.getenv("DEV_AUTH", "").lower() in ("1", "true", "yes")
if DEV_AUTH:
    logger.warning("DEV_AUTH is ON: 'dev:<name>' tokens are accepted. Local development only.")


def _dev_claims(token: str) -> dict:
    name = token[4:].strip()[:40] or "Student"
    slug = "".join(c for c in name.lower() if c.isalnum()) or "student"
    return {"sub": f"dev-{slug}", "name": name, "email": f"{slug}@dev.local", "email_verified": True}


def verify_firebase_token(token: str) -> dict:
    """Returns the token's claims if it is a valid ID token for our Firebase project."""
    if DEV_AUTH and token.startswith("dev:"):
        return _dev_claims(token)
    try:
        claims = id_token.verify_firebase_token(token, _google_request, audience=FIREBASE_PROJECT_ID)
    except ValueError as exc:  # bad signature, expired, wrong project, malformed
        raise _unauthorized(f"Invalid login token: {exc}")
    except Exception as exc:  # could not reach Google to fetch keys
        logger.error(f"Firebase token check failed: {exc}")
        raise HTTPException(status_code=503, detail="Could not verify login right now. Try again.")

    if not claims or not claims.get("sub"):
        raise _unauthorized("Invalid login token")
    if claims.get("iss") != f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}":
        raise _unauthorized("Login token is not from this app")
    # Email + password accounts must confirm their email first (Google accounts are already verified).
    provider = (claims.get("firebase") or {}).get("sign_in_provider")
    if provider == "password" and not claims.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email first")
    return claims


async def get_current_user(authorization: str = Header(default=""), db=Depends(get_database)) -> dict:
    """FastAPI dependency: the signed-in user's MongoDB document, with `id` as a string."""
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized("Please log in")
    if db is None:
        raise HTTPException(status_code=503, detail="Database is not available")

    claims = verify_firebase_token(token)
    uid = claims["sub"]
    email = (claims.get("email") or "").lower() or None
    now = datetime.now(timezone.utc)

    user = await db.users.find_one({"firebaseUid": uid})
    if user is None and email and claims.get("email_verified"):
        # An account made earlier with the same (verified) email: attach it to this Firebase login.
        # Unverified emails are never merged, so nobody can claim someone else's account.
        user = await db.users.find_one({"email": email, "firebaseUid": {"$exists": False}})
        if user is not None:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"firebaseUid": uid}, "$unset": {"password": ""}},
            )
            user["firebaseUid"] = uid

    if user is None:
        doc = {
            "firebaseUid": uid,
            "name": claims.get("name") or (email.split("@")[0] if email else "Student"),
            "email": email,
            "role": "college_student",
            "preferred_language": "en",
            "createdAt": now,
        }
        result = await db.users.insert_one(doc)
        doc["_id"] = result.inserted_id
        user = doc

    user_id = str(user["_id"])
    await db.user_profiles.update_one(
        {"userId": user_id},
        {"$setOnInsert": {"userId": user_id, **DEFAULT_PROFILE, "updatedAt": now}},
        upsert=True,
    )

    user["id"] = user_id
    return user


def require_same_user(path_user_id: str, current_user: dict) -> None:
    """Stops one student from reading or changing another student's data."""
    if path_user_id != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only access your own data")
