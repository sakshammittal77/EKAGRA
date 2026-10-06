import asyncio
import uuid
from datetime import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException
from models.schemas import GenerateReelRequest, GenerationStatus
from services.llm import extract_topic_info, generate_teaching_script
from services.rag import get_educational_context
from services.tts import generate_voiceover
from services.video_generator import generate_scene_visuals, assemble_final_video
from database.mongo import save_generation_status, get_generation_status

router = APIRouter()

async def process_reel_generation(generation_id: str, request: GenerateReelRequest):
    try:
        # 1. Prompt Understanding
        topic_info = extract_topic_info(request.prompt, request.duration, request.language, request.style)
        
        # 2. Knowledge Retrieval (RAG)
        rag_data = get_educational_context(topic_info.get("topic", request.prompt))
        
        # 3. Pedagogical Engine / Script Generation
        script = generate_teaching_script(topic_info, rag_data["context"])
        
        # Merge sources
        script["sources"] = rag_data["sources"]
        
        # 4 & 5. Video & Audio Generation Pipeline
        visual_paths = []
        voice_paths = []
        
        for scene in script.get("scenes", []):
            # Generate Visuals
            visual_path = await generate_scene_visuals(scene["visual_prompt"])
            visual_paths.append(visual_path)
            
            # Generate Audio
            voice_path = await generate_voiceover(scene["narration"], request.language)
            voice_paths.append(voice_path)
            
        # 6. Assemble Final Video
        final_video_url = await assemble_final_video(script, visual_paths, voice_paths)
        
        # 7. Update Database with success
        await save_generation_status(generation_id, {
            "status": "completed",
            "video_url": final_video_url,
            "script": script,
            "updated_at": datetime.utcnow()
        })
        
    except Exception as e:
        print(f"Error generating reel: {e}")
        await save_generation_status(generation_id, {
            "status": "failed",
            "error_message": str(e),
            "updated_at": datetime.utcnow()
        })

@router.post("/generate-reel")
async def generate_reel(request: GenerateReelRequest, background_tasks: BackgroundTasks):
    generation_id = str(uuid.uuid4())
    
    # Save initial state
    await save_generation_status(generation_id, {
        "generation_id": generation_id,
        "user_prompt": request.prompt,
        "duration": request.duration,
        "language": request.language,
        "style": request.style,
        "status": "processing",
        "created_at": datetime.utcnow()
    })
    
    # Start async processing
    background_tasks.add_task(process_reel_generation, generation_id, request)
    
    return {"generation_id": generation_id, "status": "processing"}

@router.get("/reel/{id}/status", response_model=GenerationStatus)
async def get_reel_status(id: str):
    status_data = await get_generation_status(id)
    if not status_data:
        raise HTTPException(status_code=404, detail="Generation ID not found")
    return status_data

@router.get("/reel/{id}")
async def get_reel(id: str):
    record = await get_generation_status(id)
    if not record or record.get("status") != "completed":
        raise HTTPException(status_code=404, detail="Reel not found or not completed yet")
    return record

@router.post("/reel/{id}/regenerate")
async def regenerate_reel(id: str, background_tasks: BackgroundTasks):
    record = await get_generation_status(id)
    if not record:
        raise HTTPException(status_code=404, detail="Generation ID not found")
        
    # Re-use prompt parameters
    req = GenerateReelRequest(
        prompt=record["user_prompt"],
        duration=record["duration"],
        language=record["language"],
        style=record["style"]
    )
    
    # Reset status
    await save_generation_status(id, {"status": "processing", "updated_at": datetime.utcnow()})
    
    background_tasks.add_task(process_reel_generation, id, req)
    
    return {"generation_id": id, "status": "processing"}
