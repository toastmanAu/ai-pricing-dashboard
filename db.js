const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const DB_PATH = path.join(__dirname, 'ai_pricing.db');

async function initDb() {
    const SQL = await initSqlJs();
    
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            website TEXT,
            api_docs_url TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS provider_urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id INTEGER NOT NULL,
            url TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (provider_id) REFERENCES providers(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            provider_id INTEGER,
            display_name TEXT,
            description TEXT,
            context_window INTEGER,
            max_output_tokens INTEGER,
            modality TEXT DEFAULT 'text',
            knowledge_cutoff TEXT,
            architecture TEXT,
            parameters TEXT,
            is_active INTEGER DEFAULT 1,
            source_url TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (provider_id) REFERENCES providers(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS pricing_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id INTEGER NOT NULL,
            input_price_per_million REAL,
            output_price_per_million REAL,
            cache_read_price_per_million REAL,
            cache_write_price_per_million REAL,
            batch_input_price_per_million REAL,
            batch_output_price_per_million REAL,
            currency TEXT DEFAULT 'USD',
            effective_date TEXT DEFAULT (datetime('now')),
            scraped_at TEXT DEFAULT (datetime('now')),
            source_url TEXT,
            notes TEXT,
            FOREIGN KEY (model_id) REFERENCES models(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS scrape_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_name TEXT,
            url TEXT,
            status TEXT,
            models_found INTEGER DEFAULT 0,
            error_message TEXT,
            scraped_at TEXT DEFAULT (datetime('now')),
            duration_seconds REAL
        )
    `);

    saveDb();
    console.log('Database initialized');
}

function saveDb() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

function getDb() {
    return db;
}

function query(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function run(sql, params = []) {
    db.run(sql, params);
    saveDb();
}

module.exports = { initDb, getDb, query, run, saveDb };
