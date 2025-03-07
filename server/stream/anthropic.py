import os
import re
import json
import datetime

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi import APIRouter

from anthropic import Anthropic

from .utils import handle_attachments, store_conversation_in_db

router = APIRouter()
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

client = Anthropic(api_key=ANTHROPIC_API_KEY)

attachments_in_anthropic = {}

@router.post("/anthropic_stream")
async def anthropic_stream(request: Request):
    """
    Stream responses from Anthropic's Claude models.
    """
    print("Received request for Anthropic streaming")
    
    # Parse the request body
    body = await request.json()
    conversation = body.get("messages", [])
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("max_tokens", 1024)
    model = body.get("model", "claude-3-opus-20240229")
    timestamp = body.get("timestamp", datetime.datetime.now().isoformat())

    # Get session ID from the request
    session_id = request.headers.get("X-Session-ID")
    if session_id not in attachments_in_anthropic: attachments_in_anthropic[session_id] = {}
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing 'session_id' in payload")

    # Handle file attachments if present
    conversation = await handle_attachments(session_id, conversation, remove_content=False)
    anthropic_messages = []
    for msg in conversation:
        role = "user" if msg["role"] == "user" else "assistant"

        pdf_base64s = []
        if "attachments" in msg:
            for attachment in msg["attachments"]:
                if attachment["file_path"].endswith(".pdf"):
                    print(attachment)
                    if attachment["file_path"] not in attachments_in_anthropic[session_id]:    
                        pdf_base64 = {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": attachment["content"]}}
                        pdf_base64s.append(pdf_base64)
                        attachments_in_anthropic[session_id][attachment["name"]] = pdf_base64
                    else:
                        pdf_base64s.append(attachments_in_anthropic[session_id][attachment["name"]])

        anthropic_messages.append({"role": role, "content": pdf_base64s + [{"type": "text", "text": msg["content"]}]})
    
    line_count = 0
    
    async def event_generator():
        try:
            stream_completed = False
            full_response = ""

            # Start the streaming response
            with client.messages.stream(
                model=re.sub(r'\.', '-', model),
                messages=anthropic_messages,
                max_tokens=max_tokens,
                temperature=temperature
            ) as stream:
                for chunk in stream:
                    if hasattr(chunk, 'delta') and hasattr(chunk.delta, 'text') and chunk.delta.text:
                        content = chunk.delta.text
                        full_response += content
                        nonlocal line_count
                        line_count += 1
                        if line_count % 10 == 0:
                            print(f"Processed {line_count} Anthropic stream chunks")
                        
                        # Format the response to match OpenAI format for client compatibility
                        response_json = json.dumps({
                            "choices": [{"delta": {"content": content}}]
                        })
                        yield f"data: {response_json}\n\n"
            
            # Send the [DONE] marker
            print("Anthropic stream completed successfully")
            yield "data: [DONE]\n\n"
            stream_completed = True
        except Exception as e:
            print(f"Error during Anthropic streaming: {str(e)}")
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
        finally:
            print(f"Anthropic stream ended after processing {line_count if 'line_count' in locals() else 0} chunks")
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

    print("Returning StreamingResponse from Anthropic to client")
    return StreamingResponse(event_generator(), media_type="text/event-stream")