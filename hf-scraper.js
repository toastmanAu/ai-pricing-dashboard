const axios = require('axios');
const { query, run } = require('./db');

const HF_API_BASE = 'https://huggingface.co/api';

const HF_COMPANIES = [
    { name: "Meta", hf_org: "meta-llama", display_name: "Meta AI", website: "https://ai.meta.com" },
    { name: "Mistral", hf_org: "mistralai", display_name: "Mistral AI", website: "https://mistral.ai" },
    { name: "Google", hf_org: "google", display_name: "Google", website: "https://ai.google" },
    { name: "Google DeepMind", hf_org: "google-deepmind", display_name: "Google DeepMind", website: "https://deepmind.google" },
    { name: "Microsoft", hf_org: "microsoft", display_name: "Microsoft", website: "https://microsoft.com" },
    { name: "Amazon", hf_org: "amazon", display_name: "Amazon", website: "https://aws.amazon.com" },
    { name: "Anthropic", hf_org: "anthropic", display_name: "Anthropic", website: "https://anthropic.com" },
    { name: "Cohere", hf_org: "Cohere", display_name: "Cohere", website: "https://cohere.com" },
    { name: "DeepSeek", hf_org: "deepseek-ai", display_name: "DeepSeek", website: "https://deepseek.com" },
    { name: "xAI", hf_org: "xai-org", display_name: "xAI", website: "https://x.ai" },
    { name: "Stability AI", hf_org: "stabilityai", display_name: "Stability AI", website: "https://stability.ai" },
    { name: "EleutherAI", hf_org: "EleutherAI", display_name: "EleutherAI", website: "https://eleuther.ai" },
    { name: "Hugging Face", hf_org: "HuggingFace", display_name: "Hugging Face", website: "https://huggingface.co" },
    { name: "TII", hf_org: "tiiuae", display_name: "Technology Innovation Institute", website: "https://www.tii.ae" },
    { name: "Qwen", hf_org: "Qwen", display_name: "Qwen (Alibaba)", website: "https://qwenlm.github.io" },
    { name: "01.AI", hf_org: "01-ai", display_name: "01.AI", website: "https://www.01.ai" },
    { name: "Databricks", hf_org: "databricks", display_name: "Databricks", website: "https://databricks.com" },
    { name: "Snowflake", hf_org: "Snowflake", display_name: "Snowflake", website: "https://snowflake.com" },
    { name: "Nvidia", hf_org: "nvidia", display_name: "NVIDIA", website: "https://nvidia.com" },
    { name: "IBM", hf_org: "ibm", display_name: "IBM", website: "https://ibm.com" },
    { name: "Salesforce", hf_org: "Salesforce", display_name: "Salesforce", website: "https://salesforce.com" },
    { name: "Adobe", hf_org: "adobe", display_name: "Adobe", website: "https://adobe.com" },
    { name: "Apple", hf_org: "apple", display_name: "Apple", website: "https://apple.com" },
    { name: "OpenGVLab", hf_org: "OpenGVLab", display_name: "OpenGVLab (Shanghai AI Lab)", website: "https://opengvlab.com" },
    { name: "THUDM", hf_org: "THUDM", display_name: "THUDM (Tsinghua)", website: "https://github.com/THUDM" },
    { name: "Alibaba", hf_org: "alibaba-pai", display_name: "Alibaba PAI", website: "https://alibaba.com" },
    { name: "Baidu", hf_org: "baidu", display_name: "Baidu", website: "https://baidu.com" },
    { name: "Tencent", hf_org: "tencent", display_name: "Tencent", website: "https://tencent.com" },
    { name: "Bytedance", hf_org: "bytedance", display_name: "ByteDance", website: "https://bytedance.com" },
    { name: "Zhipu AI", hf_org: "THUDM", display_name: "Zhipu AI", website: "https://zhipuai.cn" },
    { name: "MiniMax", hf_org: "MiniMax-AI", display_name: "MiniMax", website: "https://minimax.chat" },
    { name: "Writer", hf_org: "writer", display_name: "Writer", website: "https://writer.com" },
    { name: "Reka AI", hf_org: "RekaAI", display_name: "Reka AI", website: "https://reka.ai" },
    { name: "AI21 Labs", hf_org: "ai21", display_name: "AI21 Labs", website: "https://ai21.com" },
    { name: "Character.AI", hf_org: "character.ai", display_name: "Character.AI", website: "https://character.ai" },
    { name: "Inflection", hf_org: "inflection", display_name: "Inflection AI", website: "https://inflection.ai" },
    { name: "Perplexity", hf_org: "perplexity", display_name: "Perplexity", website: "https://perplexity.ai" },
    { name: "Together", hf_org: "togethercomputer", display_name: "Together AI", website: "https://together.ai" },
    { name: "Fireworks", hf_org: "fireworks-ai", display_name: "Fireworks AI", website: "https://fireworks.ai" },
    { name: "Groq", hf_org: "groq", display_name: "Groq", website: "https://groq.com" },
    { name: "Anyscale", hf_org: "anyscale", display_name: "Anyscale", website: "https://anyscale.com" },
    { name: "Cerebras", hf_org: "cerebras", display_name: "Cerebras", website: "https://cerebras.net" },
    { name: "SambaNova", hf_org: "sambanova", display_name: "SambaNova", website: "https://sambanova.ai" },
    { name: "Core42", hf_org: "core42", display_name: "Core42", website: "https://core42.ai" },
    { name: "NousResearch", hf_org: "NousResearch", display_name: "Nous Research", website: "https://nousresearch.com" },
    { name: "OpenOrca", hf_org: "Open-Orca", display_name: "OpenOrca", website: "https://openorca.ai" },
    { name: "H2O.ai", hf_org: "h2oai", display_name: "H2O.ai", website: "https://h2o.ai" },
    { name: "Phind", hf_org: "Phind", display_name: "Phind", website: "https://phind.com" },
    { name: "Upstage", hf_org: "upstage", display_name: "Upstage", website: "https://upstage.ai" },
    { name: "Beijing Academy", hf_org: "BAAI", display_name: "Beijing Academy of AI", website: "https://baai.ac.cn" },
];

