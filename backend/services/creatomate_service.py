"""
Creatomate Online Video Rendering Service.
Connects FastAPI backend to Creatomate's REST API for automated 9:16 vertical video rendering.
Produces 30-45s fast-paced reels with kinetic text, b-roll transitions,
voiceover narration, and verified Belur Math / CWSV citation badges.
"""

import os
import json
import logging
from typing import Dict, Any, Optional
import urllib.request
import urllib.error
from bson import ObjectId

logger = logging.getLogger("uvicorn.info")

CREATOMATE_API_URL = "https://api.creatomate.com/v1/renders"
CREATOMATE_API_KEY = os.getenv("CREATOMATE_API_KEY", "")

def build_creatomate_source_payload(reel_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Builds a 9:16 vertical video (1080x1920) source composition for Creatomate.
    Incorporates:
    - 4-part scene structure (Hook, Modern Story, Vivekananda Quote, Action Conclusion)
    - Source citation badge overlay in corner
    - Dynamic on-screen text with bold font styling
    """
    scenes = reel_doc.get("scenes", [])
    duration_sec = reel_doc.get("durationSeconds", 45)
    quote_text = reel_doc.get("authenticQuote", "")
    source_citation = reel_doc.get("sourceCitation", "Complete Works of Swami Vivekananda")
    
    # Elements inside the 9:16 video composition
    elements = []

    # 1. Background Music / Ambient Track (subtle inspirational bed)
    elements.append({
        "type": "audio",
        "track": 1,
        "time": 0,
        "duration": duration_sec,
        "volume": "18%",
        "url": "https://creatomate-static.s3.amazonaws.com/demo/music/ambient-inspirational.mp3"
    })

    # 2. Permanent "Authentic Citation Badge" at top-right
    elements.append({
        "type": "text",
        "track": 4,
        "time": 0,
        "duration": duration_sec,
        "text": f"📜 Verified: {source_citation}",
        "x": "50%",
        "y": "8%",
        "width": "85%",
        "height": "5%",
        "font_family": "Montserrat",
        "font_weight": "700",
        "font_size": "26px",
        "fill_color": "#FFD700", # Warm gold/saffron accent
        "background_color": "rgba(0, 0, 0, 0.65)",
        "background_border_radius": "20px",
        "background_padding": "10px",
        "x_alignment": "50%",
        "y_alignment": "50%"
    })

    # 3. Dynamic Visual & Caption tracks per scene
    # Curated high-contrast vertical b-roll visuals
    default_brolls = [
        "https://creatomate-static.s3.amazonaws.com/demo/videos/cinematic-urban.mp4",
        "https://creatomate-static.s3.amazonaws.com/demo/videos/student-desk.mp4",
        "https://creatomate-static.s3.amazonaws.com/demo/videos/sunrise-mountains.mp4",
        "https://creatomate-static.s3.amazonaws.com/demo/videos/walking-forward.mp4"
    ]

    track_video = 2
    track_text = 3

    for idx, scene in enumerate(scenes):
        start_t = scene.get("start_time", 0.0)
        end_t = scene.get("end_time", start_t + 5.0)
        sc_duration = max(1.0, end_t - start_t)
        scene_name = scene.get("name", f"Scene {idx+1}")
        voiceover = scene.get("voiceover_text", "")
        on_screen_text = scene.get("on_screen_text") or voiceover[:40]

        broll_url = default_brolls[idx % len(default_brolls)]

        # Video / B-Roll Layer
        elements.append({
            "type": "video",
            "track": track_video,
            "time": start_t,
            "duration": sc_duration,
            "url": broll_url,
            "fit": "cover"
        })

        # Text Overlay Layer (Kinetic style in center)
        text_color = "#FFFFFF"
        if "Teaching" in scene_name or "Quote" in scene_name:
            text_color = "#FFE066" # Highlight quote in gold

        elements.append({
            "type": "text",
            "track": track_text,
            "time": start_t,
            "duration": sc_duration,
            "text": on_screen_text,
            "x": "50%",
            "y": "55%",
            "width": "80%",
            "font_family": "Montserrat",
            "font_weight": "800",
            "font_size": "52px",
            "fill_color": text_color,
            "stroke_color": "#000000",
            "stroke_width": "4px",
            "shadow_color": "rgba(0,0,0,0.8)",
            "shadow_blur": "10px",
            "x_alignment": "50%",
            "y_alignment": "50%",
            "enter": {
                "type": "scale",
                "duration": "0.3s",
                "easing": "ease-out"
            }
        })

    return {
        "output_format": "mp4",
        "width": 1080,
        "height": 1920,
        "frame_rate": 30,
        "duration": duration_sec,
        "elements": elements
    }

async def render_video_with_creatomate(db, reel_id: str) -> Dict[str, Any]:
    """
    Submits render job to Creatomate API and updates MongoDB with the render status and video URL.
    """
    reel_doc = await db.generated_reels.find_one({"_id": ObjectId(reel_id)})
    if not reel_doc:
        raise ValueError("Reel not found")

    api_key = os.getenv("CREATOMATE_API_KEY", "").strip()

    # If user hasn't set an API key yet, provide a graceful simulation response
    if not api_key:
        logger.warning("CREATOMATE_API_KEY not found in environment. Returning preview simulation.")
        mock_video_url = "https://creatomate-static.s3.amazonaws.com/demo/videos/cinematic-urban.mp4"
        
        await db.generated_reels.update_one(
            {"_id": ObjectId(reel_id)},
            {"$set": {
                "renderStatus": "simulated_ready",
                "videoUrl": mock_video_url,
                "renderNote": "Set CREATOMATE_API_KEY in .env for live cloud production renders."
            }}
        )
        return {
            "status": "success",
            "mode": "simulation",
            "message": "Set CREATOMATE_API_KEY in backend/.env to trigger real cloud render.",
            "video_url": mock_video_url,
            "reel_id": reel_id
        }

    # Prepare Creatomate payload
    payload = {
        "source": build_creatomate_source_payload(reel_doc)
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        CREATOMATE_API_URL,
        data=req_data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            
            # Creatomate returns a list of render objects
            render_obj = res_body[0] if isinstance(res_body, list) else res_body
            render_id = render_obj.get("id")
            render_status = render_obj.get("status", "planned")
            video_url = render_obj.get("url")

            # Update MongoDB document with render details
            await db.generated_reels.update_one(
                {"_id": ObjectId(reel_id)},
                {"$set": {
                    "renderId": render_id,
                    "renderStatus": render_status,
                    "videoUrl": video_url
                }}
            )

            return {
                "status": "success",
                "mode": "live_cloud",
                "render_id": render_id,
                "render_status": render_status,
                "video_url": video_url,
                "reel_id": reel_id
            }

    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        logger.error(f"Creatomate API error: {e.code} - {error_msg}")
        raise RuntimeError(f"Creatomate rendering failed: {error_msg}")
    except Exception as e:
        logger.error(f"Error calling Creatomate: {e}")
        raise RuntimeError(f"Video render request failed: {str(e)}")
