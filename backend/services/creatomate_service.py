"""
Creatomate video rendering (9:16 reels).

Uses Creatomate's RenderScript API (POST /v2/renders): we describe the whole video in
JSON, so no template has to be designed on their website. Every scene is a coloured
card with animated captions; the quote scene shows his exact words and the source.
A Gemini voiceover (services/voice_service.py) is added when possible, and the scenes
follow its timing. No outside video/music links are needed.

Rendering takes a while, so:
  1. POST /api/reels/{id}/render-video   starts the render
  2. GET  /api/reels/{id}/render-status  is polled by the website until it is ready
"""

import asyncio
import logging
import os
from typing import Any, Dict

import requests
from bson import ObjectId

from services.voice_service import ensure_voiceover, public_audio_url, scene_texts, split_timings

logger = logging.getLogger("uvicorn.info")

API = "https://api.creatomate.com/v2/renders"

# Scene background colours (dark, warm; text stays readable).
BACKGROUNDS = ["#1b120c", "#2a1a10", "#3b1d0e", "#14202a", "#1b120c"]
SAFFRON = "#f4a340"
CREAM = "#fbf3e4"
FONT = "Montserrat"


def _key() -> str:
    return os.getenv("CREATOMATE_API_KEY", "").strip()


def _text(text, y, height, color=CREAM, weight="800", width="84%", font_size=None, slide=True):
    el = {
        "type": "text",
        "text": text,
        "x": "50%", "y": y, "width": width, "height": height,
        "x_alignment": "50%", "y_alignment": "50%",
        "fill_color": color,
        "font_family": FONT, "font_weight": weight,
        "line_height": "125%",
    }
    if font_size:
        el["font_size"] = font_size  # otherwise Creatomate shrinks the text to fit the box
    if slide:
        el["animations"] = [{
            "time": 0, "duration": 0.8, "easing": "quadratic-out",
            "type": "text-slide", "scope": "split-clip", "split": "line", "direction": "up",
        }]
    return el


def build_render_script(reel: Dict[str, Any], voice: Dict[str, Any] = None) -> Dict[str, Any]:
    scenes = reel.get("scenes", [])
    total = float(reel.get("durationSeconds", 45))
    timings = None
    if voice:
        # Scenes follow the voice: each gets a share of the audio for what it says.
        total = round(float(voice["seconds"]) + 1.2, 2)
        timings = split_timings(scene_texts(reel), float(voice["seconds"]))
    quote = reel.get("authenticQuote", "")
    source = reel.get("sourceCitation", "The Complete Works of Swami Vivekananda")

    cards = []
    for i, s in enumerate(scenes):
        if timings:
            start, dur = timings[i]
            if i == len(scenes) - 1:
                dur = total - start  # last card stays until the end
        else:
            start = float(s.get("start_time", 0))
            dur = max(1.0, float(s.get("end_time", start + 5)) - start)
        is_quote = bool(s.get("authentic_quote"))
        elements = []
        if is_quote:
            elements += [
                _text("SWAMI VIVEKANANDA", "16%", "5%", SAFFRON, "700", font_size="4.2 vmin", slide=False),
                _text(f"“{quote}”", "48%", "56%", CREAM, "700"),
                _text(source, "84%", "9%", SAFFRON, "500", width="80%"),
            ]
        else:
            main = (s.get("on_screen_text") or s.get("voiceover_text") or "").strip()
            sub = (s.get("voiceover_text") or "").strip()
            elements.append(_text(main, "38%", "30%", CREAM, "800"))
            if sub and sub != main:
                elements.append(_text(sub, "68%", "24%", "#e9dcc6", "500", slide=False))
        cards.append({
            "type": "composition",
            "track": 1,
            "time": start,
            "duration": dur,
            "fill_color": BACKGROUNDS[i % len(BACKGROUNDS)],
            "elements": elements,
            "animations": [{"time": 0, "duration": 0.6, "transition": True, "type": "fade"}] if i else [],
        })

    # Small brand + source line on every frame.
    footer = _text("EKAGRA · Words verified from the Complete Works", "95%", "3%", "#bfa98a", "600",
                   font_size="2.4 vmin", slide=False)
    footer.update({"track": 2, "time": 0, "duration": total})

    elements = cards + [footer]
    if voice:
        elements.append({"type": "audio", "track": 4, "time": 0.3, "source": voice["url"], "volume": "100%"})
    music = os.getenv("CREATOMATE_MUSIC_URL", "").strip()  # optional: a music file link you own
    if music:
        elements.append({"type": "audio", "track": 3, "time": 0, "duration": total,
                         "source": music, "volume": "12%" if voice else "25%", "audio_fade_out": 2})

    return {
        "output_format": "mp4",
        # 720x1280 at 25 fps uses far fewer Creatomate credits than 1080p and looks fine on phones.
        # Set CREATOMATE_HD=1 on Render for full 1080x1920 (about 2-3x the credits).
        **({"width": 1080, "height": 1920, "frame_rate": 30} if os.getenv("CREATOMATE_HD") == "1"
           else {"width": 720, "height": 1280, "frame_rate": 25}),
        "duration": total,
        "elements": elements,
    }


