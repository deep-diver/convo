import os
import json
import datetime

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi import APIRouter

from google.genai import types
from google import genai

from .utils import handle_attachments, store_conversation_in_db

router = APIRouter()

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
client = genai.client.AsyncClient(genai.client.ApiClient(api_key=GOOGLE_API_KEY))

attachments_in_gcp = {}

@router.post("/gemini_stream")
async def gemini_stream(request: Request):
    """
    Stream responses from Google's Gemini model using the Gemini SDK.
    """
    body = await request.json()
    conversation = body.get("messages", [])
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("max_tokens", 256)
    model = body.get("model", "gemini-pro")  # Default to gemini-pro model
    timestamp = body.get("timestamp", datetime.datetime.now().isoformat())
    # Get session ID from the request
    session_id = request.headers.get("X-Session-ID")
    if session_id not in attachments_in_gcp: attachments_in_gcp[session_id] = {}
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing 'session_id' in payload")

    # Handle file attachments if present
    conversation = await handle_attachments(session_id, conversation)
    
    # Convert OpenAI message format to Gemini format
    gemini_messages = []
    for msg in conversation:
        role = "user" if msg["role"] == "user" else "model"
        attachments = []
        
        if "attachments" in msg:
            for attachment in msg["attachments"]:
                if attachment["file_path"] not in attachments_in_gcp[session_id]:
                    gcp_upload = await client.files.upload(path=attachment["file_path"])
                    path_wrap = types.Part.from_uri(file_uri=gcp_upload.uri, mime_type=gcp_upload.mime_type)
                    attachments_in_gcp[session_id][attachment["file_path"]] = path_wrap
                    attachments.append(path_wrap)
                else:
                    attachments.append(attachments_in_gcp[session_id][attachment["file_path"]])
                    print("Uploaded File Reused")

        gemini_messages.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])] + attachments)
        )

    print(gemini_messages)

    async def event_generator():
        try:
            print(f"Starting Gemini stream for model: {model}, temperature: {temperature}, max_tokens: {max_tokens}")
            line_count = 0
            stream_completed = False
            full_response = ""
            
            # Create a Gemini model instance
            response = await client.models.generate_content_stream(
                model=model,
                contents=gemini_messages,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    top_p=0.95,
                )
            )
            
            # Fix: Use synchronous iteration instead of async for
            async for chunk in response:
                content = chunk.text
                full_response += content
                line_count += 1
                if line_count % 10 == 0:
                    print(f"Processed {line_count} Gemini stream chunks")
                
                # Format the response to match OpenAI format for client compatibility
                response_json = json.dumps({
                    "choices": [{"delta": {"content": content}}]
                })
                yield f"data: {response_json}\n\n"
            
            # Send the [DONE] marker
            print("Gemini stream completed successfully")
            yield "data: [DONE]\n\n"
            stream_completed = True
                
        except Exception as e:
            print(f"Error during Gemini streaming: {str(e)}")
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
        finally:
            print(f"Gemini stream ended after processing {line_count if 'line_count' in locals() else 0} chunks")
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

    print("Returning StreamingResponse from Gemini to client")
    return StreamingResponse(event_generator(), media_type="text/event-stream")