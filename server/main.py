import json
import httpx
import datetime

from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session

from stream import (
    openai as openai_stream, 
    anthropic as anthropic_stream, 
    google as google_stream,
    huggingface as huggingface_stream, 
    mistral as mistral_stream
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
        print("No sessions found, creating a default one")
        print("----------------------------------------")
        new_session = ChatSession(
            sessionId=str(datetime.datetime.utcnow().timestamp()),  # Or use UUID for more uniqueness.
            name="Chat Session 1",
            title="Chat Session 1",
            summary="# Chat Summary\n\nThis is the default summary for Chat Session 1.",
            temperature=0.7,
            maxTokens=1024,
            persona="professional",
            model="gpt-4o-mini",
            modelPreset1="gpt-4o-mini",
            modelPreset2="gpt-4o-mini",
            enableSummarization=False,
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        sessions_data = [new_session]
    return {"sessions": [session_to_dict(s) for s in sessions_data]}

@app.post("/add_session")
def add_session(db: Session = Depends(get_db)):
    new_session = ChatSession(
        sessionId=str(datetime.datetime.utcnow().timestamp()),
        name=f"Chat Session {db.query(ChatSession).count() + 1}",
        title=f"Chat Session {db.query(ChatSession).count() + 1}",
        summary="# Chat Summary\n\nThis is a new chat session.",
        temperature=0.7,
        maxTokens=1024,
        persona="professional",
        model="gpt-4o-mini",
        modelPreset1="gpt-4o-mini",
        modelPreset2="gpt-4o-mini",
        enableSummarization=False,
    )
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
    db.commit()
    db.refresh(session)
    return session_to_dict(session)

@app.post("/remove_session")
def remove_session(request: Request, db: Session = Depends(get_db)):
    session_id = request.headers.get("X-Session-ID")
    session = db.query(ChatSession).filter(ChatSession.sessionId == session_id).first()
    db.delete(session)
    db.commit()

    # Check if any sessions remain
    remaining_sessions = db.query(ChatSession).count()
    if remaining_sessions == 0:
        # Create new default session
        new_session = ChatSession(
            sessionId=str(datetime.datetime.utcnow().timestamp()),
            name="Chat Session 1",
            title="Chat Session 1", 
            summary="# Chat Summary\n\nThis is a new chat session.",
            temperature=0.7,
            maxTokens=1024,
            persona="professional",
            model="gpt-4o-mini",
            modelPreset1="gpt-4o-mini",
            modelPreset2="gpt-4o-mini",
            enableSummarization=False
        )
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)