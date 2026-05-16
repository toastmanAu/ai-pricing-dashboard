require('dotenv').config();
const express = require('express');
const path = require('path');
const cron = require('node-cron');
const { initDb, query, run } = require('./db');
const { seedInitialData, runFullSweep, scrapeProvider, verifyEndpoint } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 8000;

const STATIC_DIR = path.resolve(__dirname, 'static');
const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

console.log('Static dir:', STATIC_DIR);
console.log('Templates dir:', TEMPLATES_DIR);

app.use(express.json());
app.use('/static', express.static(STATIC_DIR));
app.use('/templates', express.static(TEMPLATES_DIR));

app.get('/', (req, res) => {
    res.sendFile(path.join(TEMPLATES_DIR, 'index.html'));
});

app.get('/api/models', (req, res) => {
    const { provider, modality, sort_by = 'name' } = req.query;

    let sql = `
        SELECT m.*, p.name as provider_name,
               ph.input_price_per_million, ph.output_price_per_million,
               ph.cache_read_price_per_million, ph.cache_write_price_per_million,
               ph.scraped_at as last_updated
        FROM models m
        JOIN providers p ON m.provider_id = p.id
        LEFT JOIN pricing_history ph ON m.id = ph.model_id
        WHERE m.is_active = 1
    `;
    const params = [];

    if (provider) {
        sql += ' AND p.name = ?';
        params.push(provider);
    }
    if (modality) {
        sql += ' AND m.modality = ?';
        params.push(modality);
    }

    sql += ' ORDER BY ph.effective_date DESC, m.name';

    const results = query(sql, params);

    const seen = new Set();
    const models = [];
    for (const row of results) {
        if (!seen.has(row.id)) {
            seen.add(row.id);
            models.push({
                id: row.id,
                name: row.name,
                display_name: row.display_name || row.name,
                provider_name: row.provider_name,
                modality: row.modality || 'text',
                context_window: row.context_window,
                max_output_tokens: row.max_output_tokens,
                input_price_per_million: row.input_price_per_million,
                output_price_per_million: row.output_price_per_million,
                cache_read_price_per_million: row.cache_read_price_per_million,
                cache_write_price_per_million: row.cache_write_price_per_million,
                last_updated: row.last_updated,
            });
        }
    }

    if (sort_by === 'price') {
        models.sort((a, b) => (a.input_price_per_million || 0) - (b.input_price_per_million || 0));
    } else if (sort_by === 'provider') {
        models.sort((a, b) => a.provider_name.localeCompare(b.provider_name));
    } else {
        models.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    res.json(models);
});

app.get('/api/providers', (req, res) => {
    const providers = query('SELECT * FROM providers ORDER BY name');

    const result = providers.map(p => {
        const modelCount = query(`SELECT COUNT(*) as count FROM models WHERE provider_id = ? AND is_active = 1`, [p.id])[0]?.count || 0;
        const lastScrape = query(`SELECT scraped_at FROM scrape_logs WHERE provider_name = ? ORDER BY scraped_at DESC LIMIT 1`, [p.name])[0];
        const urls = query(`SELECT url FROM provider_urls WHERE provider_id = ?`, [p.id]).map(u => u.url);

        return {
            id: p.id,
            name: p.name,
            website: p.website,
            model_count: modelCount,
            pricing_urls: urls,
            last_scraped: lastScrape?.scraped_at || null,
        };
    });

    res.json(result);
});

app.get('/api/pricing-history/:modelName', (req, res) => {
    const model = query(`SELECT m.*, p.name as provider_name FROM models m JOIN providers p ON m.provider_id = p.id WHERE m.name = ?`, [req.params.modelName])[0];
    if (!model) {
        return res.status(404).json({ error: 'Model not found' });
    }

    const history = query(
        `SELECT * FROM pricing_history WHERE model_id = ? ORDER BY effective_date DESC LIMIT 50`,
        [model.id]
    );

    res.json({
        model: model.display_name,
        provider: model.provider_name,
        history: history.map(h => ({
            input_price: h.input_price_per_million,
            output_price: h.output_price_per_million,
            cache_read_price: h.cache_read_price_per_million,
            cache_write_price: h.cache_write_price_per_million,
            effective_date: h.effective_date,
            scraped_at: h.scraped_at,
            source_url: h.source_url,
        })),
    });
});

app.get('/api/stats', (req, res) => {
    const totalModels = query(`SELECT COUNT(*) as count FROM models WHERE is_active = 1`)[0]?.count || 0;
    const totalProviders = query(`SELECT COUNT(*) as count FROM providers`)[0]?.count || 0;
    const totalScrapes = query(`SELECT COUNT(*) as count FROM scrape_logs`)[0]?.count || 0;
    const lastScrape = query(`SELECT scraped_at FROM scrape_logs ORDER BY scraped_at DESC LIMIT 1`)[0];

    const priceStats = query(`
        SELECT MIN(input_price_per_million) as min, MAX(input_price_per_million) as max, AVG(input_price_per_million) as avg
        FROM pricing_history WHERE input_price_per_million IS NOT NULL
    `)[0];

    res.json({
        total_models: totalModels,
        total_providers: totalProviders,
        total_scrapes: totalScrapes,
        last_scrape: lastScrape?.scraped_at || null,
        price_range: {
            min: priceStats?.min || null,
            max: priceStats?.max || null,
            avg: priceStats?.avg ? parseFloat(parseFloat(priceStats.avg).toFixed(2)) : null,
        },
    });
});

app.get('/api/scrape-logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const logs = query(`SELECT * FROM scrape_logs ORDER BY scraped_at DESC LIMIT ?`, [limit]);
    res.json(logs);
});

