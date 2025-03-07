from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Create an engine for SQLite database file.
engine = create_engine('sqlite:///database.db', echo=True, connect_args={"check_same_thread": False})

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our ORM models.
Base = declarative_base()