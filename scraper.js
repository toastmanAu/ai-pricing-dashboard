const axios = require('axios');
const cheerio = require('cheerio');
const { query, run } = require('./db');

const FIRECRAWL_URL = process.env.FIRECRAWL_BASE_URL || 'http://192.168.68.134:3002';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';

const PROVIDER_SOURCES = {
    "OpenAI": {
        website: "https://openai.com",
        pricing_urls: [
            "https://openai.com/api/pricing/",
            "https://platform.openai.com/docs/pricing",
        ],
    },
    "Anthropic": {
        website: "https://anthropic.com",
        pricing_urls: [
            "https://www.anthropic.com/pricing",
            "https://docs.anthropic.com/en/docs/about-claude/models",
        ],
    },
    "Google": {
        website: "https://ai.google.dev",
        pricing_urls: [
            "https://ai.google.dev/pricing",
            "https://cloud.google.com/vertex-ai/generative-ai/pricing",
        ],
    },
    "Mistral": {
        website: "https://mistral.ai",
        pricing_urls: [
            "https://mistral.ai/technology/#models",
            "https://docs.mistral.ai/getting-started/models/models_overview/",
        ],
    },
    "Cohere": {
        website: "https://cohere.com",
        pricing_urls: ["https://cohere.com/pricing"],
    },
    "Amazon": {
        website: "https://aws.amazon.com",
        pricing_urls: ["https://aws.amazon.com/bedrock/pricing/"],
    },
    "DeepSeek": {
        website: "https://deepseek.com",
        pricing_urls: ["https://api-docs.deepseek.com/quick_start/pricing"],
    },
    "xAI": {
        website: "https://x.ai",
        pricing_urls: ["https://docs.x.ai/docs/models"],
    },
    "Perplexity": {
        website: "https://perplexity.ai",
        pricing_urls: ["https://docs.perplexity.ai/docs/model-cards"],
    },
    "Groq": {
        website: "https://groq.com",
        pricing_urls: ["https://console.groq.com/docs/models"],
    },
    "Together AI": {
        website: "https://together.ai",
        pricing_urls: ["https://www.together.ai/pricing"],
    },
    "Replicate": {
        website: "https://replicate.com",
        pricing_urls: ["https://replicate.com/pricing"],
    },
};

