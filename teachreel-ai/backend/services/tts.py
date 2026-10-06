import edge_tts
import asyncio
import os

async def generate_voiceover(text: str, language: str = "English") -> str:
    """
    Generates TTS using edge-tts. 
    Selects voice based on requested language.
    """
    voice = "en-US-ChristopherNeural" # Default English Teacher-like voice
    
    if language.lower() == "hindi":
        voice = "hi-IN-MadhurNeural"
    elif language.lower() == "hinglish":
        voice = "hi-IN-SwaraNeural"
        
    output_filename = f"voice_{hash(text)}.mp3"
    
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_filename)
    
    return output_filename
