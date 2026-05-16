import os
import re
import json
import time
import logging
from datetime import datetime, timezone
from typing import Optional
from firecrawl import FirecrawlApp
from bs4 import BeautifulSoup
import httpx
from app.database import SessionLocal, Provider, Model, PricingHistory, ScrapeLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

PROVIDER_SOURCES = {
    "OpenAI": {
        "website": "https://openai.com",
        "pricing_urls": [
            "https://openai.com/api/pricing/",
            "https://platform.openai.com/docs/pricing",
        ],
    },
    "Anthropic": {
        "website": "https://anthropic.com",
        "pricing_urls": [
            "https://www.anthropic.com/pricing",
            "https://docs.anthropic.com/en/docs/about-claude/models",
        ],
    },
    "Google": {
        "website": "https://ai.google.dev",
        "pricing_urls": [
            "https://ai.google.dev/pricing",
            "https://cloud.google.com/vertex-ai/generative-ai/pricing",
        ],
    },
    "Meta": {
        "website": "https://ai.meta.com",
        "pricing_urls": [
            "https://ai.meta.com/blog/meta-llama-3/",
        ],
    },
    "Mistral": {
        "website": "https://mistral.ai",
        "pricing_urls": [
            "https://mistral.ai/technology/#models",
            "https://docs.mistral.ai/getting-started/models/models_overview/",
        ],
    },
    "Cohere": {
        "website": "https://cohere.com",
        "pricing_urls": [
            "https://cohere.com/pricing",
        ],
    },
    "Amazon": {
        "website": "https://aws.amazon.com",
        "pricing_urls": [
            "https://aws.amazon.com/bedrock/pricing/",
        ],
    },
    "DeepSeek": {
        "website": "https://deepseek.com",
        "pricing_urls": [
            "https://api-docs.deepseek.com/quick_start/pricing",
        ],
    },
    "xAI": {
        "website": "https://x.ai",
        "pricing_urls": [
            "https://docs.x.ai/docs/models",
        ],
    },
    "Perplexity": {
        "website": "https://perplexity.ai",
        "pricing_urls": [
            "https://docs.perplexity.ai/docs/model-cards",
        ],
    },
}

# Known models to track with their expected providers
KNOWN_MODELS = [
    # OpenAI
    {"name": "gpt-4o", "provider": "OpenAI", "display_name": "GPT-4o", "modality": "multimodal"},
    {"name": "gpt-4o-mini", "provider": "OpenAI", "display_name": "GPT-4o mini", "modality": "multimodal"},
    {"name": "o1", "provider": "OpenAI", "display_name": "o1", "modality": "text"},
    {"name": "o1-mini", "provider": "OpenAI", "display_name": "o1 mini", "modality": "text"},
    {"name": "o1-pro", "provider": "OpenAI", "display_name": "o1 Pro", "modality": "text"},
    {"name": "o3-mini", "provider": "OpenAI", "display_name": "o3 mini", "modality": "text"},
    {"name": "o4-mini", "provider": "OpenAI", "display_name": "o4 mini", "modality": "text"},
    {"name": "gpt-4.1", "provider": "OpenAI", "display_name": "GPT-4.1", "modality": "multimodal"},
    {"name": "gpt-4.1-mini", "provider": "OpenAI", "display_name": "GPT-4.1 mini", "modality": "multimodal"},
    {"name": "gpt-4.1-nano", "provider": "OpenAI", "display_name": "GPT-4.1 nano", "modality": "multimodal"},
    # Anthropic
    {"name": "claude-sonnet-4-20250514", "provider": "Anthropic", "display_name": "Claude Sonnet 4", "modality": "multimodal"},
    {"name": "claude-opus-4-20250514", "provider": "Anthropic", "display_name": "Claude Opus 4", "modality": "multimodal"},
    {"name": "claude-3-5-sonnet-20241022", "provider": "Anthropic", "display_name": "Claude 3.5 Sonnet", "modality": "multimodal"},
    {"name": "claude-3-5-haiku-20241022", "provider": "Anthropic", "display_name": "Claude 3.5 Haiku", "modality": "multimodal"},
    {"name": "claude-3-opus-20240229", "provider": "Anthropic", "display_name": "Claude 3 Opus", "modality": "multimodal"},
    # Google
    {"name": "gemini-2.5-pro", "provider": "Google", "display_name": "Gemini 2.5 Pro", "modality": "multimodal"},
    {"name": "gemini-2.5-flash", "provider": "Google", "display_name": "Gemini 2.5 Flash", "modality": "multimodal"},
    {"name": "gemini-2.0-flash", "provider": "Google", "display_name": "Gemini 2.0 Flash", "modality": "multimodal"},
    {"name": "gemini-2.0-flash-lite", "provider": "Google", "display_name": "Gemini 2.0 Flash Lite", "modality": "multimodal"},
    # Mistral
    {"name": "mistral-large-2", "provider": "Mistral", "display_name": "Mistral Large 2", "modality": "text"},
    {"name": "mistral-small-3", "provider": "Mistral", "display_name": "Mistral Small 3", "modality": "text"},
    {"name": "pixtral-large", "provider": "Mistral", "display_name": "Pixtral Large", "modality": "multimodal"},
    {"name": "ministral-8b", "provider": "Mistral", "display_name": "Ministral 8B", "modality": "text"},
    # DeepSeek
    {"name": "deepseek-v3", "provider": "DeepSeek", "display_name": "DeepSeek V3", "modality": "text"},
    {"name": "deepseek-r1", "provider": "DeepSeek", "display_name": "DeepSeek R1", "modality": "text"},
    # xAI
    {"name": "grok-3", "provider": "xAI", "display_name": "Grok 3", "modality": "text"},
    {"name": "grok-3-mini", "provider": "xAI", "display_name": "Grok 3 Mini", "modality": "text"},
    # Cohere
    {"name": "command-a", "provider": "Cohere", "display_name": "Command A", "modality": "text"},
    {"name": "command-r7b-12-2024", "provider": "Cohere", "display_name": "Command R7B", "modality": "text"},
]