const KNOWN_MODELS = [
    // OpenAI
    { name: "gpt-5.5", provider: "OpenAI", display_name: "GPT-5.5", modality: "multimodal", context_window: 400000 },
    { name: "gpt-5.4", provider: "OpenAI", display_name: "GPT-5.4", modality: "multimodal", context_window: 400000 },
    { name: "gpt-5.4-mini", provider: "OpenAI", display_name: "GPT-5.4 mini", modality: "multimodal", context_window: 400000 },
    { name: "gpt-4o", provider: "OpenAI", display_name: "GPT-4o", modality: "multimodal", context_window: 128000 },
    { name: "gpt-4o-mini", provider: "OpenAI", display_name: "GPT-4o mini", modality: "multimodal", context_window: 128000 },
    { name: "o1", provider: "OpenAI", display_name: "o1", modality: "text", context_window: 200000 },
    { name: "o1-pro", provider: "OpenAI", display_name: "o1 Pro", modality: "text", context_window: 200000 },
    { name: "o3", provider: "OpenAI", display_name: "o3", modality: "text", context_window: 200000 },
    { name: "o3-pro", provider: "OpenAI", display_name: "o3 Pro", modality: "text", context_window: 200000 },
    { name: "o4-mini", provider: "OpenAI", display_name: "o4 mini", modality: "text", context_window: 200000 },
    { name: "gpt-4.1", provider: "OpenAI", display_name: "GPT-4.1", modality: "multimodal", context_window: 1047576 },
    { name: "gpt-4.1-mini", provider: "OpenAI", display_name: "GPT-4.1 mini", modality: "multimodal", context_window: 1047576 },
    { name: "gpt-realtime-2", provider: "OpenAI", display_name: "GPT-Realtime-2", modality: "multimodal", context_window: 128000 },
    { name: "gpt-image-2", provider: "OpenAI", display_name: "GPT-Image-2", modality: "multimodal", context_window: 128000 },
    // Anthropic
    { name: "claude-opus-4-7", provider: "Anthropic", display_name: "Claude Opus 4.7", modality: "multimodal", context_window: 200000 },
    { name: "claude-sonnet-4-6", provider: "Anthropic", display_name: "Claude Sonnet 4.6", modality: "multimodal", context_window: 200000 },
    { name: "claude-haiku-4-5", provider: "Anthropic", display_name: "Claude Haiku 4.5", modality: "multimodal", context_window: 200000 },
    { name: "claude-sonnet-4-20250514", provider: "Anthropic", display_name: "Claude Sonnet 4", modality: "multimodal", context_window: 200000 },
    { name: "claude-opus-4-20250514", provider: "Anthropic", display_name: "Claude Opus 4", modality: "multimodal", context_window: 200000 },
    { name: "claude-3-5-sonnet-20241022", provider: "Anthropic", display_name: "Claude 3.5 Sonnet", modality: "multimodal", context_window: 200000 },
    { name: "claude-3-5-haiku-20241022", provider: "Anthropic", display_name: "Claude 3.5 Haiku", modality: "multimodal", context_window: 200000 },
    { name: "claude-3-opus-20240229", provider: "Anthropic", display_name: "Claude 3 Opus", modality: "multimodal", context_window: 200000 },
    // Google
    { name: "gemini-2.5-pro", provider: "Google", display_name: "Gemini 2.5 Pro", modality: "multimodal", context_window: 1000000 },
    { name: "gemini-2.5-flash", provider: "Google", display_name: "Gemini 2.5 Flash", modality: "multimodal", context_window: 1000000 },
    { name: "gemini-2.0-flash", provider: "Google", display_name: "Gemini 2.0 Flash", modality: "multimodal", context_window: 1000000 },
    { name: "gemini-2.0-flash-lite", provider: "Google", display_name: "Gemini 2.0 Flash Lite", modality: "multimodal", context_window: 1000000 },
    // Mistral
    { name: "mistral-large-2", provider: "Mistral", display_name: "Mistral Large 2", modality: "text", context_window: 128000 },
    { name: "mistral-small-3", provider: "Mistral", display_name: "Mistral Small 3", modality: "text", context_window: 128000 },
    { name: "mistral-small-2503", provider: "Mistral", display_name: "Mistral Small 25.03", modality: "text", context_window: 128000 },
    { name: "pixtral-large", provider: "Mistral", display_name: "Pixtral Large", modality: "multimodal", context_window: 128000 },
    { name: "pixtral-12b", provider: "Mistral", display_name: "Pixtral 12B", modality: "multimodal", context_window: 128000 },
    { name: "ministral-8b", provider: "Mistral", display_name: "Ministral 8B", modality: "text", context_window: 128000 },
    { name: "codestral", provider: "Mistral", display_name: "Codestral", modality: "text", context_window: 256000 },
    // DeepSeek
    { name: "deepseek-v3", provider: "DeepSeek", display_name: "DeepSeek V3", modality: "text", context_window: 64000 },
    { name: "deepseek-v3.1", provider: "DeepSeek", display_name: "DeepSeek V3.1", modality: "text", context_window: 128000 },
    { name: "deepseek-r1", provider: "DeepSeek", display_name: "DeepSeek R1", modality: "text", context_window: 64000 },
    { name: "deepseek-r1-0528", provider: "DeepSeek", display_name: "DeepSeek R1 0528", modality: "text", context_window: 128000 },
    // xAI
    { name: "grok-3", provider: "xAI", display_name: "Grok 3", modality: "text", context_window: 131072 },
    { name: "grok-3-mini", provider: "xAI", display_name: "Grok 3 Mini", modality: "text", context_window: 131072 },
    { name: "grok-4", provider: "xAI", display_name: "Grok 4", modality: "text", context_window: 256000 },
    // Cohere
    { name: "command-a", provider: "Cohere", display_name: "Command A", modality: "text", context_window: 256000 },
    { name: "command-r7b-12-2024", provider: "Cohere", display_name: "Command R7B", modality: "text", context_window: 128000 },
    { name: "embed-v4", provider: "Cohere", display_name: "Embed V4", modality: "text", context_window: 8000 },
    // Meta
    { name: "llama-3.1-405b", provider: "Meta", display_name: "Llama 3.1 405B", modality: "text", context_window: 128000 },
    { name: "llama-4-maverick", provider: "Meta", display_name: "Llama 4 Maverick", modality: "multimodal", context_window: 10000000 },
    { name: "llama-4-scout", provider: "Meta", display_name: "Llama 4 Scout", modality: "multimodal", context_window: 10000000 },
];

