# TeachReel AI - Backend

This is the backend for **TeachReel AI**, an application that converts text prompts into engaging educational reels (short videos). It handles prompt extraction, RAG-based context retrieval, pedagogical script generation, and orchestrates TTS and video synthesis.

## Features
- **Prompt Understanding**: Uses Gemini API to extract topics, audiences, and learning objectives.
- **Knowledge Retrieval (RAG)**: Fetches trusted educational content (Wikipedia mock for MVP).
- **Pedagogical Engine**: Converts facts into a structured teaching experience (Hook, Concept, Example, Takeaway).
- **Video & Audio Pipeline**: Asynchronously handles Text-to-Speech (via `edge-tts`) and Text-to-Video generation (placeholder for Hugging Face Inference API / FFmpeg).
- **Async API & Polling**: Frontend can initiate a generation job and poll for status.

## Project Structure
- `/backend/main.py`: FastAPI entry point.
- `/backend/routes/reel_routes.py`: API endpoints for generation and polling.
- `/backend/services/`: Core logic (LLM, RAG, Video, TTS).
- `/backend/database/`: MongoDB connection setup via Motor.
- `/backend/models/`: Pydantic schemas for data validation.

## Setup Instructions

1. **Install Prerequisites**:
   - Python 3.9+
   - MongoDB (Running locally on default port 27017 or use a MongoDB Atlas URI)

2. **Virtual Environment** (Optional but recommended):
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**:
   Update `.env` with your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   MONGO_URI=mongodb://localhost:27017
   HUGGINGFACE_API_KEY=your_huggingface_api_key
   ```

5. **Run the Server**:
   ```bash
   cd backend
   python main.py
   ```
   The API will be available at `http://localhost:8000`. 
   Swagger docs are available at `http://localhost:8000/docs`.

## Example Workflow

**1. Start Generation (POST `/generate-reel`)**
```json
{
  "prompt": "Create a teaching reel about courage based on Swami Vivekananda",
  "duration": 45,
  "language": "English",
  "style": "storytelling"
}
```

**2. Check Status (GET `/reel/{generation_id}/status`)**
```json
{
  "generation_id": "abc-123",
  "status": "processing"
}
```

**3. Retrieve Result (GET `/reel/{generation_id}`)**
```json
{
  "generation_id": "abc-123",
  "status": "completed",
  "video_url": "https://example-storage.com/generated-reel.mp4",
  "script": { ... }
}
```
