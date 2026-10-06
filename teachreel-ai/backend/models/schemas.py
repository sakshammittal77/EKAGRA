from pydantic import BaseModel
from typing import List, Optional

class GenerateReelRequest(BaseModel):
    prompt: str
    duration: int = 45
    language: str = "English"
    style: str = "storytelling"

class ExtractedTopic(BaseModel):
    topic: str
    audience: str
    learning_objective: str
    duration: int
    style: str
    language: str

class ScenePlan(BaseModel):
    scene: int
    duration: int
    narration: str
    visual_prompt: str
    on_screen_text: str

class ScriptPlan(BaseModel):
    title: str
    hook: str
    scenes: List[ScenePlan]
    takeaway: str
    sources: List[str]

class GenerationStatus(BaseModel):
    generation_id: str
    status: str
    video_url: Optional[str] = None
    script: Optional[ScriptPlan] = None