const DEFAULT_PRICING = {
    "gpt-5.5": { input: 5.00, output: 30.00, cache_read: 0.50 },
    "gpt-5.4": { input: 2.50, output: 15.00, cache_read: 0.25 },
    "gpt-5.4-mini": { input: 0.75, output: 4.50, cache_read: 0.075 },
    "gpt-4o": { input: 2.50, output: 10.00, cache_read: 1.25 },
    "gpt-4o-mini": { input: 0.15, output: 0.60, cache_read: 0.075 },
    "o1": { input: 15.00, output: 60.00 },
    "o1-pro": { input: 150.00, output: 600.00 },
    "o3": { input: 10.00, output: 40.00 },
    "o3-pro": { input: 100.00, output: 400.00 },
    "o4-mini": { input: 1.10, output: 4.40 },
    "gpt-4.1": { input: 2.00, output: 8.00, cache_read: 0.50 },
    "gpt-4.1-mini": { input: 0.40, output: 1.60, cache_read: 0.10 },
    "gpt-realtime-2": { input: 4.00, output: 24.00, cache_read: 0.40 },
    "gpt-image-2": { input: 5.00, output: 30.00, cache_read: 1.25 },
    "claude-opus-4-7": { input: 5.00, output: 25.00, cache_read: 0.50, cache_write: 6.25 },
    "claude-sonnet-4-6": { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },
    "claude-haiku-4-5": { input: 1.00, output: 5.00, cache_read: 0.10, cache_write: 1.25 },
    "claude-sonnet-4-20250514": { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },
    "claude-opus-4-20250514": { input: 15.00, output: 75.00, cache_read: 1.50, cache_write: 18.75 },
    "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00, cache_read: 0.30, cache_write: 3.75 },
    "claude-3-5-haiku-20241022": { input: 0.80, output: 4.00, cache_read: 0.08, cache_write: 1.00 },
    "claude-3-opus-20240229": { input: 15.00, output: 75.00 },
    "gemini-2.5-pro": { input: 1.25, output: 10.00 },
    "gemini-2.5-flash": { input: 0.15, output: 0.60 },
    "gemini-2.0-flash": { input: 0.10, output: 0.40 },
    "gemini-2.0-flash-lite": { input: 0.075, output: 0.30 },
    "mistral-large-2": { input: 2.00, output: 6.00 },
    "mistral-small-3": { input: 0.10, output: 0.30 },
    "mistral-small-2503": { input: 0.10, output: 0.30 },
    "pixtral-large": { input: 2.00, output: 6.00 },
    "pixtral-12b": { input: 0.15, output: 0.15 },
    "ministral-8b": { input: 0.10, output: 0.10 },
    "codestral": { input: 0.20, output: 0.60 },
    "deepseek-v3": { input: 0.27, output: 1.10 },
    "deepseek-v3.1": { input: 0.50, output: 2.00 },
    "deepseek-r1": { input: 0.55, output: 2.19 },
    "deepseek-r1-0528": { input: 0.50, output: 2.00 },
    "grok-3": { input: 3.00, output: 15.00 },
    "grok-3-mini": { input: 0.30, output: 0.50 },
    "grok-4": { input: 5.00, output: 25.00 },
    "command-a": { input: 2.50, output: 10.00 },
    "command-r7b-12-2024": { input: 0.0375, output: 0.15 },
    "embed-v4": { input: 0.10, output: 0.10 },
    "llama-3.1-405b": { input: 5.00, output: 15.00 },
    "llama-4-maverick": { input: 0.25, output: 1.00 },
    "llama-4-scout": { input: 0.15, output: 0.60 },
};

async function scrapeWithFirecrawl(url) {
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (FIRECRAWL_API_KEY) {
            headers['Authorization'] = `Bearer ${FIRECRAWL_API_KEY}`;
        }

        const response = await axios.post(`${FIRECRAWL_URL}/v1/scrape`, {
            url,
            formats: ['markdown', 'html'],
            onlyMainContent: true,
        }, {
            headers,
            timeout: 60000,
        });
        return response.data?.data;
    } catch (err) {
        console.error(`Firecrawl error for ${url}:`, err.message);
        return scrapeWithHttp(url);
    }
}

