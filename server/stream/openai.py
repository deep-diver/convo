import os
import json
import asyncio
import datetime

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi import APIRouter

from openai import AsyncOpenAI

from .utils import handle_attachments, extract_text_from_pdf, store_conversation_in_db

router = APIRouter()

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
client = AsyncOpenAI(api_key=OPENAI_API_KEY)

attachments_in_openai = {}

@router.post("/openai_stream")
async def openai_stream(request: Request):
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
    timestamp = body.get("timestamp", datetime.datetime.now().isoformat())
    
    # Get session ID from the request headers
    session_id = request.headers.get("X-Session-ID")
    if session_id not in attachments_in_openai: 
        attachments_in_openai[session_id] = {}
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing 'session_id' in payload")

    # Handle file attachments if present
    conversation = await handle_attachments(session_id, conversation)
    gpt_messages = []
    for msg in conversation:
        role = "user" if msg["role"] == "user" else "assistant"

        pdf_texts = []
        if "attachments" in msg:
            for attachment in msg["attachments"]:
                if attachment["file_path"].endswith(".pdf"):
                    if attachment["file_path"] not in attachments_in_openai[session_id]:
                        pdf_text = await extract_text_from_pdf(attachment["file_path"])
                        pdf_texts.append([attachment["name"], pdf_text])
                        attachments_in_openai[session_id][attachment["name"]] = pdf_text
                    else:
                        pdf_texts.append([attachment["name"], attachments_in_openai[session_id][attachment["name"]]])

        gpt_messages.append({"role": role, "content": msg["content"]})
        for pdf_text in pdf_texts:
            gpt_messages.append({"role": "user", "content": f"{pdf_text[0]}\n\n{pdf_text[1]}"})

    async def event_generator():
        line_count = 0
        stream_completed = False
        full_response = ""
        try:
            print(f"Starting stream for model: {model}, temperature: {temperature}, max_tokens: {max_tokens}")
            
            # Use the SDK to create a streaming completion
            stream = await client.chat.completions.create(
                model=model,
                messages=gpt_messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    line_count += 1
                    if line_count % 10 == 0:
                        print(f"Processed {line_count} stream chunks")
                    
                    response_json = json.dumps({
                        "choices": [{"delta": {"content": content}}]
                    })
                    yield f"data: {response_json}\n\n"
            
            print("Stream completed successfully")
            yield "data: [DONE]\n\n"
            stream_completed = True
                
        except asyncio.CancelledError:
            print("Streaming aborted by client")
            # You can choose to do cleanup here if needed.
            raise  # Re-raise to allow FastAPI to handle the cancellation properly.
        except Exception as e:
            print(f"Error during streaming: {str(e)}")
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
        finally:
            print(f"Stream ended after processing {line_count} chunks")
            if stream_completed:
                conversation.append(
                    {
                        "role": "assistant", 
                        "content": full_response, 
                        "model": model, 
                        "temperature": temperature, 
                        "max_tokens": max_tokens, 
                        "timestamp": timestamp
                    }
                )
                store_conversation_in_db(session_id, conversation)

    print("Returning StreamingResponse to client")
    return StreamingResponse(event_generator(), media_type="text/event-stream")