def _post(script):
    r = requests.post(API, json=script, timeout=30,
                      headers={"Authorization": f"Bearer {_key()}", "Content-Type": "application/json"})
    if r.status_code >= 300:
        raise RuntimeError(f"Creatomate said {r.status_code}: {r.text[:300]}")
    data = r.json()
    return data[0] if isinstance(data, list) else data


def _get(render_id):
    r = requests.get(f"{API}/{render_id}", timeout=20, headers={"Authorization": f"Bearer {_key()}"})
    if r.status_code >= 300:
        raise RuntimeError(f"Creatomate said {r.status_code}: {r.text[:300]}")
    return r.json()


async def render_video_with_creatomate(db, reel_id: str) -> Dict[str, Any]:
    """Starts a render. Returns at once; the website then polls get_render_status."""
    reel = await db.generated_reels.find_one({"_id": ObjectId(reel_id)})
    if not reel:
        raise ValueError("Reel not found")

    if not _key():
        return {"status": "not_configured", "mode": "not_configured", "reel_id": reel_id,
                "message": "The video service key (CREATOMATE_API_KEY) is not added on the backend yet."}

    # A finished video already exists: reuse it instead of spending credits again.
    if reel.get("renderStatus") == "succeeded" and reel.get("videoUrl"):
        return {"status": "succeeded", "mode": "live_cloud", "video_url": reel["videoUrl"], "reel_id": reel_id}

    # Voiceover (Gemini). If it can't be made, the video is still made with captions only.
    voice = None
    if public_audio_url("x").startswith("http"):
        try:
            info = await ensure_voiceover(db, reel)
            if info:
                voice = {**info, "url": public_audio_url(info["token"])}
        except Exception as exc:
            logger.warning(f"Voiceover skipped: {type(exc).__name__}: {exc}")
    else:
        logger.warning("Voiceover skipped: backend address unknown (set PUBLIC_BACKEND_URL).")

    render = await asyncio.to_thread(_post, build_render_script(reel, voice))
    status = render.get("status", "planned")
    update = {"renderId": render.get("id"), "renderStatus": status}
    if status == "succeeded":
        update["videoUrl"] = render.get("url")
    await db.generated_reels.update_one({"_id": ObjectId(reel_id)}, {"$set": update, "$unset": {"renderNote": ""}})
    return {"status": status, "mode": "live_cloud", "render_id": render.get("id"), "voiceover": bool(voice),
            "video_url": update.get("videoUrl"), "reel_id": reel_id}


async def get_render_status(db, reel_id: str) -> Dict[str, Any]:
    reel = await db.generated_reels.find_one({"_id": ObjectId(reel_id)})
    if not reel:
        raise ValueError("Reel not found")
    if reel.get("renderStatus") == "succeeded" and reel.get("videoUrl"):
        return {"status": "succeeded", "video_url": reel["videoUrl"], "reel_id": reel_id}
    if not reel.get("renderId") or not _key():
        return {"status": "not_started", "reel_id": reel_id}

    render = await asyncio.to_thread(_get, reel["renderId"])
    status = render.get("status", "rendering")
    update = {"renderStatus": status}
    if status == "succeeded":
        update["videoUrl"] = render.get("url")
        # Creatomate has the voice now; free the database space (about 2 MB per reel).
        await db.voiceovers.delete_many({"reelId": reel_id})
        update["voiceover.token"] = None
    if status == "failed":
        update["renderError"] = render.get("error_message", "")
        logger.error(f"Creatomate render failed: {update['renderError']}")
    await db.generated_reels.update_one({"_id": ObjectId(reel_id)}, {"$set": update})
    return {"status": status, "video_url": update.get("videoUrl"),
            "error": update.get("renderError"), "reel_id": reel_id}
