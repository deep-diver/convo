import os
import json
import tomli
from string import Template

from fastapi import FastAPI, Request, HTTPException
from fastapi import APIRouter

from google.genai import types
from google import genai

from database.db import SessionLocal
from database.models import Session

router = APIRouter()

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
client = genai.client.AsyncClient(genai.client.ApiClient(api_key=GOOGLE_API_KEY))


@router.post("/gemini_summary")
async def gemini_summary(request: Request):
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from e

    conversation = body.get("conversation")
    if not conversation:
        raise HTTPException(status_code=400, detail="Missing 'conversation' in payload")

    print("--------------------------------")
    print(body)
    print()
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("max_tokens", 256)
    model = body.get("model", "gemini-1.5-flash")

    # Get session ID from the request
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing 'session_id' in payload")

    # Get previous summary from database
    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.sessionId == session_id).first()
        prev_summary = session.summary if session else ""
    finally:
        db.close()

    with open("./configs/prompts.toml", "rb") as f:
        prompts = tomli.load(f)

    prompt = Template(prompts["summarization"]["prompt"])
    system_prompt = Template(prompts["summarization"]["system_prompt"])

    latest_conversation = conversation[-1]

    summary = await client.models.generate_content(
        model=model,
        contents=[
            prompt.safe_substitute(
                previous_summary=prev_summary,
                latest_conversation="User:{}\n\nAssistant:{}".format(
                    latest_conversation["userText"], latest_conversation["aiResponse"]
                ),
            )
        ],
        config=types.GenerateContentConfig(
            system_instruction=system_prompt.substitute(persona="professional"),
            temperature=temperature,
            max_output_tokens=max_tokens,
            top_p=0.95,
        ),
    )

    print(summary)

    # Update the session's summary in the database
    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.sessionId == session_id).first()
        if session:
            session.summary = summary.text
            db.commit()
    finally:
        db.close()

    return {"summary": summary.text}
