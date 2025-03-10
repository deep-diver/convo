import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from database.db import Base

class Session(Base):
    __tablename__ = 'sessions'
    id = Column(Integer, primary_key=True, index=True)
    # A unique session identifier (could be a UUID or a generated string)
    sessionId = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    title = Column(String, nullable=False)
    summary = Column(Text, default="")  # Stores the summary markdown or text
    # Settings
    temperature = Column(Float, default=0.7)
    maxTokens = Column(Integer, default=1024)
    persona = Column(String, default="professional")
    ocrModel = Column(String, default="gpt-4o-mini")
    model = Column(String, default="gpt-4o-mini")
    summarizingModel = Column(String, default="gpt-4o-mini")
    ocrModel = Column(String, default="gpt-4o-mini")
    
    modelPreset1 = Column(String, default="gpt-4o-mini")
    modelPreset2 = Column(String, default="gpt-4o-mini")

    enableSummarization = Column(Boolean, default=False)
    
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationship to messages
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True, index=True)
    sessionId = Column(Integer, ForeignKey('sessions.id'), nullable=False)
    userText = Column(Text, default="")  # Content from user
    aiResponse = Column(Text, default="")  # Response from AI
    attachments = Column(Text, default="[]")  # JSON string of attachments
    model = Column(String, default="gpt-4o-mini")
    persona = Column(String, default="professional") 
    temperature = Column(Float, default=0.7)
    maxTokens = Column(Integer, default=1024)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("Session", back_populates="messages")
