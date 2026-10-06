"""
LLM Client Interface (Contract with LLM Teammate).
Decoupled module for AI reel generation.
Your LLM teammate can update the prompt or model logic here without breaking backend/database code.
"""

import os
import json
from typing import Dict, Any, List

def format_timestamp(seconds: float) -> str:
    """Format seconds into SRT timestamp: HH:MM:SS,mmm"""
    millis = int((seconds - int(seconds)) * 1000)
    secs = int(seconds) % 60
    mins = (int(seconds) // 60) % 60
    hours = int(seconds) // 3600
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def calculate_scene_timings(duration_sec: int) -> List[Dict[str, Any]]:
    """Calculates standardized scene beat allocations for 30s, 45s, or 60s reels."""
    d = float(duration_sec)
    if d <= 35:
        return [
            {"scene_number": 1, "name": "Hook", "start": 0.0, "end": 4.0},
            {"scene_number": 2, "name": "Modern Situation", "start": 4.0, "end": 12.0},
            {"scene_number": 3, "name": "Authentic Teaching", "start": 12.0, "end": 22.0},
            {"scene_number": 4, "name": "Micro-Action", "start": 22.0, "end": 27.0},
            {"scene_number": 5, "name": "Outro & Reflection", "start": 27.0, "end": 30.0}
        ]
    elif d <= 50:
        return [
            {"scene_number": 1, "name": "Hook", "start": 0.0, "end": 5.0},
            {"scene_number": 2, "name": "Modern Situation", "start": 5.0, "end": 18.0},
            {"scene_number": 3, "name": "Authentic Teaching", "start": 18.0, "end": 32.0},
            {"scene_number": 4, "name": "Micro-Action", "start": 32.0, "end": 40.0},
            {"scene_number": 5, "name": "Outro & Reflection", "start": 40.0, "end": 45.0}
        ]
    else:
        return [
            {"scene_number": 1, "name": "Hook", "start": 0.0, "end": 6.0},
            {"scene_number": 2, "name": "Modern Situation", "start": 6.0, "end": 24.0},
            {"scene_number": 3, "name": "Authentic Teaching", "start": 24.0, "end": 44.0},
            {"scene_number": 4, "name": "Micro-Action", "start": 44.0, "end": 54.0},
            {"scene_number": 5, "name": "Outro & Reflection", "start": 54.0, "end": 60.0}
        ]

async def call_llm_for_reel(
    user_context: Dict[str, Any],
    teaching: Dict[str, Any],
    situation: str,
    language: str,
    duration_sec: int,
    tone: str
) -> Dict[str, Any]:
    """
    Contract interface for the LLM teammate.
    
    Inputs provided by Backend:
    - user_context: dict with life_stage, past_challenges, past_questions
    - teaching: canonical verified teaching dict (quote, source, context)
    - situation: current life situation or problem entered by the user
    - language: target language code ('hi', 'en', 'bn', 'ta', 'te', 'mr')
    - duration_sec: 30, 45, or 60
    - tone: preferred narration style
    
    Output expected by Backend:
    Dict containing:
    - modern_scenario: str
    - scenes: list of scene dicts with visual_description, voiceover_text, on_screen_text
    - full_voiceover: str
    - srt_subtitles: str
    - takeaway_action: str
    """
    # Check if LLM teammate has set an API key / custom endpoint
    api_key = os.getenv("GEMINI_API_KEY")
    
    # 1. Standard Scene Timing Breakdown
    timings = calculate_scene_timings(duration_sec)
    
    # Language-aware default templates for robust fallback
    quote_text = teaching.get("quote", "")
    source_text = teaching.get("source", "The Complete Works of Swami Vivekananda")
    persona_label = user_context.get("life_stage", "youth")

    # If Hindi
    if language == "hi":
        hook_text = "क्या आप भी इस डर से भाग रहे हैं जो आपको बार-बार रोकता है?"
        modern_scene = f"{situation} - दिल की धड़कनें तेज हैं और मन कर रहा है कि पीछे हट जाएं।"
        bridge_text = f"स्वामी विवेकानंद ने कहा था: '{quote_text}'"
        action_text = "अगली बार जब डर सामने आए, 3 सेकंड रुकें और सीधे आगे बढ़ें। डर खुद पीछे हट जाएगा।"
        outro_text = "शेयर करें किसी ऐसे दोस्त के साथ जिसे आज इस साहस की जरूरत है।"
    else: # English default
        hook_text = "Ever felt the urge to run away when pressure hits you?"
        modern_scene = f"{situation} - palms sweating, heart racing, wanting an easy escape."
        bridge_text = f"Swami Vivekananda reminded us: '{quote_text}'"
        action_text = "Take 3 deep breaths, face the exact task you are avoiding, and take that single first step."
        outro_text = "Share this with someone who needs strength today."

    scenes = []
    srt_lines = []
    
    scene_scripts = [
        (timings[0], "Hook", "Fast paced visual, bold typography highlighting internal panic", hook_text, "Stop running away"),
        (timings[1], "Modern Situation", f"Relatable real-life scenario: {modern_scene}", modern_scene, "The struggle is real"),
        (timings[2], "Authentic Teaching", f"Visual of Swami Vivekananda with verified source badge ({source_text})", bridge_text, quote_text),
        (timings[3], "Micro-Action", "Clear modern action prompt, minimal focus visual", action_text, "Action Step"),
        (timings[4], "Outro & Reflection", "Call to reflect and share, calm closing aesthetic", outro_text, "Share the Strength")
    ]
    
    for i, (t_info, name, visual, vo, ost) in enumerate(scene_scripts, 1):
        s_time = t_info["start"]
        e_time = t_info["end"]
        time_label = f"{int(s_time):02d}:00 - {int(e_time):02d}:00"
        
        scenes.append({
            "scene_number": i,
            "name": name,
            "start_time": s_time,
            "end_time": e_time,
            "time_label": time_label,
            "visual_description": visual,
            "voiceover_text": vo,
            "on_screen_text": ost,
            "authentic_quote": quote_text if "Teaching" in name else None,
            "source_citation": source_text if "Teaching" in name else None
        })
        
        srt_lines.append(f"{i}\n{format_timestamp(s_time)} --> {format_timestamp(e_time)}\n{vo}\n")

    full_vo = " ".join([s["voiceover_text"] for s in scenes])
    srt_str = "\n".join(srt_lines)

    return {
        "modern_scenario": situation,
        "scenes": scenes,
        "full_voiceover": full_vo,
        "srt_subtitles": srt_str,
        "takeaway_action": action_text
    }