async function scrapeWithHttp(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
            timeout: 15000,
            maxRedirects: 5,
        });
        return { html: response.data, markdown: '', url: response.request?.res?.responseUrl || url };
    } catch (err) {
        console.error(`HTTP error for ${url}:`, err.message);
        return null;
    }
}

async function verifyEndpoint(url) {
    const result = { url, status: 'error', message: '', contentLength: 0, hasPricingData: false };
    const startTime = Date.now();

    try {
        new URL(url);
    } catch {
        result.message = 'Invalid URL format';
        return result;
    }

    try {
        const scrapeResult = await scrapeWithFirecrawl(url);
        if (!scrapeResult) {
            result.message = 'Failed to fetch page content';
            result.responseTime = Date.now() - startTime;
            return result;
        }

        const content = scrapeResult.markdown || scrapeResult.html || '';
        result.contentLength = content.length;
        result.responseTime = Date.now() - startTime;

        if (content.length < 100) {
            result.message = 'Page returned minimal content (< 100 chars)';
            return result;
        }

        const priceSignals = [
            /input.*\$\d/i, /output.*\$\d/i, /price.*\$\d/i,
            /\$[\d.]+\s*\/\s*(?:1M|million|token)/i,
            /per.*token/i, /per.*call/i, /per.*request/i,
            /\$[\d.]+.*(?:input|output|prompt|completion)/i,
            /pricing/i, /cost/i, /rate/i,
        ];

        let signalCount = 0;
        for (const signal of priceSignals) {
            if (signal.test(content)) signalCount++;
        }

        if (signalCount >= 2) {
            result.status = 'success';
            result.hasPricingData = true;
            result.message = `Found ${signalCount} pricing signals in page content`;
        } else if (signalCount === 1) {
            result.status = 'warning';
            result.message = 'Limited pricing data found — page may not contain model pricing';
        } else {
            result.message = 'No pricing-related content detected on page';
        }

        if (content.length > 500) {
            result.preview = content.substring(0, 500).replace(/\n/g, ' ').substring(0, 200) + '...';
        }

    } catch (err) {
        result.message = `Verification failed: ${err.message}`;
        result.responseTime = Date.now() - startTime;
    }

    return result;
}

function extractPricesFromHtml(html, providerName) {
    const $ = cheerio.load(html);
    const results = [];

    $('table').each((_, table) => {
        const rows = $(table).find('tr');
        if (rows.length < 2) return;

        const headers = [];
        rows.first().find('th, td').each((_, th) => {
            headers.push($(th).text().trim().toLowerCase());
        });

        rows.each((i, tr) => {
            if (i === 0) return;
            const cells = $(tr).find('td, th');
            if (cells.length < 2) return;

            const rowData = {};
            cells.each((j, td) => {
                const key = headers[j] || `col_${j}`;
                rowData[key] = $(td).text().trim();
            });

            const modelName = findModelInRow(rowData, providerName);
            if (modelName) {
                const prices = extractPricesFromRow(rowData);
                if (prices.input || prices.output) {
                    results.push({ model: modelName, ...prices });
                }
            }
        });
    });

    $('div, section, article').each((_, el) => {
        const text = $(el).text();
        for (const model of KNOWN_MODELS) {
            if (model.provider !== providerName) continue;
            if (results.find(r => r.model === model.name)) continue;

            if (text.includes(model.name) || text.includes(model.display_name)) {
                const prices = extractPricesFromText(text, model.name);
                if (prices && (prices.input || prices.output)) {
                    results.push({ model: model.name, ...prices });
                }
            }
        }
    });

    return results;
}

function findModelInRow(rowData, providerName) {
    for (const [key, value] of Object.entries(rowData)) {
        for (const model of KNOWN_MODELS) {
            if (model.provider !== providerName) continue;
            if (value.toLowerCase().includes(model.name.toLowerCase()) ||
                value.toLowerCase().includes(model.display_name.toLowerCase())) {
                return model.name;
            }
        }
    }
    return null;
}