app.post('/api/sweep', async (req, res) => {
    res.json({ status: 'started', timestamp: new Date().toISOString() });

    try {
        const result = await runFullSweep();
        console.log('Sweep completed:', result);
    } catch (err) {
        console.error('Sweep failed:', err.message);
    }
});

app.post('/api/sweep/:providerName', async (req, res) => {
    const count = await scrapeProvider(req.params.providerName);
    res.json({
        status: 'completed',
        provider: req.params.providerName,
        models_updated: count,
        timestamp: new Date().toISOString(),
    });
});

app.post('/api/providers', async (req, res) => {
    const { name, website, pricing_urls } = req.body;

    if (!name?.trim()) {
        return res.status(400).json({ error: 'Provider name is required' });
    }
    if (!website?.trim()) {
        return res.status(400).json({ error: 'Website URL is required' });
    }
    if (!Array.isArray(pricing_urls) || pricing_urls.length === 0) {
        return res.status(400).json({ error: 'At least one pricing URL is required' });
    }

    const existing = query(`SELECT id FROM providers WHERE name = ?`, [name.trim()]);
    if (existing.length > 0) {
        return res.status(409).json({ error: 'Provider already exists' });
    }

    const verificationResults = [];
    let allValid = true;

    for (const url of pricing_urls) {
        if (!url.trim()) {
            allValid = false;
            verificationResults.push({ url: url || '', status: 'error', message: 'Empty URL' });
            continue;
        }
        try {
            new URL(url.trim());
        } catch {
            allValid = false;
            verificationResults.push({ url: url.trim(), status: 'error', message: 'Invalid URL format' });
            continue;
        }

        const result = await verifyEndpoint(url.trim());
        verificationResults.push(result);
        if (result.status !== 'success') {
            allValid = false;
        }
    }

    if (!allValid) {
        return res.status(400).json({
            error: 'One or more endpoints failed verification',
            verification: verificationResults,
        });
    }

    run(`INSERT INTO providers (name, website) VALUES (?, ?)`, [name.trim(), website.trim()]);
    const provider = query(`SELECT * FROM providers WHERE name = ?`, [name.trim()])[0];

    for (const url of pricing_urls) {
        if (url.trim()) {
            run(`INSERT INTO provider_urls (provider_id, url) VALUES (?, ?)`, [provider.id, url.trim()]);
        }
    }

    res.json({
        status: 'created',
        provider: {
            id: provider.id,
            name: provider.name,
            website: provider.website,
            pricing_urls: pricing_urls.filter(u => u.trim()),
        },
        verification: verificationResults,
    });
});

app.delete('/api/providers/:id', (req, res) => {
    const provider = query(`SELECT * FROM providers WHERE id = ?`, [req.params.id])[0];
    if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
    }

    run(`DELETE FROM provider_urls WHERE provider_id = ?`, [req.params.id]);
    run(`DELETE FROM pricing_history WHERE model_id IN (SELECT id FROM models WHERE provider_id = ?)`, [req.params.id]);
    run(`DELETE FROM models WHERE provider_id = ?`, [req.params.id]);
    run(`DELETE FROM scrape_logs WHERE provider_name = ?`, [provider.name]);
    run(`DELETE FROM providers WHERE id = ?`, [req.params.id]);

    res.json({ status: 'deleted', provider: provider.name });
});

app.get('/api/provider-urls/:providerId', (req, res) => {
    const urls = query(`SELECT * FROM provider_urls WHERE provider_id = ?`, [req.params.providerId]);
    res.json(urls);
});

app.post('/api/verify-endpoint', async (req, res) => {
    const { url } = req.body;
    if (!url?.trim()) {
        return res.status(400).json({ error: 'URL is required' });
    }
    const result = await verifyEndpoint(url.trim());
    res.json(result);
});

async function start() {
    await initDb();
    seedInitialData();

    const updateInterval = parseInt(process.env.UPDATE_INTERVAL_HOURS) || 24;
    const cronExpr = `0 */${updateInterval} * * *`;
    cron.schedule(cronExpr, async () => {
        console.log(`Running scheduled sweep (${updateInterval}h interval)`);
        try {
            await runFullSweep();
        } catch (err) {
            console.error('Scheduled sweep failed:', err.message);
        }
    });

    app.listen(PORT, () => {
        console.log(`AI Pricing Dashboard running at http://localhost:${PORT}`);
    });
}

start();
