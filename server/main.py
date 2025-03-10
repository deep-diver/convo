
import os
import datetime

from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session

from stream import (
    openai as openai_stream, 
    anthropic as anthropic_stream, 
    google as google_stream,
    huggingface as huggingface_stream, 
    mistral as mistral_stream,
    upstage as upstage_stream
)
from summary import (
    openai as openai_summary, 
    google as google_summary,
    # anthropic as anthropic_summary, google as google_summary,
    # huggingface as huggingface_summary, mistral as mistral_summary
)

from database.db import engine, Base, SessionLocal
from database.models import Session as ChatSession, Message

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_default_session():
    new_session = ChatSession(
        sessionId=str(datetime.datetime.utcnow().timestamp()),  # Or use UUID for more uniqueness.
        name="Chat Session 1",
        title="Chat Session 1",
        summary="# Chat Summary\n\nThis is the default summary for Chat Session 1.",
        temperature=0.7,
        maxTokens=1024,
        persona="professional",
        model="gpt-4o-mini",
        summarizingModel="gpt-4o-mini",
        modelPreset1="gpt-4o-mini",
        modelPreset2="gpt-4o-mini",
        enableSummarization=False,
    )    
    return new_session

def session_to_dict(session: ChatSession):
    return {
        "id": session.id,
        "sessionId": session.sessionId,
        "name": session.name,
        "title": session.title,
        "summary": session.summary,
        "temperature": session.temperature,
        "maxTokens": session.maxTokens,
        "persona": session.persona,
        "model": session.model,
        "summarizingModel": session.summarizingModel,
        "enableSummarization": session.enableSummarization,
        "createdAt": session.createdAt.isoformat() if session.createdAt else None,
        "updatedAt": session.updatedAt.isoformat() if session.updatedAt else None,
        "modelPreset1": session.modelPreset1,
        "modelPreset2": session.modelPreset2,
        "messages": [
            {
                "id": msg.id,
                "userText": msg.userText,
                "aiResponse": msg.aiResponse,
                "attachments": msg.attachments,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
                "model": msg.model,
                "persona": msg.persona,
                "temperature": msg.temperature,
                "maxTokens": msg.maxTokens,
            }
            for msg in session.messages
        ],
    }

app = FastAPI()
app.include_router(openai_stream.router)
app.include_router(anthropic_stream.router)
app.include_router(google_stream.router)
app.include_router(huggingface_stream.router)
app.include_router(mistral_stream.router)
app.include_router(upstage_stream.router)

app.include_router(openai_summary.router)
app.include_router(google_summary.router)
# Allow all origins for testing (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="../front", html=True), name="static")

@app.get("/sessions")
def get_sessions(db: Session = Depends(get_db)):
    sessions_data = db.query(ChatSession).all()
    # If no sessions exist, create a default one.
    if not sessions_data:
        new_session = get_default_session()
        
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        sessions_data = [new_session]
    return {"sessions": [session_to_dict(s) for s in sessions_data]}

@app.post("/add_session")
def add_session(db: Session = Depends(get_db)):
    new_session = get_default_session()
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return session_to_dict(new_session)

@app.post("/update_model_preset")
async def update_model_preset(request: Request, db: Session = Depends(get_db)):
    session_id = request.headers.get("X-Session-ID")
    body = await request.json()
    session = db.query(ChatSession).filter(ChatSession.sessionId == session_id).first()
    session.modelPreset1 = body.get("model_preset1")
    session.modelPreset2 = body.get("model_preset2")
    selectedModelPreset = body.get("selected_preset_idx")
    if selectedModelPreset == 1:
        session.model = session.modelPreset1
        print("modelPreset1", session.modelPreset1)
    elif selectedModelPreset == 2:
        session.model = session.modelPreset2
        print("modelPreset2", session.modelPreset2)
    db.commit()
    db.refresh(session)
    return session_to_dict(session)