function extractPricesFromRow(rowData) {
    const prices = {};

    for (const [key, value] of Object.entries(rowData)) {
        const lower = key.toLowerCase();
        const price = parseFloat(value.replace(/[$,]/g, ''));

        if (isNaN(price)) continue;

        if (lower.includes('input') || lower.includes('prompt')) {
            prices.input = normalizePrice(price, value);
        } else if (lower.includes('output') || lower.includes('completion')) {
            prices.output = normalizePrice(price, value);
        } else if (lower.includes('cache') && lower.includes('read')) {
            prices.cache_read = normalizePrice(price, value);
        } else if (lower.includes('cache') && lower.includes('write')) {
            prices.cache_write = normalizePrice(price, value);
        }
    }

    return prices;
}

function extractPricesFromText(text, modelName) {
    const prices = {};
    const modelSection = text.split(new RegExp(modelName, 'i'))[1];
    if (!modelSection) return prices;

    const section = modelSection.substring(0, 500);

    const inputMatch = section.match(/input[:\s]*\$?([\d.]+)\s*(?:per\s*)?(?:million|1M|\/1M|tokens)?/i);
    const outputMatch = section.match(/output[:\s]*\$?([\d.]+)\s*(?:per\s*)?(?:million|1M|\/1M|tokens)?/i);
    const cacheReadMatch = section.match(/cache\s*(?:read|input)[:\s]*\$?([\d.]+)/i);
    const cacheWriteMatch = section.match(/cache\s*write[:\s]*\$?([\d.]+)/i);

    if (inputMatch) prices.input = parseFloat(inputMatch[1]);
    if (outputMatch) prices.output = parseFloat(outputMatch[1]);
    if (cacheReadMatch) prices.cache_read = parseFloat(cacheReadMatch[1]);
    if (cacheWriteMatch) prices.cache_write = parseFloat(cacheWriteMatch[1]);

    return prices;
}

function normalizePrice(price, rawValue) {
    const lower = rawValue.toLowerCase();
    if (lower.includes('per 1k') || lower.includes('/1k')) {
        return price * 1000;
    }
    if (lower.includes('per token') && !lower.includes('million')) {
        return price * 1000000;
    }
    return price;
}

function extractPricesFromTable(markdown, providerName) {
    const results = [];
    const tableRegex = /\|(.+)\|\n\|[-\s|:]+\|\n((?:\|.+\|\n?)+)/g;
    let tableMatch;

    while ((tableMatch = tableRegex.exec(markdown)) !== null) {
        const headers = tableMatch[1].split('|').map(h => h.trim().toLowerCase());
        const rows = tableMatch[2].trim().split('\n').map(row =>
            row.split('|').slice(1, -1).map(c => c.trim())
        );

        const featureIdx = headers.findIndex(h => h.includes('feature'));
        if (featureIdx === -1) continue;

        const modelCols = [];
        for (let i = 0; i < headers.length; i++) {
            if (i === featureIdx) continue;
            for (const model of KNOWN_MODELS) {
                if (model.provider !== providerName) continue;
                if (headers[i].includes(model.name.toLowerCase().replace(/-/g, ' ')) ||
                    headers[i].includes(model.display_name.toLowerCase())) {
                    modelCols.push({ idx: i, model });
                    break;
                }
            }
        }

        for (const row of rows) {
            const feature = row[featureIdx]?.toLowerCase() || '';
            if (!feature.includes('pricing') && !feature.includes('price')) continue;

            for (const { idx, model } of modelCols) {
                const cell = row[idx] || '';
                const prices = {};
                const inputM = cell.match(/\$([\d.]+)\s*\/\s*input/i);
                const outputM = cell.match(/\$([\d.]+)\s*\/\s*output/i);
                if (inputM) prices.input = parseFloat(inputM[1]);
                if (outputM) prices.output = parseFloat(outputM[1]);
                if (prices.input || prices.output) {
                    results.push({ model: model.name, ...prices });
                }
            }
        }
    }

    return results;
}

