from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os

from app.database import get_db, Provider, Model, PricingHistory, ScrapeLog
from app.scraper import run_full_sweep, seed_initial_data, scrape_provider
from app.scheduler import start_scheduler

app = FastAPI(title="AI Pricing Dashboard", version="1.0.0")

app.mount("/static", StaticFiles(directory="static"), name="static")


class ModelResponse(BaseModel):
    id: int
    name: str
    display_name: str
    provider_name: str
    modality: str
    context_window: Optional[int]
    max_output_tokens: Optional[int]
    input_price_per_million: Optional[float]
    output_price_per_million: Optional[float]
    cache_read_price_per_million: Optional[float]
    cache_write_price_per_million: Optional[float]
    last_updated: Optional[datetime]

    class Config:
        from_attributes = True


class ProviderResponse(BaseModel):
    id: int
    name: str
    website: Optional[str]
    model_count: int
    last_scraped: Optional[datetime]

    class Config:
        from_attributes = True


class SweepResponse(BaseModel):
    status: str
    results: dict
    total_updated: int
    timestamp: datetime


@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    seed_initial_data(db)
    start_scheduler()


@app.get("/", response_class=HTMLResponse)
async def index():
    with open("templates/index.html", "r") as f:
        return f.read()


@app.get("/api/models", response_model=list[ModelResponse])
def get_models(
    provider: Optional[str] = None,
    modality: Optional[str] = None,
    sort_by: str = "name",
    db: Session = Depends(get_db),
):
    query = (
        db.query(Model, Provider, PricingHistory)
        .join(Provider, Model.provider_id == Provider.id)
        .outerjoin(
            PricingHistory,
            Model.id == PricingHistory.model_id,
        )
        .filter(Model.is_active == True)
    )

    if provider:
        query = query.filter(Provider.name == provider)
    if modality:
        query = query.filter(Model.modality == modality)

    query = query.order_by(
        PricingHistory.effective_date.desc(),
        Model.name,
    )

    results = query.all()
    seen_models = {}
    models = []

    for model, provider, pricing in results:
        if model.id not in seen_models:
            seen_models[model.id] = True
            models.append(ModelResponse(
                id=model.id,
                name=model.name,
                display_name=model.display_name or model.name,
                provider_name=provider.name,
                modality=model.modality or "text",
                context_window=model.context_window,
                max_output_tokens=model.max_output_tokens,
                input_price_per_million=pricing.input_price_per_million if pricing else None,
                output_price_per_million=pricing.output_price_per_million if pricing else None,
                cache_read_price_per_million=pricing.cache_read_price_per_million if pricing else None,
                cache_write_price_per_million=pricing.cache_write_price_per_million if pricing else None,
                last_updated=pricing.scraped_at if pricing else model.updated_at,
            ))

    if sort_by == "name":
        models.sort(key=lambda x: x.display_name)
    elif sort_by == "provider":
        models.sort(key=lambda x: x.provider_name)
    elif sort_by == "price":
        models.sort(key=lambda x: x.input_price_per_million or 0)

    return models


@app.get("/api/providers", response_model=list[ProviderResponse])
def get_providers(db: Session = Depends(get_db)):
    providers = db.query(Provider).all()
    result = []

    for provider in providers:
        model_count = db.query(Model).filter(Model.provider_id == provider.id, Model.is_active == True).count()
        last_log = db.query(ScrapeLog).filter(ScrapeLog.provider_name == provider.name).order_by(desc(ScrapeLog.scraped_at)).first()

        result.append(ProviderResponse(
            id=provider.id,
            name=provider.name,
            website=provider.website,
            model_count=model_count,
            last_scraped=last_log.scraped_at if last_log else None,
        ))

    return result


@app.get("/api/pricing-history/{model_name}")
def get_pricing_history(model_name: str, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.name == model_name).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    history = (
        db.query(PricingHistory)
        .filter(PricingHistory.model_id == model.id)
        .order_by(desc(PricingHistory.effective_date))
        .limit(50)
        .all()
    )

    return {
        "model": model.display_name,
        "provider": model.provider.name,
        "history": [
            {
                "input_price": h.input_price_per_million,
                "output_price": h.output_price_per_million,
                "cache_read_price": h.cache_read_price_per_million,
                "cache_write_price": h.cache_write_price_per_million,
                "effective_date": h.effective_date,
                "scraped_at": h.scraped_at,
                "source_url": h.source_url,
            }
            for h in history
        ],
    }


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_models = db.query(Model).filter(Model.is_active == True).count()
    total_providers = db.query(Provider).count()
    total_scrapes = db.query(ScrapeLog).count()
    last_scrape = db.query(ScrapeLog).order_by(desc(ScrapeLog.scraped_at)).first()

    price_range = db.query(
        func.min(PricingHistory.input_price_per_million),
        func.max(PricingHistory.input_price_per_million),
        func.avg(PricingHistory.input_price_per_million),
    ).filter(PricingHistory.input_price_per_million.isnot(None)).first()

    return {
        "total_models": total_models,
        "total_providers": total_providers,
        "total_scrapes": total_scrapes,
        "last_scrape": last_scrape.scraped_at if last_scrape else None,
        "price_range": {
            "min": price_range[0] if price_range else None,
            "max": price_range[1] if price_range else None,
            "avg": price_range[2] if price_range else None,
        },
    }


@app.get("/api/scrape-logs")
def get_scrape_logs(limit: int = 20, db: Session = Depends(get_db)):
    logs = db.query(ScrapeLog).order_by(desc(ScrapeLog.scraped_at)).limit(limit).all()
    return [
        {
            "id": log.id,
            "provider_name": log.provider_name,
            "url": log.url,
            "status": log.status,
            "models_found": log.models_found,
            "error_message": log.error_message,
            "scraped_at": log.scraped_at,
            "duration_seconds": log.duration_seconds,
        }
        for log in logs
    ]


@app.post("/api/sweep", response_model=SweepResponse)
async def trigger_sweep(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    def run():
        new_db = next(get_db())
        results = run_full_sweep(new_db)
        new_db.close()

    background_tasks.add_task(run)

    return SweepResponse(
        status="started",
        results={},
        total_updated=0,
        timestamp=datetime.now(timezone.utc),
    )


@app.post("/api/sweep/{provider_name}")
async def trigger_provider_sweep(provider_name: str, db: Session = Depends(get_db)):
    count = scrape_provider(provider_name, db)
    return {
        "status": "completed",
        "provider": provider_name,
        "models_updated": count,
        "timestamp": datetime.now(timezone.utc),
    }
