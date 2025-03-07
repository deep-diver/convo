import os
import json
import tomli
from string import Template

from fastapi import FastAPI, Request, HTTPException
from fastapi import APIRouter

from openai import AsyncOpenAI

from database.db import SessionLocal
from database.models import Session

router = APIRouter()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = AsyncOpenAI(api_key=OPENAI_API_KEY)


@router.post("/openai_summary")
async def openai_summary(request: Request):
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
    model = body.get("model", "gpt-4o-mini")

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

    summary = await client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": system_prompt.substitute(persona="professional"),
            },
            {
                "role": "user",
                "content": prompt.safe_substitute(
                    previous_summary=prev_summary,
                    latest_conversation="User:{}\n\nAssistant:{}".format(
                        latest_conversation["userText"],
                        latest_conversation["aiResponse"],
                    ),
                ),
            },
        ],
        max_tokens=max_tokens,
        temperature=temperature,
    )

    summary_text = summary.choices[0].message.content

    # Update the session's summary in the database
    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.sessionId == session_id).first()
        if session:
            session.summary = summary_text
            db.commit()
    finally:
        db.close()

    return {"summary": summary_text}
