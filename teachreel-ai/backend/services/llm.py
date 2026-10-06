import os
import json
from google import genai
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize client using the modern google-genai SDK
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = genai.Client()

def extract_topic_info(prompt: str, duration: int, language: str, style: str) -> dict:
    """Extract structured info from the user's prompt."""
    
    system_instruction = (
        "You are an expert educational instructional designer. "
        "Extract the topic, audience, and learning objective from the user's prompt."
    )
    
    prompt_text = (
        f"Prompt: {prompt}\n"
        f"Requested Duration: {duration}s\n"
        f"Language: {language}\n"
        f"Style: {style}\n"
        "Return a JSON object with keys: topic, audience, learning_objective, duration, style, language."
    )
    
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt_text,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json"
        )
    )
    
    return json.loads(response.text)

def generate_teaching_script(topic_info: dict, context: str) -> dict:
    """Generate the teaching script based on pedagogical engine requirements."""
    
    system_instruction = (
        "You are an expert pedagogical engine for a short-form video platform (like TikTok or Reels).\n"
        "Your task is to convert the provided educational context into an engaging teaching experience.\n"
        "Do NOT simply read the text. You must TEACH it using the following structure:\n"
        "1. HOOK: A question, surprising fact, or statement.\n"
        "2. CONCEPT: Explain what it means.\n"
        "3. SIMPLE EXPLANATION: Use simple language.\n"
        "4. EXAMPLE: A realistic example, analogy, or short story.\n"
        "5. PRACTICAL APPLICATION: How to apply it.\n"
        "6. TAKEAWAY: One memorable lesson.\n"
        "The script is for a vertical video. Keep on-screen text short (keywords, definitions). "
        "The visual prompts should describe what should be shown on screen to reinforce the teaching (not just text).\n"
        "Return a structured JSON with 'title', 'hook', 'scenes' (array of objects with scene, duration, narration, visual_prompt, on_screen_text), and 'takeaway'."
    )
    
    prompt_text = (
        f"Target Info: {json.dumps(topic_info)}\n\n"
        f"Educational Context:\n{context}\n\n"
        f"Generate the script targeting a {topic_info['duration']}-second video in {topic_info['language']} language, "
        f"using a {topic_info['style']} style."
    )
    
    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt_text,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json"
        )
    )
    
    return json.loads(response.text)