def extract_price(text: str) -> Optional[float]:
    """Extract a price value from text, handling various formats."""
    if not text:
        return None
    patterns = [
        r'\$?([\d,]+\.?\d*)\s*(?:per|\/)\s*(?:million|1M|1k)',
        r'\$?([\d,]+\.?\d*)',
        r'([\d,]+\.?\d*)\s*cents',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = float(match.group(1).replace(',', ''))
            if 'cents' in text.lower():
                val = val / 100
            return val
    return None


def parse_pricing_table(html_content: str, provider_name: str) -> list[dict]:
    """Parse pricing information from HTML content."""
    soup = BeautifulSoup(html_content, 'html.parser')
    pricing_data = []

    tables = soup.find_all('table')
    for table in tables:
        rows = table.find_all('tr')
        if not rows:
            continue

        headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(['th', 'td'])]

        for row in rows[1:]:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 2:
                continue

            row_data = {}
            for i, cell in enumerate(cells):
                if i < len(headers):
                    row_data[headers[i]] = cell.get_text(strip=True)
                else:
                    row_data[f'col_{i}'] = cell.get_text(strip=True)

            if row_data:
                pricing_data.append(row_data)

    return pricing_data


def scrape_with_firecrawl(url: str, wait_for: str = None) -> Optional[dict]:
    """Scrape a URL using Firecrawl API."""
    if not FIRECRAWL_API_KEY:
        logger.warning("No FIRECRAWL_API_KEY set, using fallback HTTP")
        return scrape_with_http(url)

    try:
        app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)
        params = {
            "formats": ["markdown", "html"],
            "onlyMainContent": True,
        }
        if wait_for:
            params["waitFor"] = wait_for

        result = app.scrape_url(url, params)
        return result
    except Exception as e:
        logger.error(f"Firecrawl error for {url}: {e}")
        return scrape_with_http(url)


