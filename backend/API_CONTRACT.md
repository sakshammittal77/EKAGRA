# Backend API Contract & Integration Guide

This document defines the interface between:
1. **Frontend Website** (Teammate 1) ↔ **FastAPI Backend** (You)
2. **LLM Module** (Teammate 2) ↔ **FastAPI Backend** (You)

---

## 1. Contract with Frontend (Website Teammate)

Base URL: `http://localhost:8000`. CORS allows only the website origins listed in the `ALLOWED_ORIGINS` env var (default `http://localhost:5173`).

### A. Authentication (Firebase)
Sign-up, login, Google sign-in and password reset all happen in **Firebase** on the website (project `ekagra-dfe37`). The backend never sees passwords.

**Every request below must include the user's Firebase ID token:**
```
Authorization: Bearer <firebase-id-token>
```
The backend verifies the token with Google's public keys (`auth.py`). Missing or invalid token → `401`. A user can only read or change their own data → otherwise `403`.

#### `POST /api/auth/session`
Call once right after the user logs in on the website. Creates the user's MongoDB record and profile on first visit.
**Response (200 OK)**:
```json
{
  "id": "6702be9f4a123bc4567890ef",
  "name": "Arjun Sharma",
  "email": "arjun@example.com",
  "role": "college_student",
  "preferred_language": "en",
  "created_at": "2026-10-06T14:30:00Z"
}
```
Use this `id` as `user_id` in the endpoints below.

`POST /api/auth/register` and `POST /api/auth/login` are **retired** (they return `410 Gone`) — they stored plain-text passwords.

---

### B. Onboarding Questionnaire (Tailoring User Profile)
#### `POST /api/users/{user_id}/questionnaire`
Call this after user registration or in a "Personalize" settings tab.
**Request Body**:
```json
{
  "life_stage": "college_student",
  "primary_challenges": ["fear_of_failure", "stage_fear", "lack_of_focus"],
  "interests": ["mental_resilience", "courage", "concentration"],
  "reel_preferences": {
    "target_duration_sec": 45,
    "tone": "Energetic & Motivational",
    "include_micro_action": true
  },
  "questionnaire_responses": [
    {
      "question_key": "biggest_obstacle",
      "question_text": "What stops you from speaking up in class or meetings?",
      "selected_option": "Worrying that peers might laugh or judge me"
    }
  ]
}
```

---

### C. Reel Generation
#### `POST /api/reels/generate-tailored`
**Request Body**:
```json
{
  "user_id": "6702be9f4a123bc4567890ef",
  "situation_override": "I have to give a project seminar tomorrow morning and I am trembling with fear.",
  "language": "hi",
  "duration_sec": 45
}
```
**Response (200 OK)**:
```json
{
  "status": "success",
  "reel": {
    "reel_id": "6702c1104a123bc4567890f0",
    "user_id": "6702be9f4a123bc4567890ef",
    "userName": "Arjun Sharma",
    "language": "hi",
    "durationSeconds": 45,
    "teachingTitle": "Face the Brutes (Overcoming What Intimidates You)",
    "authenticQuote": "Turn round and face the danger! The moment you fear, you are nobody. Face the brutes!",
    "sourceCitation": "Complete Works of Swami Vivekananda (CWSV), Vol. 1, p. 338",
    "modernScenario": "I have to give a project seminar tomorrow morning and I am trembling with fear.",
    "scenes": [
      {
        "scene_number": 1,
        "name": "Hook",
        "time_label": "00:00 - 00:05",
        "visual_description": "Fast paced visual, bold typography highlighting internal panic",
        "voiceover_text": "क्या आप भी इस डर से भाग रहे हैं जो आपको बार-बार रोकता है?",
        "on_screen_text": "Stop running away"
      },
      {
        "scene_number": 2,
        "name": "Modern Situation",
        "time_label": "00:05 - 00:18",
        "visual_description": "Relatable seminar anxiety scene",
        "voiceover_text": "क्लास में प्रेजेंटेशन का नाम आते ही दिल की धड़कनें तेज हैं और मन कर रहा है कि पीछे हट जाएं।",
        "on_screen_text": "The struggle is real"
      },
      {
        "scene_number": 3,
        "name": "Authentic Teaching",
        "time_label": "00:18 - 00:32",
        "visual_description": "Visual of Swami Vivekananda with verified source badge",
        "voiceover_text": "स्वामी विवेकानंद ने कहा था: 'Turn round and face the danger! Face the brutes!'",
        "authentic_quote": "Turn round and face the danger! Face the brutes!",
        "source_citation": "Complete Works of Swami Vivekananda (CWSV), Vol. 1, p. 338"
      },
      {
        "scene_number": 4,
        "name": "Micro-Action",
        "time_label": "00:32 - 00:40",
        "visual_description": "Clear modern action prompt",
        "voiceover_text": "अगली बार जब डर सामने आए, 3 सेकंड रुकें और सीधे आगे बढ़ें। डर खुद पीछे हट जाएगा।",
        "on_screen_text": "Action Step"
      }
    ],
    "srtSubtitles": "1\n00:00:00,000 --> 00:00:05,000\nक्या आप भी इस डर से भाग रहे हैं...",
    "takeawayAction": "अगली बार जब डर सामने आए, 3 सेकंड रुकें और सीधे आगे बढ़ें।"
  }
}
```

---

### D. Online Video Rendering (Creatomate)
#### `POST /api/reels/{reel_id}/render-video`
Takes the generated reel script and renders a fast-paced 9:16 vertical video with kinetic captions, b-roll cuts, and the verified citation badge.
**Request**: No body needed (or optional custom overrides).
**Response (200 OK)**:
```json
{
  "status": "success",
  "mode": "live_cloud",
  "reel_id": "6702c1104a123bc4567890f0",
  "render_id": "c1f7a0b3-90d1-4e92-9382-38d58c199abc",
  "render_status": "planned",
  "video_url": "https://creatomate.com/renders/c1f7a0b3-90d1-4e92-9382-38d58c199abc.mp4"
}
```

---

## 2. Contract with LLM Teammate

Your LLM teammate modifies **`services/llm_client.py`**.

### Input Provided by Backend to LLM:
```python
user_context = {
    "user_name": "Arjun Sharma",
    "life_stage": "college_student",
    "primary_challenges": ["fear_of_failure", "stage_fear"],
    "past_situations": [
        "Avoided speaking in team meeting last week",
        "Trembling before seminar presentation"
    ]
}

teaching = {
    "quote": "If you ever face danger, do not run away. Turn round and face the danger! Face the brutes!",
    "source": "Complete Works of Swami Vivekananda (CWSV), Vol. 1, p. 338",
    "title": "Face the Brutes"
}

situation = "I have to give a project presentation tomorrow."
language = "hi"
duration_sec = 45
tone = "Energetic & Motivational"
```

### Strict Anti-Hallucination Guardrail for LLM:
- **Rule 1**: The LLM **must NEVER invent or rephrase** the `quote` or `source`. It must use the exact string passed in `teaching["quote"]`.
- **Rule 2**: The LLM's job is to craft the **opening hook**, the **modern relatable scenario** (matching the user's `life_stage`), and the **practical micro-action**.
- **Rule 3**: Output must follow the `scenes` JSON structure.
