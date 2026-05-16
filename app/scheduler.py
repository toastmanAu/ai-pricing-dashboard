import os
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.database import SessionLocal
from app.scraper import run_full_sweep

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()
UPDATE_INTERVAL_HOURS = int(os.getenv("UPDATE_INTERVAL_HOURS", "24"))


def scheduled_sweep():
    """Run a scheduled pricing sweep."""
    logger.info(f"Running scheduled pricing sweep (interval: {UPDATE_INTERVAL_HOURS}h)")
    db = SessionLocal()
    try:
        results = run_full_sweep(db)
        logger.info(f"Scheduled sweep completed: {results}")
    except Exception as e:
        logger.error(f"Scheduled sweep failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler."""
    if scheduler.running:
        return

    scheduler.add_job(
        scheduled_sweep,
        trigger=IntervalTrigger(hours=UPDATE_INTERVAL_HOURS),
        id="pricing_sweep",
        name="Daily pricing sweep",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(f"Scheduler started with {UPDATE_INTERVAL_HOURS}h interval")


def stop_scheduler():
    """Stop the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