function extractPricesFromMarkdown(markdown, providerName) {
    const results = [];

    for (const model of KNOWN_MODELS) {
        if (model.provider !== providerName) continue;

        const displayNameEscaped = model.display_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameEscaped = model.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const namePattern = new RegExp(`(?:^|\\n)#{0,3}\\s*${displayNameEscaped}\\s*(?:\\n|$)`, 'im');
        const namePattern2 = new RegExp(`(?:^|\\n)#{0,3}\\s*${nameEscaped}\\s*(?:\\n|$)`, 'im');

        let matchPos = -1;
        let m = namePattern.exec(markdown);
        if (m) matchPos = m.index;
        else {
            m = namePattern2.exec(markdown);
            if (m) matchPos = m.index;
        }

        if (matchPos === -1) continue;

        let sectionEnd = markdown.indexOf('\n## ', matchPos + 10);
        if (sectionEnd === -1) sectionEnd = markdown.indexOf('\n# ', matchPos + 10);
        if (sectionEnd === -1) sectionEnd = Math.min(matchPos + 2000, markdown.length);

        const section = markdown.substring(matchPos, sectionEnd);
        const prices = {};

        // Format 1: OpenAI style - "Input:\n$5.00 / 1M tokens"
        const inputMatch = section.match(/input[:\s]*\n?\s*\$?([\d.]+)\s*\/\s*(?:1M|million)/i);
        const outputMatch = section.match(/output[:\s]*\n?\s*\$?([\d.]+)\s*\/\s*(?:1M|million)/i);
        const cacheInputMatch = section.match(/cached\s*input[:\s]*\n?\s*\$?([\d.]+)\s*\/\s*(?:1M|million)/i);
        const cacheReadMatch = section.match(/cache\s*(?:read|input)[:\s]*\n?\s*\$?([\d.]+)\s*\/\s*(?:1M|million)/i);
        const cacheWriteMatch = section.match(/cache\s*write[:\s]*\n?\s*\$?([\d.]+)\s*\/\s*(?:1M|million)/i);

        // Format 2: Anthropic table style - "$5 / input MTok"
        const inputPriceMatch = section.match(/\$([\d.]+)\s*\/\s*input\s*(?:M|m)tok/i);
        const outputPriceMatch = section.match(/\$([\d.]+)\s*\/\s*output\s*(?:M|m)tok/i);

        if (inputMatch) prices.input = parseFloat(inputMatch[1]);
        else if (inputPriceMatch) prices.input = parseFloat(inputPriceMatch[1]);

        if (outputMatch) prices.output = parseFloat(outputMatch[1]);
        else if (outputPriceMatch) prices.output = parseFloat(outputPriceMatch[1]);

        if (cacheInputMatch) prices.cache_read = parseFloat(cacheInputMatch[1]);
        else if (cacheReadMatch) prices.cache_read = parseFloat(cacheReadMatch[1]);
        if (cacheWriteMatch) prices.cache_write = parseFloat(cacheWriteMatch[1]);

        if (prices.input || prices.output) {
            results.push({ model: model.name, ...prices });
        }
    }

    return results;
}

async function scrapeProvider(providerName) {
    const startTime = Date.now();
    const source = PROVIDER_SOURCES[providerName];

    let urls = [];
    if (source) {
        urls = [...source.pricing_urls];
    }

    const dbUrls = query(`SELECT url FROM provider_urls WHERE provider_id = (SELECT id FROM providers WHERE name = ?)`, [providerName]);
    for (const row of dbUrls) {
        if (!urls.includes(row.url)) {
            urls.push(row.url);
        }
    }

    if (urls.length === 0) {
        console.warn(`No source config for: ${providerName}`);
        return 0;
    }

    let modelsFound = 0;

    try {
        for (const url of urls) {
            console.log(`Scraping ${providerName} from ${url}`);
            const result = await scrapeWithFirecrawl(url);

            if (!result) continue;

            let extracted = [];
            if (result.markdown) {
                extracted = extractPricesFromMarkdown(result.markdown, providerName);
                const tableExtracted = extractPricesFromTable(result.markdown, providerName);
                for (const t of tableExtracted) {
                    if (!extracted.find(e => e.model === t.model)) {
                        extracted.push(t);
                    }
                }
            }
            if (result.html && extracted.length === 0) {
                extracted = extractPricesFromHtml(result.html, providerName);
            }

            for (const data of extracted) {
                saveModelPricing(providerName, data.model, {
                    input: data.input,
                    output: data.output,
                    cache_read: data.cache_read,
                    cache_write: data.cache_write,
                }, url);
                modelsFound++;
                console.log(`  ✓ ${data.model}: input=$${data.input}/1M, output=$${data.output}/1M`);
            }
        }
    } catch (err) {
        console.error(`Error scraping ${providerName}:`, err.message);
    }

    const duration = (Date.now() - startTime) / 1000;

    run(`INSERT INTO scrape_logs (provider_name, url, status, models_found, duration_seconds) VALUES (?, ?, ?, ?, ?)`,
        [providerName, source.pricing_urls.join(','), modelsFound > 0 ? 'success' : 'partial', modelsFound, duration]);

    return modelsFound;
}