@app.post("/remove_session")
def remove_session(request: Request, db: Session = Depends(get_db)):
    session_id = request.headers.get("X-Session-ID")
    session = db.query(ChatSession).filter(ChatSession.sessionId == session_id).first()
    db.delete(session)
    db.commit()

    remaining_sessions = db.query(ChatSession).count()
    if remaining_sessions == 0:
        new_session = get_default_session()
        
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        sessions_data = [new_session]
    else:
        sessions_data = db.query(ChatSession).all()

    return {"sessions": [session_to_dict(s) for s in sessions_data]}

@app.post("/update_summarization_enable")
async def update_summarization_enable(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from e

    session_id = request.headers.get("X-Session-ID")
    session = db.query(ChatSession).filter(ChatSession.sessionId == session_id).first()
    session.enableSummarization = body.get("enable_summarization", False)
    db.commit()
    db.refresh(session)
    return session_to_dict(session)

@app.get("/list_models")
def list_models():
    available_models = {
        "openai": [],
        "google": [],
        "mistral": [],
        "huggingface": [],
        "anthropic": []
    }

    # Check OpenAI models
    if os.environ.get("OPENAI_API_KEY"):
        available_models["OpenAI"] = [
            {"code": "gpt-4o", "name": "GPT-4o"},
            {"code": "gpt-4o-mini", "name": "GPT-4o Mini"}
        ]

    # Check Google models  
    if os.environ.get("GOOGLE_API_KEY"):
        available_models["Google"] = [
            {"code": "gemini-2.0-flash", "name": "Gemini 2.0 Flash"},
            {"code": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite"}
        ]

    # Check Mistral models
    if os.environ.get("MISTRAL_API_KEY"):
        available_models["Mistral.AI"] = [
            {"code": "mistral-large-latest", "name": "Mistral Large"},
            {"code": "mistral-codestral-latest", "name": "Codestral"},
            {"code": "mistral-ministral-8b-latest", "name": "Ministral 8B"},
            {"code": "mistral-ministral-3b-latest", "name": "Ministral 3B"}
        ]

    # Check Huggingface models
    if os.environ.get("HUGGINGFACE_TOKEN"):
        available_models["Hugging Face"] = [
            {"code": "huggingface/meta-llama/Llama-3.3-70B-Instruct", "name": "Llama 3.3 70B Instruct"},
            {"code": "huggingface/Qwen/Qwen2.5-72B-Instruct", "name": "Qwen 2.5 72B Instruct"},
            {"code": "huggingface/deepseek-ai/DeepSeek-R1-Distill-Qwen-32B", "name": "DeepSeek R1 Distilled Qwnen 32B"}
        ]

    # Check Anthropic models
    if os.environ.get("ANTHROPIC_API_KEY"):
        available_models["Anthropic"] = [
            {"code": "claude-3.5-sonnet-latest", "name": "Claude 3.5 Sonnet"},
            {"code": "claude-3.7-sonnet-latest", "name": "Claude 3.7 Sonnet"}
        ]
        
    if os.environ.get("UPSTAGE_API_KEY"):
        available_models["Upstage"] = [
            {"code": "upstage-solar-mini", "name": "Solar Mini"},
            {"code": "upstage-solar-pro", "name": "Solar Pro"}
        ]

    return available_models

@app.post("/update_session_settings")
async def update_session_settings(request: Request, db: Session = Depends(get_db)):
    session_id = request.headers.get("X-Session-ID")
    body = await request.json()
    session_settings = body.get("session_settings")
    print("session_settings", session_settings)
    session = db.query(ChatSession).filter(ChatSession.sessionId == session_id).first()
    session.modelPreset1 = session_settings.get("modelPreset1")
    session.modelPreset2 = session_settings.get("modelPreset2")
    session.model = session_settings.get("model")
    session.summarizingModel = session_settings.get("summarizingModel")
    # session.ocrModel = session_settings.get("ocrModel")
    session.temperature = session_settings.get("temperature")
    session.maxTokens = session_settings.get("maxTokens")
    session.persona = session_settings.get("persona")
    db.commit()
    db.refresh(session)

@app.post("/update_title")
async def update_title(request: Request, db: Session = Depends(get_db)):
    session_id = request.headers.get("X-Session-ID")
    body = await request.json()
    session = db.query(ChatSession).filter(ChatSession.sessionId == session_id).first()
    session.title = body.get("title")
    db.commit()
    db.refresh(session)
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)