async function fetchHFModels(hfOrg, limit = 50) {
    try {
        const response = await axios.get(`${HF_API_BASE}/models`, {
            params: {
                author: hfOrg,
                sort: 'lastModified',
                direction: '-1',
                limit: limit,
            },
            timeout: 15000,
        });
        return response.data;
    } catch (err) {
        console.error(`HF API error for ${hfOrg}:`, err.message);
        return [];
    }
}

function seedCompanies() {
    for (const company of HF_COMPANIES) {
        const existing = query(`SELECT id FROM hf_companies WHERE hf_org = ?`, [company.hf_org])[0];
        if (!existing) {
            run(`INSERT INTO hf_companies (name, hf_org, display_name, website) VALUES (?, ?, ?, ?)`,
                [company.name, company.hf_org, company.display_name || company.name, company.website || '']);
        }
    }
    console.log(`Seeded ${HF_COMPANIES.length} HF companies`);
}

async function syncCompanyModels(hfOrg) {
    const company = query(`SELECT * FROM hf_companies WHERE hf_org = ?`, [hfOrg])[0];
    if (!company) {
        console.warn(`Company not found: ${hfOrg}`);
        return 0;
    }

    const models = await fetchHFModels(hfOrg, 100);
    let newCount = 0;

    for (const model of models) {
        const existing = query(`SELECT id FROM hf_models WHERE hf_model_id = ?`, [model.id])[0];
        if (!existing) {
            const tags = model.tags ? JSON.stringify(model.tags) : null;
            run(`
                INSERT INTO hf_models (hf_model_id, company_id, name, full_name, pipeline_tag, library_name, tags, likes, downloads, is_private, created_at, last_modified, hf_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                model.id,
                company.id,
                model.id.split('/')[1],
                model.id,
                model.pipeline_tag || null,
                model.library_name || null,
                tags,
                model.likes || 0,
                model.downloads || 0,
                model.private ? 1 : 0,
                model.createdAt || null,
                model.lastModified || null,
                `https://huggingface.co/${model.id}`,
            ]);
            newCount++;
        } else {
            run(`UPDATE hf_models SET likes = ?, downloads = ?, last_modified = ? WHERE hf_model_id = ?`,
                [model.likes || 0, model.downloads || 0, model.lastModified || null, model.id]);
        }
    }

    if (newCount > 0) {
        console.log(`  + ${newCount} new models from ${company.display_name}`);
    }

    return newCount;
}