function seedInitialData() {
    for (const model of KNOWN_MODELS) {
        let provider = query(`SELECT id FROM providers WHERE name = ?`, [model.provider])[0];
        if (!provider) {
            run(`INSERT INTO providers (name, website) VALUES (?, ?)`,
                [model.provider, PROVIDER_SOURCES[model.provider]?.website || '']);
            provider = query(`SELECT id FROM providers WHERE name = ?`, [model.provider])[0];
        }

        const existing = query(`SELECT id FROM models WHERE name = ?`, [model.name])[0];
        if (!existing) {
            run(`INSERT INTO models (name, provider_id, display_name, modality, context_window) VALUES (?, ?, ?, ?, ?)`,
                [model.name, provider.id, model.display_name, model.modality, model.context_window || null]);
        }

        const pricing = DEFAULT_PRICING[model.name];
        if (pricing) {
            const modelRow = query(`SELECT id FROM models WHERE name = ?`, [model.name])[0];
            const existingPricing = query(`SELECT id FROM pricing_history WHERE model_id = ? ORDER BY scraped_at DESC LIMIT 1`, [modelRow.id])[0];
            
            if (!existingPricing) {
                run(`INSERT INTO pricing_history (model_id, input_price_per_million, output_price_per_million, cache_read_price_per_million, cache_write_price_per_million) VALUES (?, ?, ?, ?, ?)`,
                    [modelRow.id, pricing.input, pricing.output, pricing.cache_read || null, pricing.cache_write || null]);
            }
        }
    }
}

function saveModelPricing(providerName, modelName, prices, sourceUrl) {
    let provider = query(`SELECT id FROM providers WHERE name = ?`, [providerName])[0];
    if (!provider) {
        run(`INSERT INTO providers (name, website) VALUES (?, ?)`,
            [providerName, PROVIDER_SOURCES[providerName]?.website || '']);
        provider = query(`SELECT id FROM providers WHERE name = ?`, [providerName])[0];
    }

    let model = query(`SELECT id FROM models WHERE name = ?`, [modelName])[0];
    if (!model) {
        const known = KNOWN_MODELS.find(m => m.name === modelName);
        run(`INSERT INTO models (name, provider_id, display_name, modality) VALUES (?, ?, ?, ?)`,
            [modelName, provider.id, known?.display_name || modelName, known?.modality || 'text']);
        model = query(`SELECT id FROM models WHERE name = ?`, [modelName])[0];
    }

    run(`INSERT INTO pricing_history (model_id, input_price_per_million, output_price_per_million, cache_read_price_per_million, cache_write_price_per_million, source_url) VALUES (?, ?, ?, ?, ?, ?)`,
        [model.id, prices.input || null, prices.output || null, prices.cache_read || null, prices.cache_write || null, sourceUrl]);
}

async function runFullSweep() {
    console.log('Starting full pricing sweep...');
    const results = {};
    let total = 0;

    const builtInProviders = Object.keys(PROVIDER_SOURCES);
    const dbProviders = query(`SELECT name FROM providers WHERE name NOT IN (${builtInProviders.map(() => '?').join(',')})`, builtInProviders);
    const allProviders = [...builtInProviders, ...dbProviders.map(p => p.name)];

    for (const provider of allProviders) {
        const count = await scrapeProvider(provider);
        results[provider] = count;
        total += count;
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`Sweep complete. Found/updated ${total} model entries`);
    return { results, total };
}

module.exports = {
    PROVIDER_SOURCES,
    KNOWN_MODELS,
    DEFAULT_PRICING,
    seedInitialData,
    scrapeProvider,
    runFullSweep,
    scrapeWithFirecrawl,
    verifyEndpoint,
};
