import os
import json
import base64
import datetime
from collections import defaultdict

import PyPDF2

from database.db import SessionLocal
from database.models import Session as ChatSession, Message

async def extract_text_from_pdf(pdf_path):
    text = ""
    with open(pdf_path, "rb") as pdf_file:
        reader = PyPDF2.PdfReader(pdf_file)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return text.strip()    

def store_conversation_in_db(session_id: str, messages: list):
    """
    Stores the conversation messages in the database.
    If a session with session_id exists, append messages; 
    otherwise, create a new session record.
    """
    db = SessionLocal()
    try:
        # Try to find an existing session with this session_id.
        print("session_id", session_id)
        chat_session = db.query(ChatSession).filter(ChatSession.sessionId == session_id).first()
        print("chat_session", chat_session)

        # Delete all messages for this session before adding new ones
        if chat_session:
            db.query(Message).filter(Message.sessionId == chat_session.id).delete()

        for i in range(0, len(messages), 2):
            user_msg = messages[i]
            assistant_msg = messages[i+1]
            print("assistant_msg", assistant_msg)

            attachments = user_msg.get('attachments', [])
            if attachments:
                attachments_list = []
                for attachment in attachments:
                    attachments_list.append({'name': attachment['name'], 'file_path': attachment['file_path'], 'content': ''})
                attachments = json.dumps(attachments_list)
            else:
                attachments = '[]'

            new_msg = Message(
                sessionId=chat_session.id,
                userText=user_msg["content"],
                aiResponse=assistant_msg["content"],
                attachments=attachments,
                model=assistant_msg["model"],
                persona="professional",
                temperature=assistant_msg["temperature"],
                maxTokens=assistant_msg["max_tokens"],
                timestamp=datetime.datetime.fromisoformat(assistant_msg["timestamp"])
            )
            db.add(new_msg)
        db.commit()
        print("Conversation stored successfully.")
    except Exception as ex:
        print("Error storing conversation:", ex)
        db.rollback()
    finally:
        db.close()

async def handle_attachments(session_id, conversation, remove_content=True):
    """
    Process attachments for each message in the conversation.
    
    Args:
        session_id (str): The unique identifier for the session
        conversation (list): List of message objects containing attachments
        
    Returns:
        None
    """
    # Process attachments for each message in the conversation
    for outer_idx, msg in enumerate(conversation):
        if "attachments" in msg and msg["attachments"]:
            # Create a temporary folder for this session if it doesn't exist
            session_folder = os.path.join("temp_attachments", session_id)
            os.makedirs(session_folder, exist_ok=True)
            
            for inner_idx, attachment in enumerate(msg["attachments"]):
                attachment_name = attachment.get("name", "unknown_file")
                
                # Check if this attachment already exists in the session
                attachment_exists = False
                file_path = None
                
                for existing_attachment in msg["attachments"]:
                    if existing_attachment.get("name") == attachment_name and existing_attachment.get("file_path"):
                        attachment_exists = True
                        file_path = existing_attachment.get("file_path")
                        break
                
                # Only decode and save if it's a new attachment
                if not attachment_exists:
                    attachment_content = attachment.get("content")
                    if attachment_content:
                        try:
                            file_path = os.path.join(session_folder, attachment_name)
                            # Decode base64 content and write to file
                            with open(file_path, "wb") as f:
                                f.write(base64.b64decode(attachment_content))
                            
                        except Exception as e:
                            print(f"Error saving attachment: {str(e)}")
                
                # Add file_path to the original attachment dict
                if file_path:
                    if remove_content:
                        del attachment["content"]
                    attachment["file_path"] = file_path
                    msg["attachments"][inner_idx] = attachment
                    conversation[outer_idx] = msg

    return conversation