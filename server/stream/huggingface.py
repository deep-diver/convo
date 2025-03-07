import os
import json
import datetime

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from fastapi import APIRouter

from huggingface_hub import AsyncInferenceClient

from .utils import handle_attachments, extract_text_from_pdf, store_conversation_in_db

router = APIRouter()

HUGGINGFACE_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")
client = AsyncInferenceClient(api_key=HUGGINGFACE_TOKEN)

attachments_in_huggingface = {}

@router.post("/huggingface_stream")
async def huggingface_stream(request: Request):
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from e

    conversation = body.get("messages")
    if not conversation:
        raise HTTPException(status_code=400, detail="Missing 'conversation' in payload")

    print("--------------------------------")
    print(body)
    print()
    temperature = body.get("temperature", 0.7)
    max_tokens = body.get("max_tokens", 256)
    model = body.get("model", "meta-llama/Llama-3.3-70B-Instruct")
    print("model", model)
    timestamp = body.get("timestamp", datetime.datetime.now().isoformat())
    # Get session ID from the request
    session_id = request.headers.get("X-Session-ID")
    if session_id not in attachments_in_huggingface: attachments_in_huggingface[session_id] = {}
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing 'session_id' in payload")

    # Handle file attachments if present)
    conversation = await handle_attachments(session_id, conversation)
    huggingface_messages = []
    for msg in conversation:
        role = "user" if msg["role"] == "user" else "assistant"

        pdf_texts = []
        if "attachments" in msg:
            for attachment in msg["attachments"]:
                if attachment["file_path"].endswith(".pdf"):
                    if attachment["file_path"] not in attachments_in_huggingface[session_id]:    
                        pdf_text = await extract_text_from_pdf(attachment["file_path"])
                        pdf_texts.append([attachment["name"], pdf_text])
                        attachments_in_huggingface[session_id][attachment["name"]] = pdf_text
                    else:
                        pdf_texts.append([attachment["name"], attachments_in_huggingface[session_id][attachment["name"]]])

        huggingface_messages.append({"role": role, "content": msg["content"]})
        for pdf_text in pdf_texts:
            huggingface_messages.append({"role": "user", "content": f"{pdf_text[0]}\n\n{pdf_text[1]}"})

    async def event_generator():
        try:
            print(f"Starting stream for model: {model}, temperature: {temperature}, max_tokens: {max_tokens}")
            line_count = 0
            stream_completed = False
            full_response = ""
            
            # Use the SDK to create a streaming completion
            stream = await client.chat.completions.create(
                model=model.replace("huggingface/", ""),
                messages=huggingface_messages,
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
                    
                    # Format the response in the same way as before
                    response_json = json.dumps({
                        "choices": [{"delta": {"content": content}}]
                    })
                    yield f"data: {response_json}\n\n"
            
            # Send the [DONE] marker
            print("Stream completed successfully")
            yield "data: [DONE]\n\n"
            stream_completed = True
                
        except Exception as e:
            print(f"Error during streaming: {str(e)}")
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
        finally:
            print(f"Stream ended after processing {line_count if 'line_count' in locals() else 0} chunks")
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