def scrape_with_http(url: str) -> Optional[dict]:
    """Fallback HTTP scraper."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        response = httpx.get(url, headers=headers, follow_redirects=True, timeout=30)
        response.raise_for_status()
        return {
            "html": response.text,
            "markdown": "",
            "url": str(response.url),
        }
    except Exception as e:
        logger.error(f"HTTP error for {url}: {e}")
        return None


def extract_pricing_from_markdown(markdown: str, provider_name: str) -> list[dict]:
    """Extract model pricing from markdown content."""
    models_found = []

    lines = markdown.split('\n')
    current_model = None
    pricing_block = {}

    for i, line in enumerate(lines):
        line_lower = line.lower().strip()

        for known in KNOWN_MODELS:
            if known["provider"] != provider_name:
                continue
            if known["name"].lower() in line_lower or known["display_name"].lower() in line_lower:
                if current_model:
                    if pricing_block.get("input") or pricing_block.get("output"):
                        models_found.append({**current_model, **pricing_block})
                current_model = known.copy()
                pricing_block = {}
                break

        if current_model:
            input_match = re.search(r'input[:\s]+\$?([\d.]+)\s*(?:per\s*)?(?:million|1M|\/1M)?', line, re.IGNORECASE)
            output_match = re.search(r'output[:\s]+\$?([\d.]+)\s*(?:per\s*)?(?:million|1M|\/1M)?', line, re.IGNORECASE)
            cache_read_match = re.search(r'cache\s*(?:read|input)[:\s]+\$?([\d.]+)', line, re.IGNORECASE)
            cache_write_match = re.search(r'cache\s*write[:\s]+\$?([\d.]+)', line, re.IGNORECASE)

            if input_match:
                pricing_block["input_price_per_million"] = float(input_match.group(1))
            if output_match:
                pricing_block["output_price_per_million"] = float(output_match.group(1))
            if cache_read_match:
                pricing_block["cache_read_price_per_million"] = float(cache_read_match.group(1))
            if cache_write_match:
                pricing_block["cache_write_price_per_million"] = float(cache_write_match.group(1))

            per_million_match = re.search(r'\$?([\d.]+)\s*\/\s*(?:million|1M)', line)
            if per_million_match and not pricing_block:
                price = float(per_million_match.group(1))
                if 'input' in line_lower:
                    pricing_block["input_price_per_million"] = price
                elif 'output' in line_lower:
                    pricing_block["output_price_per_million"] = price

    if current_model and (pricing_block.get("input") or pricing_block.get("output")):
        models_found.append({**current_model, **pricing_block})

    return models_found


def scrape_provider(provider_name: str, db: SessionLocal) -> int:
    """Scrape pricing data for a specific provider."""
    start_time = time.time()
    source = PROVIDER_SOURCES.get(provider_name)
    if not source:
        logger.warning(f"No source config for provider: {provider_name}")
        return 0

    models_found_count = 0
    log_entry = ScrapeLog(
        provider_name=provider_name,
        url=",".join(source["pricing_urls"]),
        status="success",
    )

    try:
        for url in source["pricing_urls"]:
            logger.info(f"Scraping {provider_name} from {url}")
            result = scrape_with_firecrawl(url)

            if not result:
                continue

            markdown = result.get("markdown", "")
            html = result.get("html", "")

            if markdown:
                extracted = extract_pricing_from_markdown(markdown, provider_name)
                for model_data in extracted:
                    save_model_pricing(model_data, url, db)
                    models_found_count += 1

            if html and models_found_count == 0:
                parsed = parse_pricing_table(html, provider_name)
                for row in parsed:
                    logger.info(f"Parsed row: {row}")

        log_entry.models_found = models_found_count
        log_entry.duration_seconds = time.time() - start_time

    except Exception as e:
        log_entry.status = "error"
        log_entry.error_message = str(e)
        log_entry.duration_seconds = time.time() - start_time
        logger.error(f"Error scraping {provider_name}: {e}")

    finally:
        db.add(log_entry)
        db.commit()

    return models_found_count


def save_model_pricing(model_data: dict, source_url: str, db: SessionLocal):
    """Save or update model pricing in the database."""
    provider_name = model_data.get("provider")
    model_name = model_data.get("name")

    if not provider_name or not model_name:
        return

    provider = db.query(Provider).filter(Provider.name == provider_name).first()
    if not provider:
        provider = Provider(
            name=provider_name,
            website=PROVIDER_SOURCES.get(provider_name, {}).get("website", ""),
        )
        db.add(provider)
        db.flush()

    model = db.query(Model).filter(Model.name == model_name).first()
    if not model:
        model = Model(
            name=model_name,
            provider_id=provider.id,
            display_name=model_data.get("display_name", model_name),
            modality=model_data.get("modality", "text"),
            source_url=source_url,
        )
        db.add(model)
        db.flush()
    else:
        model.updated_at = datetime.now(timezone.utc)

    pricing = PricingHistory(
        model_id=model.id,
        input_price_per_million=model_data.get("input_price_per_million"),
        output_price_per_million=model_data.get("output_price_per_million"),
        cache_read_price_per_million=model_data.get("cache_read_price_per_million"),
        cache_write_price_per_million=model_data.get("cache_write_price_per_million"),
        source_url=source_url,
    )
    db.add(pricing)
    db.commit()


def seed_initial_data(db: SessionLocal):
    """Seed the database with known models and default pricing."""
    for model_info in KNOWN_MODELS:
        provider = db.query(Provider).filter(Provider.name == model_info["provider"]).first()
        if not provider:
            provider = Provider(
                name=model_info["provider"],
                website=PROVIDER_SOURCES.get(model_info["provider"], {}).get("website", ""),
            )
            db.add(provider)
            db.flush()

        existing = db.query(Model).filter(Model.name == model_info["name"]).first()
        if not existing:
            model = Model(
                name=model_info["name"],
                provider_id=provider.id,
                display_name=model_info["display_name"],
                modality=model_info.get("modality", "text"),
            )
            db.add(model)

    db.commit()


def run_full_sweep(db: SessionLocal) -> dict:
    """Run a full pricing sweep across all providers."""
    logger.info("Starting full pricing sweep...")
    results = {}
    total_models = 0

    for provider_name in PROVIDER_SOURCES:
        count = scrape_provider(provider_name, db)
        results[provider_name] = count
        total_models += count
        time.sleep(2)

    logger.info(f"Sweep complete. Found/updated {total_models} model entries")
    return results
