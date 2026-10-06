"""
Pydantic V2 Schemas for FastAPI & MongoDB.
Handles user authentication, personalization questionnaires, query histories,
verified teachings, and tailor-made reel generation output.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field

# --- User & Auth Models ---

class UserRegisterRequest(BaseModel):
    name: str = Field(..., example="Arjun Sharma")
    email: str = Field(..., example="arjun@example.com")
    password: str = Field(..., min_length=6, example="securePassword123")
    role: str = Field("college_student", example="college_student") # college_student, working_professional, creator
    preferred_language: str = Field("hi", example="hi") # hi, en, bn, ta, te, mr

class UserLoginRequest(BaseModel):
    email: str = Field(..., example="arjun@example.com")
    password: str = Field(..., example="securePassword123")

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    preferred_language: str
    created_at: datetime

# --- Onboarding Questionnaire & Personalization Profile ---

class QuestionnaireAnswer(BaseModel):
    question_key: str = Field(..., example="biggest_hurdle")
    question_text: str = Field(..., example="What holds you back most in daily life?")
    selected_option: str = Field(..., example="Fear of what friends or peers will think")

class ReelPreferences(BaseModel):
    target_duration_sec: int = Field(45, ge=30, le=60, example=45)
    tone: str = Field("Energetic & Motivational", example="Energetic & Motivational")
    include_micro_action: bool = Field(True, example=True)

class UserProfileUpdateRequest(BaseModel):
    life_stage: str = Field("college_student", example="college_student")
    primary_challenges: List[str] = Field(
        default=["fear_of_failure", "stage_fear", "lack_of_focus"],
        example=["fear_of_failure", "stage_fear", "lack_of_focus"]
    )
    interests: List[str] = Field(
        default=["mental_resilience", "courage", "concentration"],
        example=["mental_resilience", "courage", "concentration"]
    )
    reel_preferences: Optional[ReelPreferences] = None
    questionnaire_responses: List[QuestionnaireAnswer] = Field(default_factory=list)

class UserProfileResponse(BaseModel):
    user_id: str
    life_stage: str
    primary_challenges: List[str]
    interests: List[str]
    reel_preferences: ReelPreferences
    questionnaire_responses: List[QuestionnaireAnswer]
    updated_at: datetime

# --- User Query / Problem Log ---

class UserQueryLogRequest(BaseModel):
    query_text: str = Field(..., example="I have to give a final year project presentation tomorrow and I'm trembling.")
    current_mood: Optional[str] = Field(None, example="anxious")

class UserQueryHistoryItem(BaseModel):
    id: str
    user_id: str
    query_text: str
    extracted_topics: List[str]
    matched_teaching_id: Optional[str] = None
    created_at: datetime

# --- Reel Structure & Output Models ---

class SceneItem(BaseModel):
    scene_number: int
    name: str # Hook, Modern Situation, Authentic Teaching, Micro-Action, Outro
    start_time: float
    end_time: float
    time_label: str
    visual_description: str
    voiceover_text: str
    on_screen_text: Optional[str] = None
    authentic_quote: Optional[str] = None
    source_citation: Optional[str] = None

class TailoredReelGenerationRequest(BaseModel):
    user_id: str
    situation_override: Optional[str] = Field(
        None, 
        example="I'm terrified of speaking in front of my classmates tomorrow morning."
    )
    teaching_id: Optional[str] = Field(None, example="courage_fear_v1")
    language: Optional[str] = Field(None, example="hi")
    duration_sec: Optional[int] = Field(None, ge=30, le=60, example=45)

class TailoredReelResponse(BaseModel):
    reel_id: str
    user_id: str
    user_name: str
    language: str
    duration_sec: int
    personalization_context: Dict[str, Any]
    teaching_title: str
    authentic_quote: str
    source_citation: str
    modern_scenario: str
    scenes: List[SceneItem]
    full_voiceover: str
    srt_subtitles: str
    takeaway_action: str
    video_url: Optional[str] = None
    render_status: Optional[str] = None
    created_at: datetime

class RenderVideoResponse(BaseModel):
    status: str
    mode: str
    reel_id: str
    video_url: Optional[str] = None
    render_id: Optional[str] = None
    render_status: Optional[str] = None
    message: Optional[str] = None