async function syncAllTrackedCompanies() {
    const companies = query(`SELECT * FROM hf_companies WHERE is_tracked = 1`);
    let totalNew = 0;

    for (const company of companies) {
        const newCount = await syncCompanyModels(company.hf_org);
        totalNew += newCount;
        await new Promise(r => setTimeout(r, 500));
    }

    return totalNew;
}

function getHFModels(filters = {}) {
    let sql = `
        SELECT m.*, c.name as company_name, c.display_name as company_display
        FROM hf_models m
        JOIN hf_companies c ON m.company_id = c.id
        WHERE c.is_tracked = 1
    `;
    const params = [];

    if (filters.company) {
        sql += ' AND c.hf_org = ?';
        params.push(filters.company);
    }
    if (filters.pipeline_tag) {
        sql += ' AND m.pipeline_tag = ?';
        params.push(filters.pipeline_tag);
    }
    if (filters.search) {
        sql += ' AND (m.name LIKE ? OR m.full_name LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.since) {
        sql += ' AND m.discovered_at >= ?';
        params.push(filters.since);
    }

    const sortMap = {
        'newest': 'm.discovered_at DESC',
        'oldest': 'm.discovered_at ASC',
        'likes': 'm.likes DESC',
        'downloads': 'm.downloads DESC',
        'name': 'm.name ASC',
    };
    sql += ` ORDER BY ${sortMap[filters.sort] || 'm.discovered_at DESC'}`;

    if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
    }

    return query(sql, params);
}

function getHFCompanies() {
    const companies = query(`SELECT * FROM hf_companies ORDER BY name`);
    return companies.map(c => {
        const modelCount = query(`SELECT COUNT(*) as count FROM hf_models WHERE company_id = ?`, [c.id])[0]?.count || 0;
        const newToday = query(`SELECT COUNT(*) as count FROM hf_models WHERE company_id = ? AND date(discovered_at) = date('now')`, [c.id])[0]?.count || 0;
        return { ...c, model_count: modelCount, new_today: newToday };
    });
}

function toggleCompanyTracking(hfOrg, tracked) {
    run(`UPDATE hf_companies SET is_tracked = ? WHERE hf_org = ?`, [tracked ? 1 : 0, hfOrg]);
}

function generateDailySummary(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const companies = query(`SELECT * FROM hf_companies WHERE is_tracked = 1`);
    const summaries = [];

    for (const company of companies) {
        const models = query(`
            SELECT * FROM hf_models
            WHERE company_id = ? AND date(discovered_at) = ?
            ORDER BY likes DESC
        `, [company.id, targetDate]);

        if (models.length > 0) {
            const modelNames = models.map(m => m.full_name);
            const highlights = models
                .filter(m => m.likes > 50 || m.downloads > 1000)
                .map(m => `${m.full_name} (${m.likes} likes, ${m.downloads} downloads)`);

            run(`
                INSERT OR REPLACE INTO hf_daily_summary (summary_date, company_id, total_new_models, model_names, highlights)
                VALUES (?, ?, ?, ?, ?)
            `, [targetDate, company.id, models.length, JSON.stringify(modelNames), JSON.stringify(highlights)]);

            summaries.push({
                company: company.display_name,
                count: models.length,
                models: modelNames,
                highlights,
            });
        }
    }

    return summaries;
}

function getDailySummaries(days = 7) {
    const summaries = query(`
        SELECT s.*, c.name as company_name, c.display_name as company_display
        FROM hf_daily_summary s
        JOIN hf_companies c ON s.company_id = c.id
        ORDER BY s.summary_date DESC, s.total_new_models DESC
        LIMIT ?
    `, [days * 10]);

    const grouped = {};
    for (const s of summaries) {
        if (!grouped[s.summary_date]) {
            grouped[s.summary_date] = { date: s.summary_date, companies: [] };
        }
        grouped[s.summary_date].companies.push({
            company: s.company_display,
            total_new_models: s.total_new_models,
            model_names: JSON.parse(s.model_names || '[]'),
            highlights: JSON.parse(s.highlights || '[]'),
        });
    }

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
}

module.exports = {
    HF_COMPANIES,
    seedCompanies,
    syncCompanyModels,
    syncAllTrackedCompanies,
    getHFModels,
    getHFCompanies,
    toggleCompanyTracking,
    generateDailySummary,
    getDailySummaries,
    fetchHFModels,
};
