from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_pricing.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    website = Column(String)
    api_docs_url = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    models = relationship("Model", back_populates="provider")


class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    provider_id = Column(Integer, ForeignKey("providers.id"))
    display_name = Column(String)
    description = Column(Text)
    context_window = Column(Integer)
    max_output_tokens = Column(Integer)
    modality = Column(String)  # text, vision, audio, multimodal
    knowledge_cutoff = Column(String)
    architecture = Column(String)
    parameters = Column(String)
    is_active = Column(Boolean, default=True)
    source_url = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    provider = relationship("Provider", back_populates="models")
    pricing = relationship("PricingHistory", back_populates="model", order_by="PricingHistory.effective_date.desc()")


class PricingHistory(Base):
    __tablename__ = "pricing_history"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    input_price_per_million = Column(Float)
    output_price_per_million = Column(Float)
    cache_read_price_per_million = Column(Float, nullable=True)
    cache_write_price_per_million = Column(Float, nullable=True)
    batch_input_price_per_million = Column(Float, nullable=True)
    batch_output_price_per_million = Column(Float, nullable=True)
    currency = Column(String, default="USD")
    effective_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    scraped_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    source_url = Column(String)
    notes = Column(Text, nullable=True)

    model = relationship("Model", back_populates="pricing")


class ScrapeLog(Base):
    __tablename__ = "scrape_logs"

    id = Column(Integer, primary_key=True, index=True)
    provider_name = Column(String)
    url = Column(String)
    status = Column(String)  # success, error, partial
    models_found = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    scraped_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    duration_seconds = Column(Float, nullable=True)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
